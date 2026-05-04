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

        // ?command=altaris  → spawn the Altaris agentic AI binary (default)
        // ?command=shell    → spawn the OS login shell (bash/cmd)
        // ?command=<path>   → spawn an explicit absolute-path executable (admin)
        var requested = (ctx.Request.Query["command"].ToString() ?? "altaris").Trim().ToLowerInvariant();
        var titleHint = (ctx.Request.Query["title"].ToString() ?? "").Trim();
        var vaultSlug = (ctx.Request.Query["vault"].ToString() ?? "").Trim().ToLowerInvariant();

        // Vault verildiyse cwd'yi vault path'ine çevir; yoksa user erişimini de doğrula.
        string? vaultCwd = null;
        if (!string.IsNullOrEmpty(vaultSlug))
        {
            var v = await db.Vaults.AsNoTracking().FirstOrDefaultAsync(
                x => x.TenantId == tenant.TenantId && x.Slug == vaultSlug);
            if (v is null) { ctx.Response.StatusCode = 404; return; }
            // Owner veya admin değilse kapat
            if (!Permissions.OwnershipAuth.OwnsOrAdmin(ctx, tenant, v.OwnerUserId))
            { ctx.Response.StatusCode = 403; return; }
            var root = Environment.GetEnvironmentVariable("ALTARIS_VAULTS_ROOT") ?? "/srv/altaris/vaults";
            vaultCwd = Path.Combine(root, tenant.TenantSlug, vaultSlug);
            if (!Directory.Exists(vaultCwd)) vaultCwd = null;
        }

        string fileName;
        string args;
        string source;
        string provider;
        string model;

        if (requested == "shell")
        {
            fileName = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash";
            args = OperatingSystem.IsWindows() ? "" : "--login -i";
            source = "remote"; provider = "shell"; model = fileName;
        }
        else if (requested.StartsWith('/') && File.Exists(requested))
        {
            fileName = requested;
            args = "";
            source = "remote"; provider = "custom"; model = Path.GetFileName(fileName);
        }
        else
        {
            // Default: Altaris agentic CLI. Resolve the binary so the spawned
            // process keeps working even when the API is started from a path
            // where ~/.local/bin is not in PATH.
            fileName = ResolveAltarisBinary();
            args = "";
            source = "agent"; provider = "altaris-cli"; model = "altaris";
        }

        var session = new AgentSession
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.TenantId.Value,
            UserId = tenant.UserId.Value,
            Source = source,
            Provider = provider,
            Model = model,
            Title = string.IsNullOrEmpty(titleHint)
                ? $"{(provider == "altaris-cli" ? "Altaris agent" : "Remote terminal")} {DateTime.UtcNow:yyyy-MM-dd HH:mm}"
                : titleHint,
            Status = "active",
            StartedAt = DateTimeOffset.UtcNow,
            Metadata = JsonSerializer.Serialize(new
            {
                remoteIp = ctx.Connection.RemoteIpAddress?.ToString(),
                userAgent = ctx.Request.Headers.UserAgent.ToString(),
                command = requested
            })
        };
        db.Sessions.Add(session);
        await Audit(db, tenant, "terminal.open", "session", session.Id.ToString(), ctx);
        await db.SaveChangesAsync();

        // Wrap interactive Ink-based programs (altaris) with `script` so the
        // child sees a real PTY and won't bail out on stdin.isTTY checks.
        // Plain shells work without it, but it's cheap and gives them job
        // control too — so we wrap unconditionally on Unix.
        var (spawnFile, spawnArgs) = WrapWithPty(fileName, args);

        var psi = new ProcessStartInfo
        {
            FileName = spawnFile, Arguments = spawnArgs,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            UseShellExecute = false, CreateNoWindow = true,
            WorkingDirectory = vaultCwd ?? Environment.GetEnvironmentVariable("HOME") ?? "/tmp"
        };
        psi.Environment["TERM"] = "xterm-256color";
        psi.Environment["ALTARIS_REMOTE"] = "1";
        psi.Environment["ALTARIS_SESSION_ID"] = session.Id.ToString();
        if (vaultCwd is not null)
        {
            psi.Environment["ALTARIS_VAULT_SLUG"] = vaultSlug;
            psi.Environment["ALTARIS_VAULT_PATH"] = vaultCwd;
        }
        // Tag bootstrap so the CLI can opt-out of duplicate work / banners.
        psi.Environment["ALTARIS_PARENT"] = "web-pty";
        psi.Environment["FORCE_COLOR"] = "1";
        psi.Environment["NO_UPDATE_NOTIFIER"] = "1";

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

        await Send(ws, JsonSerializer.Serialize(new {
            type = "ready", pid = proc.Id, command = fileName, kind = provider,
            sessionId = session.Id, title = session.Title
        }), ctx.RequestAborted);
        await PersistMessage(db, tenant, session.Id, "system", JsonSerializer.Serialize(new { kind = "open", pid = proc.Id, command = fileName }));
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

    /// <summary>
    ///   Wrap a command with the system's `script` utility so the child
    ///   process gets a real pty (Ink, htop, vim, less, … all need this).
    ///   - macOS / BSD:  script -q /dev/null <cmd> [args]
    ///   - Linux:        script -qec "<cmd> [args]" /dev/null
    ///   - Windows:      no wrap (ConPTY would need a different binding)
    /// </summary>
    private static (string file, string args) WrapWithPty(string cmd, string args)
    {
        if (OperatingSystem.IsWindows()) return (cmd, args);
        var combined = string.IsNullOrEmpty(args) ? cmd : $"{cmd} {args}";
        if (OperatingSystem.IsMacOS())
        {
            // BSD script: trailing tokens become the executed command.
            var trailing = string.IsNullOrEmpty(args) ? cmd : $"{cmd} {args}";
            return ("/usr/bin/script", $"-q /dev/null {trailing}");
        }
        // Linux util-linux script: -c takes the command string.
        return ("/usr/bin/script", $"-qec \"{combined.Replace("\"", "\\\"")}\" /dev/null");
    }

    /// <summary>
    ///   Resolve the `altaris` binary path. Order:
    ///     1. ALTARIS_BIN env var (operator override)
    ///     2. ~/.local/bin/altaris
    ///     3. PATH lookup
    ///     4. Repo-relative cli/bin/altaris (dev fallback)
    /// </summary>
    private static string ResolveAltarisBinary()
    {
        var envOverride = Environment.GetEnvironmentVariable("ALTARIS_BIN");
        if (!string.IsNullOrEmpty(envOverride) && File.Exists(envOverride)) return envOverride;

        var home = Environment.GetEnvironmentVariable("HOME") ?? "";
        var localBin = Path.Combine(home, ".local", "bin", "altaris");
        if (File.Exists(localBin)) return localBin;

        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var p in path.Split(Path.PathSeparator))
        {
            try
            {
                var candidate = Path.Combine(p, "altaris");
                if (File.Exists(candidate)) return candidate;
            }
            catch { }
        }

        // Dev fallback: API is usually started from api/, so the cli is two levels up.
        var devPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,
            "..", "..", "..", "..", "..", "cli", "bin", "altaris"));
        if (File.Exists(devPath)) return devPath;

        // Last resort: trust PATH at exec time (will fail visibly if missing).
        return "altaris";
    }

    private static async Task Send(WebSocket ws, string json, CancellationToken ct)
    {
        if (ws.State != WebSocketState.Open) return;
        await ws.SendAsync(Encoding.UTF8.GetBytes(json), WebSocketMessageType.Text, true, ct);
    }
}
