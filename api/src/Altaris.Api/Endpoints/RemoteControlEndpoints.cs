using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Presence;
using Altaris.Infrastructure.RemoteControl;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Remote-access broker endpoints — see <see cref="RemoteControlBroker"/>
///   for the protocol envelope. CLI publishes; web viewers attach.
/// </summary>
public static class RemoteControlEndpoints
{
    public static IEndpointRouteBuilder MapRemoteControlEndpoints(this IEndpointRouteBuilder app)
    {
        // List currently published + live sessions in the caller's tenant.
        app.MapGet("/api/v1/remote-control/sessions", ListPublished).RequireAuthorization();

        // Toggle the remote_control flag on an existing CLI-registered session.
        app.MapPatch("/api/v1/agent/sessions/{id:guid}/remote-control", ToggleFlag).RequireAuthorization();

        // CLI registers a new agent session (called once at altaris startup).
        app.MapPost("/api/v1/agent/sessions", RegisterSession).RequireAuthorization();
        app.MapPost("/api/v1/agent/sessions/{id:guid}/close", CloseSession).RequireAuthorization();
        // CLI persists a single message into the session transcript.
        app.MapPost("/api/v1/agent/sessions/{id:guid}/messages", AppendSessionMessage).RequireAuthorization();

        // Master channel: CLI streams here when remote_control is on.
        app.Map("/ws/remote-control/publish", HandlePublish).RequireAuthorization();
        // Viewer channel: web attaches here (admin or session owner).
        app.Map("/ws/remote-control/attach", HandleAttach).RequireAuthorization();

        return app;
    }

    // ─── REST ─────────────────────────────────────────────────────────────────

    public record RegisterSessionRequest(string Provider, string Model, string? Title, string? Source);

    private static async Task<IResult> RegisterSession(
        RegisterSessionRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var session = new AgentSession
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId.Value,
            Source = string.IsNullOrEmpty(req.Source) ? "cli" : req.Source,
            Provider = req.Provider, Model = req.Model,
            Title = req.Title ?? $"Altaris CLI {DateTime.UtcNow:yyyy-MM-dd HH:mm}",
            Status = "active", StartedAt = DateTimeOffset.UtcNow,
            Metadata = "{}"
        };
        db.Sessions.Add(session);
        await db.SaveChangesAsync();
        return Results.Ok(new { id = session.Id, title = session.Title });
    }

    public record AppendMessageRequest(string Role, string Content);

    private static async Task<IResult> AppendSessionMessage(
        Guid id, AppendMessageRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        if (string.IsNullOrEmpty(req.Role) || string.IsNullOrEmpty(req.Content))
            return Results.BadRequest(new { error = "role and content required" });

        var owns = await db.Sessions.AnyAsync(s =>
            s.Id == id && s.TenantId == tc.TenantId && s.UserId == tc.UserId);
        if (!owns) return Results.NotFound();

        // Cap stored content to keep DB rows reasonable; oversize pastes get clipped.
        var content = req.Content.Length > 64_000 ? req.Content[..64_000] : req.Content;

        // session_messages.content jsonb olduğu için raw string'i doğrudan
        // INSERT edersek Postgres "invalid input syntax for type json" hatası
        // verir. CLI/Web her zaman düz metin yolluyor — { text: "..." }
        // envelope'una sarıyoruz; admin sayfaları content.text okur.
        var jsonContent = JsonSerializer.Serialize(new { text = content });

        db.SessionMessages.Add(new SessionMessage
        {
            TenantId = tc.TenantId.Value,
            SessionId = id,
            Role = req.Role,
            Content = jsonContent,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> CloseSession(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId && x.UserId == tc.UserId);
        if (s is null) return Results.NotFound();
        s.Status = "ended";
        s.EndedAt = DateTimeOffset.UtcNow;
        s.RemoteControl = false;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public record ToggleRequest(bool Enabled);

    private static async Task<IResult> ToggleFlag(Guid id, ToggleRequest body,
        AltarisDbContext db, ITenantContext tc, RemoteControlBroker broker)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (s is null) return Results.NotFound();
        if (s.UserId != tc.UserId) return Results.Forbid();   // only owner toggles
        s.RemoteControl = body.Enabled;
        s.RemoteControlAt = body.Enabled ? DateTimeOffset.UtcNow : null;
        await db.SaveChangesAsync();
        if (!body.Enabled)
        {
            // Disconnecting all viewers happens implicitly when the publisher socket
            // closes; we don't kick them here, just clear the registry slot.
            broker.Remove(id);
        }
        return Results.Ok(new { id = s.Id, remoteAccess = s.RemoteControl });
    }

    private static async Task<IResult> ListPublished(
        AltarisDbContext db, ITenantContext tc, RemoteControlBroker broker, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var isAdmin = Permissions.OwnershipAuth.IsAdmin(http);
        var live = broker.ForTenant(tc.TenantId.Value).ToDictionary(b => b.Id);
        IQueryable<AgentSession> q = db.Sessions
            .Where(s => s.TenantId == tc.TenantId && s.RemoteControl && s.Status == "active");
        // Üye: sadece kendi published sessionları; admin: tenant'taki hepsi.
        if (!isAdmin)
        {
            if (tc.UserId is null) return Results.Ok(Array.Empty<object>());
            q = q.Where(s => s.UserId == tc.UserId);
        }
        var dbRows = await q
            .Join(db.Users, s => s.UserId, u => u.Id, (s, u) => new { s, u })
            .OrderByDescending(x => x.s.RemoteControlAt)
            .Select(x => new {
                id = x.s.Id, x.s.Provider, x.s.Model, x.s.Title, x.s.Source,
                x.s.StartedAt, x.s.RemoteControlAt,
                user = new { id = x.u.Id, email = x.u.Email, displayName = x.u.DisplayName }
            })
            .ToListAsync();
        var enriched = dbRows.Select(r => new
        {
            r.id, r.Provider, r.Model, r.Title, r.Source, r.StartedAt, r.RemoteControlAt, r.user,
            connected = live.ContainsKey(r.id),
            viewers = live.TryGetValue(r.id, out var b) ? b.Viewers.Count : 0,
            inputOwner = live.TryGetValue(r.id, out var b2) ? b2.InputOwnerUserId : (Guid?)null
        });
        return Results.Ok(enriched);
    }

    // ─── PUBLISHER (CLI master) ──────────────────────────────────────────────

    private static async Task HandlePublish(HttpContext ctx, ITenantContext tc,
        AltarisDbContext db, RemoteControlBroker broker)
    {
        if (!ctx.WebSockets.IsWebSocketRequest) { ctx.Response.StatusCode = 400; return; }
        if (tc.TenantId is null || tc.UserId is null) { ctx.Response.StatusCode = 403; return; }

        if (!Guid.TryParse(ctx.Request.Query["session"], out var sessionId))
        { ctx.Response.StatusCode = 400; return; }

        var session = await db.Sessions.FirstOrDefaultAsync(s =>
            s.Id == sessionId && s.TenantId == tc.TenantId && s.UserId == tc.UserId);
        if (session is null) { ctx.Response.StatusCode = 404; return; }
        if (!session.RemoteControl)
        { ctx.Response.StatusCode = 412; await ctx.Response.WriteAsync("remote_control disabled"); return; }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
        var brokered = broker.Open(sessionId, tc.TenantId.Value, tc.UserId.Value,
            tc.UserEmail ?? "unknown", ws, session.Title);

        var buf = new byte[16 * 1024];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var msg = Encoding.UTF8.GetString(buf, 0, result.Count);
                try
                {
                    using var doc = JsonDocument.Parse(msg);
                    var root = doc.RootElement;
                    var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
                    if (type == "out" && root.TryGetProperty("data", out var d))
                        await brokered.BroadcastOutAsync(d.GetString() ?? "", ctx.RequestAborted);
                    // Other types ignored for now.
                }
                catch (JsonException) { /* drop malformed */ }
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            broker.Remove(sessionId);
            // We do NOT auto-flip remote_control off — operator may want to reconnect.
            await PersistSysMessage(db, tc, sessionId, "remote_control.publisher_closed");
        }
    }

    // ─── VIEWER (web) ────────────────────────────────────────────────────────

    private static async Task HandleAttach(HttpContext ctx, ITenantContext tc,
        AltarisDbContext db, RemoteControlBroker broker)
    {
        if (!ctx.WebSockets.IsWebSocketRequest) { ctx.Response.StatusCode = 400; return; }
        if (tc.TenantId is null || tc.UserId is null) { ctx.Response.StatusCode = 403; return; }
        if (!Guid.TryParse(ctx.Request.Query["session"], out var sessionId))
        { ctx.Response.StatusCode = 400; return; }
        var mode = (ctx.Request.Query["mode"].ToString() ?? "watch").ToLowerInvariant();
        if (mode != "watch" && mode != "takeover") mode = "watch";

        var session = await db.Sessions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.TenantId == tc.TenantId);
        if (session is null) { ctx.Response.StatusCode = 404; return; }

        // Authorization: own session OR admin role
        var isOwner = session.UserId == tc.UserId;
        var roles = ctx.User.FindFirst("realm_access")?.Value ?? "";
        var isAdmin = roles.Contains("tenant_admin") || roles.Contains("platform_admin");
        if (!isOwner && !isAdmin) { ctx.Response.StatusCode = 403; return; }
        if (mode == "takeover" && !isAdmin && !isOwner) mode = "watch";

        var brokered = broker.Get(sessionId);
        if (brokered is null) { ctx.Response.StatusCode = 410; await ctx.Response.WriteAsync("publisher offline"); return; }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
        var viewer = brokered.Attach(ws, tc.UserId.Value, tc.UserEmail ?? "unknown", mode);
        await brokered.NotifyAsync($"{tc.UserEmail} joined as {mode}", ctx.RequestAborted);
        if (mode == "takeover")
        {
            brokered.RequestTakeover(tc.UserId.Value);
            await brokered.PushOwnerAsync(tc.UserId.Value, tc.UserEmail ?? "", ctx.RequestAborted);
            await brokered.NotifyAsync($"input owner → {tc.UserEmail}", ctx.RequestAborted);
            await PersistSysMessage(db, tc, sessionId, $"remote_control.takeover by {tc.UserEmail}");
        }
        else
        {
            await PersistSysMessage(db, tc, sessionId, $"remote_control.watch by {tc.UserEmail}");
        }

        const int MaxFrameBytes = 8 * 1024 * 1024;   // 8 MB cap (task #37)
        var buf = new byte[64 * 1024];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;

                // Guard against runaway payloads (binary push, infinite paste).
                if (result.Count >= buf.Length && !result.EndOfMessage)
                {
                    long total = result.Count;
                    while (!result.EndOfMessage && total < MaxFrameBytes)
                    {
                        result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                        total += result.Count;
                    }
                    if (total >= MaxFrameBytes)
                    {
                        await ws.CloseAsync((WebSocketCloseStatus)1009,
                            "frame exceeds 8MB cap", ctx.RequestAborted);
                        break;
                    }
                    continue;   // oversized but truncated — drop frame, keep socket
                }

                var msg = Encoding.UTF8.GetString(buf, 0, result.Count);
                try
                {
                    using var doc = JsonDocument.Parse(msg);
                    var root = doc.RootElement;
                    var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
                    if (type == "in" && root.TryGetProperty("data", out var d))
                    {
                        var keystroke = d.GetString() ?? "";
                        if (brokered.InputOwnerUserId == tc.UserId.Value)
                        {
                            await brokered.ForwardInputAsync(keystroke, ctx.RequestAborted);
                            // Audit: persist viewer-injected keystrokes (task #36).
                            // Truncate to 4 KB to keep DB sane on paste storms.
                            await PersistViewerKeystroke(db, tc, sessionId, keystroke);
                        }
                        else
                        {
                            // Watch-mode keylock UX (task #38) — tell viewer their
                            // keystroke was dropped because they don't own input.
                            await brokered.SendToViewerAsync(viewer.Key, new {
                                type = "info", kind = "watch_locked",
                                text = "watch-only — Takeover gerek"
                            }, ctx.RequestAborted);
                        }
                    }
                    else if (type == "resize"
                          && root.TryGetProperty("cols", out var c)
                          && root.TryGetProperty("rows", out var r))
                    {
                        // PTY resize forwarding (task #39) — only the input owner
                        // can resize so passive watchers don't fight the publisher.
                        if (brokered.InputOwnerUserId == tc.UserId.Value)
                            await brokered.ForwardResizeAsync(c.GetInt32(), r.GetInt32(), ctx.RequestAborted);
                    }
                    else if (type == "takeover" && (isAdmin || isOwner))
                    {
                        brokered.RequestTakeover(tc.UserId.Value);
                        await brokered.PushOwnerAsync(tc.UserId.Value, tc.UserEmail ?? "", ctx.RequestAborted);
                        await brokered.NotifyAsync($"input owner → {tc.UserEmail}", ctx.RequestAborted);
                    }
                    else if (type == "release")
                    {
                        brokered.ReleaseTakeover();
                        await brokered.PushOwnerAsync(brokered.PublisherUserId, brokered.PublisherEmail, ctx.RequestAborted);
                        await brokered.NotifyAsync($"input owner → {brokered.PublisherEmail} (publisher)", ctx.RequestAborted);
                    }
                }
                catch (JsonException) { }
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            brokered.Detach(viewer.Key);
            await brokered.NotifyAsync($"{tc.UserEmail} left", CancellationToken.None);
        }
    }

    private static async Task PersistSysMessage(AltarisDbContext db, ITenantContext tc, Guid sessionId, string text)
    {
        if (tc.TenantId is null) return;
        try
        {
            db.SessionMessages.Add(new SessionMessage
            {
                TenantId = tc.TenantId.Value,
                SessionId = sessionId,
                Role = "system",
                Content = JsonSerializer.Serialize(new { kind = "remote_control", text }),
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch { }
    }

    /// <summary>
    ///   Persist a viewer-injected keystroke to <c>session_messages</c>.
    ///   role = "user", metadata.injected_by = viewer email — so an auditor
    ///   can later distinguish what came from the publisher vs. takeover ops.
    /// </summary>
    private static async Task PersistViewerKeystroke(AltarisDbContext db, ITenantContext tc, Guid sessionId, string keystroke)
    {
        if (tc.TenantId is null || string.IsNullOrEmpty(keystroke)) return;
        // Bound the audit row size — long pastes get clipped (full content stays
        // in the live stream, the audit table just records who/when/sample).
        var sample = keystroke.Length > 4096 ? keystroke[..4096] : keystroke;
        try
        {
            db.SessionMessages.Add(new SessionMessage
            {
                TenantId = tc.TenantId.Value,
                SessionId = sessionId,
                Role = "user",
                Content = JsonSerializer.Serialize(new {
                    kind  = "remote_control_input",
                    bytes = keystroke.Length,
                    injected_by = tc.UserEmail ?? "unknown",
                    injected_by_id = tc.UserId,
                    sample
                }),
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch { }
    }
}
