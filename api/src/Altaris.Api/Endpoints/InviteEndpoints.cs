using Altaris.Domain.Entities;
using Altaris.Infrastructure.Keycloak;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Public invitation accept flow — no auth required.
///
///   1. /api/v1/invite/{token}  → returns invitation status (email, tenant,
///      role, expired?). UI uses this to render the accept form.
///   2. POST /api/v1/invite/{token}/accept  body { password, firstName, lastName }
///      → creates Keycloak user + local mirror + marks invitation accepted.
///      Returns OK with login redirect URL.
/// </summary>
public static class InviteEndpoints
{
    public static IEndpointRouteBuilder MapInviteEndpoints(this IEndpointRouteBuilder app)
    {
        // Both endpoints intentionally PUBLIC (no RequireAuthorization).
        app.MapGet ("/api/v1/invite/{token}",        Lookup);
        app.MapPost("/api/v1/invite/{token}/accept", Accept);
        return app;
    }

    private static async Task<IResult> Lookup(string token, AltarisDbContext db)
    {
        var inv = await db.Invitations.IgnoreQueryFilters()
            .AsNoTracking()
            .Join(db.Tenants.IgnoreQueryFilters(), i => i.TenantId, t => t.Id, (i, t) => new { i, t })
            .FirstOrDefaultAsync(x => x.i.Token == token);
        if (inv is null) return Results.NotFound(new { error = "invitation_not_found" });

        var status =
            inv.i.AcceptedAt != null         ? "accepted"
          : inv.i.ExpiresAt < DateTimeOffset.UtcNow ? "expired"
          :                                    "pending";

        return Results.Ok(new
        {
            email      = inv.i.Email,
            role       = inv.i.Role,
            tenant     = new { id = inv.t.Id, slug = inv.t.Slug, name = inv.t.Name },
            expiresAt  = inv.i.ExpiresAt,
            acceptedAt = inv.i.AcceptedAt,
            status,
        });
    }

    public record AcceptRequest(string Password, string? FirstName, string? LastName);

    private static async Task<IResult> Accept(
        string token, AcceptRequest req, AltarisDbContext db, KeycloakAdminClient kc)
    {
        var inv = await db.Invitations.IgnoreQueryFilters()
            .Join(db.Tenants.IgnoreQueryFilters(), i => i.TenantId, t => t.Id, (i, t) => new { i, t })
            .FirstOrDefaultAsync(x => x.i.Token == token);
        if (inv is null) return Results.NotFound(new { error = "invitation_not_found" });
        if (inv.i.AcceptedAt is not null) return Results.Conflict(new { error = "already_accepted" });
        if (inv.i.ExpiresAt < DateTimeOffset.UtcNow) return Results.BadRequest(new { error = "expired" });
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
            return Results.BadRequest(new { error = "password_too_short", min = 8 });

        var role = inv.i.Role is "tenant_admin" or "tenant_member" or "platform_admin"
            ? inv.i.Role : "tenant_member";

        // Idempotency: if a user with this email already exists locally, reject —
        // operatör manuel oluşturmuş olabilir, davet artık geçersiz say.
        var dupe = await db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.TenantId == inv.t.Id && u.Email == inv.i.Email);
        if (dupe) return Results.Conflict(new { error = "user_already_exists" });

        string kcId;
        try
        {
            kcId = await kc.CreateUserAsync(new CreateKeycloakUserRequest(
                Email: inv.i.Email,
                FirstName: req.FirstName,
                LastName: req.LastName,
                TenantSlug: inv.t.Slug,
                Password: req.Password,
                TemporaryPassword: false,   // user just typed it
                RealmRoles: new[] { role }
            ));
        }
        catch (Exception ex)
        {
            return Results.Problem(detail: ex.Message, statusCode: 502);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = inv.t.Id,
            KeycloakSub = kcId,
            Email = inv.i.Email,
            DisplayName = $"{req.FirstName} {req.LastName}".Trim(),
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);

        // Track invitation as accepted
        var trackedInv = await db.Invitations.IgnoreQueryFilters().FirstAsync(i => i.Id == inv.i.Id);
        trackedInv.AcceptedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Results.Ok(new { userId = user.Id, email = user.Email, tenantSlug = inv.t.Slug });
    }
}
