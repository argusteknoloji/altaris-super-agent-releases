using System.Security.Cryptography;
using System.Text;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.Keycloak;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /api/v1/admin/* — tenant-scoped admin operations.
///   Requires a JWT with the realm role 'tenant_admin' or 'platform_admin'.
///   All operations are tenant-isolated by RLS and TenantContext.
/// </summary>
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var grp = app.MapGroup("/api/v1/admin")
            .RequireAuthorization()
            .AddEndpointFilter(async (ctx, next) =>
            {
                var http = ctx.HttpContext;
                if (!http.User.Claims.Any(c => c.Type == "realm_access" || c.Type.EndsWith("/realm_access")))
                {
                    // Keycloak ships realm_access as nested JSON under "realm_access" claim
                }
                var roles = ExtractRealmRoles(http);
                if (!roles.Contains("tenant_admin") && !roles.Contains("platform_admin"))
                {
                    return Results.Forbid();
                }
                return await next(ctx);
            });

        // ===== USERS (Keycloak + local mirror) =====
        grp.MapGet("/users", ListUsers);
        grp.MapPost("/users", CreateUser);
        grp.MapDelete("/users/{userId:guid}", DeleteUser);
        grp.MapPost("/users/{userId:guid}/reset-password", ResetPassword);

        // ===== INVITATIONS =====
        grp.MapGet("/invitations", ListInvitations);
        grp.MapPost("/invitations", CreateInvitation);
        grp.MapDelete("/invitations/{id:guid}", RevokeInvitation);

        // ===== TENANTS (platform_admin only — gated inline) =====
        grp.MapGet("/tenants", ListTenants);
        grp.MapPost("/tenants", CreateTenant);

        // ===== AUDIT =====
        grp.MapGet("/audit", ListAudit);

        // ===== API KEYS =====
        grp.MapGet("/api-keys", ListApiKeys);
        grp.MapPost("/api-keys", CreateApiKey);
        grp.MapDelete("/api-keys/{id:guid}", RevokeApiKey);

        // ===== PROVIDER CONFIG =====
        grp.MapGet("/providers", ListProviders);
        grp.MapPost("/providers", UpsertProvider);
        grp.MapDelete("/providers/{id:guid}", DeleteProvider);

        return app;
    }

    private static IReadOnlySet<string> ExtractRealmRoles(HttpContext http)
    {
        var raClaim = http.User.FindFirst("realm_access")?.Value;
        if (string.IsNullOrEmpty(raClaim)) return new HashSet<string>();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(raClaim);
            if (doc.RootElement.TryGetProperty("roles", out var arr) && arr.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                return arr.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToHashSet();
            }
        }
        catch { }
        return new HashSet<string>();
    }

    // ---- USERS ----
    private static async Task<IResult> ListUsers(AltarisDbContext db, ITenantContext tc) =>
        Results.Ok(await db.Users
            .Where(u => u.TenantId == tc.TenantId)
            .OrderBy(u => u.Email)
            .Select(u => new { u.Id, u.Email, u.DisplayName, u.Role, u.KeycloakSub, u.CreatedAt })
            .ToListAsync());

    public record CreateUserRequest(string Email, string? FirstName, string? LastName, string Password, bool Temporary, string Role);

    private static async Task<IResult> CreateUser(
        CreateUserRequest req, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        var role = req.Role is "tenant_admin" or "tenant_member" or "platform_admin" ? req.Role : "tenant_member";
        var kcId = await kc.CreateUserAsync(new CreateKeycloakUserRequest(
            Email: req.Email,
            FirstName: req.FirstName,
            LastName: req.LastName,
            TenantSlug: tc.TenantSlug,
            Password: req.Password,
            TemporaryPassword: req.Temporary,
            RealmRoles: new[] { role }
        ));
        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            KeycloakSub = kcId,
            Email = req.Email,
            DisplayName = $"{req.FirstName} {req.LastName}".Trim(),
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/admin/users/{user.Id}", new { user.Id, user.Email, keycloakSub = kcId });
    }

    private static async Task<IResult> DeleteUser(Guid userId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.DeleteUserAsync(u.KeycloakSub);
        db.Users.Remove(u);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    public record ResetPasswordRequest(string NewPassword, bool Temporary);

    private static async Task<IResult> ResetPassword(Guid userId, ResetPasswordRequest req, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.ResetPasswordAsync(u.KeycloakSub, req.NewPassword, req.Temporary);
        return Results.NoContent();
    }

    // ---- INVITATIONS ----
    private static async Task<IResult> ListInvitations(AltarisDbContext db, ITenantContext tc) =>
        Results.Ok(await db.Invitations
            .Where(i => i.TenantId == tc.TenantId && i.AcceptedAt == null)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new { i.Id, i.Email, i.Role, i.ExpiresAt, i.CreatedAt })
            .ToListAsync());

    public record CreateInvitationRequest(string Email, string Role, int? ValidDays);

    private static async Task<IResult> CreateInvitation(CreateInvitationRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var inv = new Invitation
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            Email = req.Email,
            Role = req.Role,
            Token = token,
            InvitedBy = tc.UserId,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(req.ValidDays ?? 7),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Invitations.Add(inv);
        await db.SaveChangesAsync();
        return Results.Ok(new { inv.Id, inv.Email, inv.Role, inv.ExpiresAt, token });
    }

    private static async Task<IResult> RevokeInvitation(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var inv = await db.Invitations.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tc.TenantId);
        if (inv is null) return Results.NotFound();
        db.Invitations.Remove(inv);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // ---- TENANTS (platform_admin only) ----
    private static async Task<IResult> ListTenants(HttpContext http, AltarisDbContext db)
    {
        if (!ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var rows = await db.Tenants.OrderBy(t => t.Slug)
            .Select(t => new { t.Id, t.Slug, t.Name, t.Status, t.CreatedAt })
            .ToListAsync();
        return Results.Ok(rows);
    }

    public record CreateTenantRequest(string Slug, string Name);

    private static async Task<IResult> CreateTenant(HttpContext http, CreateTenantRequest req, AltarisDbContext db)
    {
        if (!ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var t = new Tenant
        {
            Id = Guid.NewGuid(), Slug = req.Slug, Name = req.Name,
            Status = "active", KeycloakRealm = "altaris",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Tenants.Add(t);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/admin/tenants/{t.Id}", new { t.Id, t.Slug, t.Name });
    }

    // ---- AUDIT ----
    private static async Task<IResult> ListAudit(AltarisDbContext db, ITenantContext tc, int take = 200) =>
        Results.Ok(await db.AuditEvents
            .Where(a => a.TenantId == tc.TenantId)
            .OrderByDescending(a => a.OccurredAt)
            .Take(Math.Min(take, 1000))
            .Select(a => new { a.Id, a.Actor, a.Action, a.ResourceType, a.ResourceId, a.Ip, a.OccurredAt })
            .ToListAsync());

    // ---- API KEYS ----
    private static async Task<IResult> ListApiKeys(AltarisDbContext db, ITenantContext tc) =>
        Results.Ok(await db.ApiKeys
            .Where(k => k.TenantId == tc.TenantId && k.RevokedAt == null)
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new { k.Id, k.Name, k.Prefix, k.LastUsedAt, k.ExpiresAt, k.CreatedAt, k.UserId })
            .ToListAsync());

    public record CreateApiKeyRequest(string Name, int? ValidDays);

    private static async Task<IResult> CreateApiKey(CreateApiKeyRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var raw = "ak_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var prefix = raw[..10];
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

        var key = new ApiKey
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId.Value,
            Name = req.Name,
            Prefix = prefix,
            Hash = hash,
            ExpiresAt = req.ValidDays.HasValue ? DateTimeOffset.UtcNow.AddDays(req.ValidDays.Value) : null,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.ApiKeys.Add(key);
        await db.SaveChangesAsync();
        // Raw secret is shown ONCE
        return Results.Ok(new { key.Id, key.Name, key.Prefix, key.ExpiresAt, secret = raw });
    }

    private static async Task<IResult> RevokeApiKey(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var k = await db.ApiKeys.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (k is null) return Results.NotFound();
        k.RevokedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // ---- PROVIDER CONFIG ----
    private static async Task<IResult> ListProviders(AltarisDbContext db, ITenantContext tc) =>
        Results.Ok(await db.ProviderConfigs
            .Where(p => p.TenantId == tc.TenantId)
            .OrderBy(p => p.Provider).ThenBy(p => p.Name)
            .Select(p => new { p.Id, p.Provider, p.Name, p.BaseUrl, p.DefaultModel, p.IsDefault, p.Enabled, p.UpdatedAt })
            .ToListAsync());

    public record UpsertProviderRequest(Guid? Id, string Provider, string Name, string? BaseUrl, string? ApiKey, string? DefaultModel, bool IsDefault, bool Enabled);

    private static async Task<IResult> UpsertProvider(UpsertProviderRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();

        ProviderConfig p;
        if (req.Id is { } id)
        {
            p = await db.ProviderConfigs.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId)
                ?? throw new InvalidOperationException("not found");
        }
        else
        {
            p = new ProviderConfig
            {
                Id = Guid.NewGuid(), TenantId = tc.TenantId.Value,
                Provider = req.Provider, Name = req.Name,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.ProviderConfigs.Add(p);
        }
        p.Provider = req.Provider;
        p.Name = req.Name;
        p.BaseUrl = req.BaseUrl;
        p.DefaultModel = req.DefaultModel;
        p.IsDefault = req.IsDefault;
        p.Enabled = req.Enabled;
        if (!string.IsNullOrEmpty(req.ApiKey))
        {
            // Dev: store hex(SHA256(apikey)) until proper KMS wiring lands
            // Replace with libsodium / Azure KeyVault / AWS KMS in production
            p.ApiKeyEnc = "sha256:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(req.ApiKey)));
        }
        p.UpdatedAt = DateTimeOffset.UtcNow;

        if (req.IsDefault)
        {
            await db.ProviderConfigs
                .Where(x => x.TenantId == tc.TenantId && x.Provider == req.Provider && x.Id != p.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false));
        }

        await db.SaveChangesAsync();
        return Results.Ok(new { p.Id, p.Provider, p.Name, p.IsDefault });
    }

    private static async Task<IResult> DeleteProvider(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var p = await db.ProviderConfigs.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (p is null) return Results.NotFound();
        db.ProviderConfigs.Remove(p);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
