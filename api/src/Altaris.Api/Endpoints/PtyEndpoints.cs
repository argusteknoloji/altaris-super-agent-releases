using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /ws/pty — bidirectional WebSocket bridge to a child shell process.
///   Persists every input/output chunk + exit into agent_sessions/session_messages
///   so the full transcript is replay-able from /sessions/{id} and visible to admins.
/// </summary>
public static class PtyEndpoints
{
    public static IEndpointRouteBuilder MapPtyEndpoints(this IEndpointRouteBuilder app)
    {
        app.Map("/ws/pty", HandlePty).RequireAuthorization();
        return app;
    }

    private static async Task HandlePty(HttpContext ctx, ITenantContext tenant, AltarisDbContext db)
    {
        if (!ctx.WebSockets.IsWebSocketRequest)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }
        if (tenant.TenantId is null || tenant.UserId is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();

        var shell = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash";
        var args = OperatingSystem.IsWindows() ? "" : "--login -i";

        // Open a session record
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
            Metadata = JsonSerializer.Serialize(new { remoteIp = ctx.Connection.RemoteIpAddress?.ToString(), userAgent = ctx.Request.Headers.UserAgent.ToString() })
        };
        db.Sessions.Add(session);
        await Audit(db, tenant, "terminal.open", "session", session.Id.ToString(), ctx);
        await db.SaveChangesAsync();

        var psi = new ProcessStartInfo
        {
            FileName = shell,
            Arguments = args,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Environment.GetEnvironmentVariable("HOME") ?? "/tmp"
        };
        psi.Environment["TERM"] = "xterm-256color";
        psi.Environment["ALTARIS_REMOTE"] = "1";
        psi.Environment["ALTARIS_SESSION_ID"] = session.Id.ToString();

        using var proc = Process.Start(psi);
        if (proc is null)
        {
            await SendAsync(ws, JsonSerializer.Serialize(new { type = "error", message = "Failed to spawn shell" }), CancellationToken.None);
            session.Status = "error"; session.EndedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            return;
        }

        await SendAsync(ws, JsonSerializer.Serialize(new { type = "ready", pid = proc.Id, shell, sessionId = session.Id }), ctx.RequestAborted);

        // Persist initial system event
        await PersistMessage(db, tenant, session.Id, "system", JsonSerializer.Serialize(new { kind = "open", pid = proc.Id, shell }));

        // Pump shell stdout/stderr → ws + DB
        var stdoutTask = Pump(proc.StandardOutput, ws, "out", db, tenant, session.Id, ctx.RequestAborted);
        var stderrTask = Pump(proc.StandardError, ws, "err", db, tenant, session.Id, ctx.RequestAborted);

        // Pump ws → shell stdin + DB
        var buf = new byte[8192];
        try
        {
            while (ws.State == WebSocketState.Open && !proc.HasExited)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var input = Encoding.UTF8.GetString(buf, 0, result.Count);
                await proc.StandardInput.WriteAsync(input);
                await proc.StandardInput.FlushAsync();
                await PersistMessage(db, tenant, session.Id, "user", JsonSerializer.Serialize(new { kind = "stdin", data = input }));
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            await Task.WhenAny(Task.WhenAll(stdoutTask, stderrTask), Task.Delay(500));
            session.Status = proc.HasExited ? "ended" : "killed";
            session.EndedAt = DateTimeOffset.UtcNow;
            await PersistMessage(db, tenant, session.Id, "system",
                JsonSerializer.Serialize(new { kind = "close", exitCode = proc.HasExited ? proc.ExitCode : (int?)null }));
            await Audit(db, tenant, "terminal.close", "session", session.Id.ToString(), ctx);
            await db.SaveChangesAsync();
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "shell exited", CancellationToken.None);
        }
    }

    private static async Task Pump(StreamReader src, WebSocket ws, string kind,
        AltarisDbContext db, ITenantContext tenant, Guid sessionId, CancellationToken ct)
    {
        var buf = new char[4096];
        try
        {
            while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
            {
                var n = await src.ReadAsync(buf, ct);
                if (n == 0) break;
                var text = new string(buf, 0, n);
                await SendAsync(ws, JsonSerializer.Serialize(new { type = kind, data = text }), ct);
                await PersistMessage(db, tenant, sessionId, "tool",
                    JsonSerializer.Serialize(new { kind, data = text }));
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
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
        try { await db.SaveChangesAsync(); }
        catch { /* best effort during pump */ }
    }

    private static async Task Audit(AltarisDbContext db, ITenantContext tenant, string action, string resourceType, string resourceId, HttpContext ctx)
    {
        if (tenant.TenantId is null) return;
        db.AuditEvents.Add(new AuditEvent
        {
            TenantId = tenant.TenantId,
            UserId = tenant.UserId,
            Actor = tenant.UserEmail ?? "unknown",
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Ip = ctx.Connection.RemoteIpAddress?.ToString(),
            UserAgent = ctx.Request.Headers.UserAgent.ToString(),
            Payload = "{}",
            OccurredAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static async Task SendAsync(WebSocket ws, string json, CancellationToken ct)
    {
        if (ws.State != WebSocketState.Open) return;
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }
}
