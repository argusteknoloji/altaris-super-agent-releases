using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Presence;
using Altaris.Infrastructure.Pty;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   PTY endpoints:
///     /ws/pty                         — open a NEW master session (existing behavior)
///     /ws/pty/watch?session={id}      — read-only watcher (mirrors stdout to viewer)
///     /ws/pty/takeover?session={id}   — admin takeover; can also send input
///   Presence beacon refreshed continuously while master is active. Every
///   chunk persisted to session_messages and broadcast to all subscribers.
/// </summary>
public static class PtyEndpoints
{
    public static IEndpointRouteBuilder MapPtyEndpoints(this IEndpointRouteBuilder app)
    {
        app.Map("/ws/pty",          HandleMaster).RequireAuthorization();
        app.Map("/ws/pty/watch",    (HttpContext ctx, ITenantContext tc, AltarisDbContext db, PtySessionManager mgr, PresenceTracker presence)
            => HandleAttach(ctx, tc, db, mgr, presence, "watch")).RequireAuthorization();
        app.Map("/ws/pty/takeover", (HttpContext ctx, ITenantContext tc, AltarisDbContext db, PtySessionManager mgr, PresenceTracker presence)
            => HandleAttach(ctx, tc, db, mgr, presence, "takeover")).RequireAuthorization();
        return app;
    }

    // ─── Master: open new session ─────────────────────────────────────────────

    private static async Task HandleMaster(
        HttpContext ctx, ITenantContext tenant, AltarisDbContext db,
        PtySessionManager mgr, PresenceTracker presence)
    {
        if (!ctx.WebSockets.IsWebSocketRequest) { ctx.Response.StatusCode = 400; return; }
        if (tenant.TenantId is null || tenant.UserId is null || tenant.TenantSlug is null)
        { ctx.Response.StatusCode = 403; return; }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
        var shell = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash";
        var args = OperatingSystem.IsWindows() ? "" : "--login -i";

        var session = new AgentSession
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.TenantId.Value,
            UserId = tenant.UserId.Value,
            Source = "remote",
            Provider = "shell",
            Model = shell,
            Title = $"Remote terminal {DateTime.UtcNow:yyyy-MM-dd HH:mm}",
            Status = "active",
            StartedAt = DateTimeOffset.UtcNow,
            Metadata = JsonSerializer.Serialize(new
            {
                remoteIp = ctx.Connection.RemoteIpAddress?.ToString(),
                userAgent = ctx.Request.Headers.UserAgent.ToString()
            })
        };
        db.Sessions.Add(session);
        await Audit(db, tenant, "terminal.open", "session", session.Id.ToString(), ctx);
        await db.SaveChangesAsync();

        var psi = new ProcessStartInfo
        {
            FileName = shell, Arguments = args,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            UseShellExecute = false, CreateNoWindow = true,
            WorkingDirectory = Environment.GetEnvironmentVariable("HOME") ?? "/tmp"
        };
        psi.Environment["TERM"] = "xterm-256color";
        psi.Environment["ALTARIS_REMOTE"] = "1";
        psi.Environment["ALTARIS_SESSION_ID"] = session.Id.ToString();

        var proc = Process.Start(psi);
        if (proc is null)
        {
            await Send(ws, JsonSerializer.Serialize(new { type = "error", message = "Failed to spawn shell" }), CancellationToken.None);
            session.Status = "error"; session.EndedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            return;
        }

        var pty = mgr.Open(session.Id, tenant.TenantId.Value, tenant.UserId.Value, proc);
        var sub = pty.Attach(ws, tenant.UserId.Value, "master");

        await Send(ws, JsonSerializer.Serialize(new { type = "ready", pid = proc.Id, shell, sessionId = session.Id }), ctx.RequestAborted);
        await PersistMessage(db, tenant, session.Id, "system", JsonSerializer.Serialize(new { kind = "open", pid = proc.Id, shell }));
        await presence.TouchAsync(tenant.TenantSlug, session.Id, tenant.UserId.Value, "remote");

        // Pump shell → broadcast to all subs
        var stdoutTask = PumpToBroadcast(proc.StandardOutput, "out", pty, db, tenant, session.Id, presence, ctx.RequestAborted);
        var stderrTask = PumpToBroadcast(proc.StandardError, "err", pty, db, tenant, session.Id, presence, ctx.RequestAborted);

        // Master input loop
        var buf = new byte[8192];
        try
        {
            while (ws.State == WebSocketState.Open && !proc.HasExited)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var input = Encoding.UTF8.GetString(buf, 0, result.Count);
                // Only the current input owner may write
                if (pty.InputOwnerUserId == tenant.UserId.Value)
                {
                    pty.WriteToShell(input);
                    await PersistMessage(db, tenant, session.Id, "user",
                        JsonSerializer.Serialize(new { kind = "stdin", data = input, by = tenant.UserEmail }));
                }
                await presence.TouchAsync(tenant.TenantSlug, session.Id, tenant.UserId.Value, "remote");
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            pty.Detach(sub.Key);
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            await Task.WhenAny(Task.WhenAll(stdoutTask, stderrTask), Task.Delay(500));
            session.Status = proc.HasExited ? "ended" : "killed";
            session.EndedAt = DateTimeOffset.UtcNow;
            await PersistMessage(db, tenant, session.Id, "system",
                JsonSerializer.Serialize(new { kind = "close", exitCode = proc.HasExited ? proc.ExitCode : (int?)null }));
            await Audit(db, tenant, "terminal.close", "session", session.Id.ToString(), ctx);
            await db.SaveChangesAsync();
            await presence.DropAsync(tenant.TenantSlug!, session.Id);
            mgr.Remove(session.Id);
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "shell exited", CancellationToken.None);
        }
    }

    // ─── Watch / Takeover: attach to existing session ────────────────────────

    private static async Task HandleAttach(
        HttpContext ctx, ITenantContext tenant, AltarisDbContext db,
        PtySessionManager mgr, PresenceTracker presence, string mode)
    {
        if (!ctx.WebSockets.IsWebSocketRequest) { ctx.Response.StatusCode = 400; return; }
        if (tenant.TenantId is null || tenant.UserId is null) { ctx.Response.StatusCode = 403; return; }

        var sessionIdStr = ctx.Request.Query["session"].ToString();
        if (!Guid.TryParse(sessionIdStr, out var sessionId)) { ctx.Response.StatusCode = 400; return; }

        // Authorization: own session, OR caller has tenant_admin/platform_admin
        var dbSession = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tenant.TenantId);
        if (dbSession is null) { ctx.Response.StatusCode = 404; return; }

        var raClaim = ctx.User.FindFirst("realm_access")?.Value ?? "";
        var isAdmin = raClaim.Contains("tenant_admin") || raClaim.Contains("platform_admin");
        if (dbSession.UserId != tenant.UserId && !isAdmin) { ctx.Response.StatusCode = 403; return; }

        var pty = mgr.Get(sessionId);
        if (pty is null) { ctx.Response.StatusCode = 410; await ctx.Response.WriteAsync("Session not live"); return; }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
        var sub = pty.Attach(ws, tenant.UserId.Value, mode);

        await Send(ws, JsonSerializer.Serialize(new { type = "attached", mode, sessionId, subscribers = pty.Subscribers.Count }), ctx.RequestAborted);
        await pty.NotifyEvent("watcher_joined", new { user = tenant.UserEmail, mode, count = pty.Subscribers.Count }, ctx.RequestAborted);

        if (mode == "takeover" && isAdmin)
        {
            pty.RequestTakeover(tenant.UserId.Value);
            await pty.NotifyEvent("input_owner_changed", new { user = tenant.UserEmail }, ctx.RequestAborted);
            await Audit(db, tenant, "terminal.takeover", "session", sessionId.ToString(), ctx);
            await db.SaveChangesAsync();
        }
        else
        {
            await Audit(db, tenant, "terminal.watch", "session", sessionId.ToString(), ctx);
            await db.SaveChangesAsync();
        }

        var buf = new byte[4096];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;
                if (mode == "takeover" && pty.InputOwnerUserId == tenant.UserId.Value)
                {
                    var input = Encoding.UTF8.GetString(buf, 0, result.Count);
                    pty.WriteToShell(input);
                    await PersistMessage(db, tenant, sessionId, "user",
                        JsonSerializer.Serialize(new { kind = "stdin", data = input, by = tenant.UserEmail, takeover = true }));
                }
                // watch mode silently ignores any input attempts
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            pty.Detach(sub.Key);
            await pty.NotifyEvent("watcher_left", new { user = tenant.UserEmail, count = pty.Subscribers.Count }, CancellationToken.None);
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "detached", CancellationToken.None);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static async Task PumpToBroadcast(
        StreamReader src, string kind, PtySession pty,
        AltarisDbContext db, ITenantContext tenant, Guid sessionId,
        PresenceTracker presence, CancellationToken ct)
    {
        var buf = new char[4096];
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var n = await src.ReadAsync(buf, ct);
                if (n == 0) break;
                var text = new string(buf, 0, n);
                await pty.BroadcastAsync(kind, text, ct);
                await PersistMessage(db, tenant, sessionId, "tool",
                    JsonSerializer.Serialize(new { kind, data = text }));
                if (tenant.TenantSlug is not null && tenant.UserId.HasValue)
                    await presence.TouchAsync(tenant.TenantSlug, sessionId, tenant.UserId.Value, "remote");
            }
        }
        catch (OperationCanceledException) { }
    }

    private static async Task PersistMessage(AltarisDbContext db, ITenantContext tenant, Guid sessionId, string role, string contentJson)
    {
        if (tenant.TenantId is null) return;
        db.SessionMessages.Add(new SessionMessage
        {
            TenantId = tenant.TenantId.Value,
            SessionId = sessionId,
            Role = role,
            Content = contentJson,
            CreatedAt = DateTimeOffset.UtcNow
        });
        try { await db.SaveChangesAsync(); } catch { /* best effort */ }
    }

    private static async Task Audit(AltarisDbContext db, ITenantContext tenant, string action, string resourceType, string resourceId, HttpContext ctx)
    {
        if (tenant.TenantId is null) return;
        db.AuditEvents.Add(new AuditEvent
        {
            TenantId = tenant.TenantId, UserId = tenant.UserId,
            Actor = tenant.UserEmail ?? "unknown",
            Action = action, ResourceType = resourceType, ResourceId = resourceId,
            Ip = ctx.Connection.RemoteIpAddress?.ToString(),
            UserAgent = ctx.Request.Headers.UserAgent.ToString(),
            OccurredAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static async Task Send(WebSocket ws, string json, CancellationToken ct)
    {
        if (ws.State != WebSocketState.Open) return;
        await ws.SendAsync(Encoding.UTF8.GetBytes(json), WebSocketMessageType.Text, true, ct);
    }
}
