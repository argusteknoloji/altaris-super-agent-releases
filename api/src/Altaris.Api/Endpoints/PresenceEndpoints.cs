using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Presence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

public static class PresenceEndpoints
{
    public static IEndpointRouteBuilder MapPresenceEndpoints(this IEndpointRouteBuilder app)
    {
        // Heartbeat: web/desktop client posts every 20-30 sec while a session/window is alive.
        app.MapPost("/api/v1/presence/heartbeat", async (
            HeartbeatRequest req, ITenantContext tc, PresenceTracker presence) =>
        {
            if (tc.TenantId is null || tc.UserId is null || tc.TenantSlug is null) return Results.Forbid();
            await presence.TouchAsync(tc.TenantSlug, req.SessionId, tc.UserId.Value, req.Source ?? "web");
            return Results.Ok(new { ok = true, ttlSec = 60 });
        }).RequireAuthorization();

        // Per-session live status (caller must own session OR be admin)
        app.MapGet("/api/v1/sessions/{id:guid}/presence", async (Guid id,
            AltarisDbContext db, ITenantContext tc, PresenceTracker presence) =>
        {
            var owns = await db.Sessions.AnyAsync(s => s.Id == id && s.TenantId == tc.TenantId && s.UserId == tc.UserId);
            if (!owns) return Results.NotFound();
            var active = await presence.IsActiveAsync(id);
            return Results.Ok(new { sessionId = id, connected = active });
        }).RequireAuthorization();

        // Admin: list of active sessions in tenant
        app.MapGet("/api/v1/admin/presence", async (
            ITenantContext tc, PresenceTracker presence, AltarisDbContext db) =>
        {
            if (tc.TenantSlug is null || tc.TenantId is null) return Results.Forbid();
            var ids = await presence.ActiveSessionsAsync(tc.TenantSlug);
            if (ids.Count == 0) return Results.Ok(Array.Empty<object>());
            var rows = await db.Sessions
                .Where(s => ids.Contains(s.Id) && s.TenantId == tc.TenantId)
                .Join(db.Users, s => s.UserId, u => u.Id, (s, u) => new
                {
                    s.Id, s.Source, s.Provider, s.Model, s.Title, s.Status, s.StartedAt,
                    user = new { id = u.Id, email = u.Email }
                })
                .ToListAsync();
            return Results.Ok(rows);
        }).RequireAuthorization();

        return app;
    }
}

public record HeartbeatRequest(Guid SessionId, string? Source);
