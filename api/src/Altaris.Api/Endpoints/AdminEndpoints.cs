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
        grp.MapPatch("/users/{userId:guid}", UpdateUser);
        grp.MapDelete("/users/{userId:guid}", DeleteUser);
        grp.MapPost("/users/{userId:guid}/reset-password", ResetPassword);

        // ===== INVITATIONS =====
        grp.MapGet("/invitations", ListInvitations);
        grp.MapPost("/invitations", CreateInvitation);
        grp.MapDelete("/invitations/{id:guid}", RevokeInvitation);

        // ===== TENANTS (platform_admin only — gated inline) =====
        grp.MapGet("/tenants", ListTenants);
        grp.MapPost("/tenants", CreateTenant);
        grp.MapPatch("/tenants/{id:guid}", UpdateTenant);
        grp.MapDelete("/tenants/{id:guid}", DeleteTenant);

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

    /// <summary>
    ///   <c>TargetTenantId</c> yalnızca platform_admin tarafından kullanılabilir.
    ///   Tenant_admin için yok sayılır — kendi tenant'ından başkasına yazamaz
    ///   (RLS zaten engeller, biz daha erken net cevap dönüyoruz).
    /// </summary>
    public record CreateUserRequest(
        string Email, string? FirstName, string? LastName, string Password,
        bool Temporary, string Role, Guid? TargetTenantId = null);

    private static async Task<IResult> CreateUser(
        HttpContext http, CreateUserRequest req, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        var role = req.Role is "tenant_admin" or "tenant_member" or "platform_admin" ? req.Role : "tenant_member";

        // Cross-tenant create — sadece platform_admin yapabilir.
        var (effectiveTenantId, effectiveTenantSlug) = (tc.TenantId.Value, tc.TenantSlug);
        if (req.TargetTenantId is { } targetId && targetId != tc.TenantId.Value)
        {
            if (!ExtractRealmRoles(http).Contains("platform_admin"))
                return Results.Forbid();
            var target = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == targetId);
            if (target is null) return Results.BadRequest(new { error = "target tenant not found" });
            effectiveTenantId   = target.Id;
            effectiveTenantSlug = target.Slug;
        }

        var kcId = await kc.CreateUserAsync(new CreateKeycloakUserRequest(
            Email: req.Email,
            FirstName: req.FirstName,
            LastName: req.LastName,
            TenantSlug: effectiveTenantSlug,
            Password: req.Password,
            TemporaryPassword: req.Temporary,
            RealmRoles: new[] { role }
        ));
        var user = new User
        {
            Id = Guid.NewGuid(),
            TenantId = effectiveTenantId,
            KeycloakSub = kcId,
            Email = req.Email,
            DisplayName = $"{req.FirstName} {req.LastName}".Trim(),
            Role = role,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/admin/users/{user.Id}", new { user.Id, user.Email, keycloakSub = kcId, tenantId = effectiveTenantId });
    }

    public record UpdateUserRequest(string? Email, string? FirstName, string? LastName, string? Role, bool? Enabled);

    private static async Task<IResult> UpdateUser(
        Guid userId, UpdateUserRequest req, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();

        // 1) Keycloak attribute update (email/name/enabled)
        await kc.UpdateUserAsync(u.KeycloakSub, req.Email, req.FirstName, req.LastName, req.Enabled);

        // 2) Realm role swap if role changed
        if (!string.IsNullOrWhiteSpace(req.Role) && req.Role != u.Role)
        {
            var newRole = req.Role is "tenant_admin" or "tenant_member" or "platform_admin"
                ? req.Role : "tenant_member";
            // Eski rolü kaldır, yenisini ata. AssignRealmRoles aditif olduğu
            // için eski rol kalırdı — RemoveRealmRoles ile temizliyoruz.
            try { await kc.RemoveRealmRolesAsync(u.KeycloakSub, new[] { u.Role }); } catch { /* role yoksa OK */ }
            await kc.AssignRealmRolesAsync(u.KeycloakSub, new[] { newRole });
            u.Role = newRole;
        }

        // 3) Local mirror sync
        if (req.Email is not null) u.Email = req.Email;
        if (req.FirstName is not null || req.LastName is not null)
        {
            var fn = req.FirstName ?? "";
            var ln = req.LastName  ?? "";
            u.DisplayName = $"{fn} {ln}".Trim();
        }

        await db.SaveChangesAsync();
        return Results.Ok(new { u.Id, u.Email, u.DisplayName, u.Role });
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

    public record UpdateTenantRequest(string? Name, string? Status);

    private static async Task<IResult> UpdateTenant(HttpContext http, Guid id, UpdateTenantRequest req, AltarisDbContext db)
    {
        if (!ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(req.Name))   t.Name   = req.Name.Trim();
        if (!string.IsNullOrWhiteSpace(req.Status))
        {
            var st = req.Status.Trim().ToLowerInvariant();
            if (st is not ("active" or "suspended" or "archived"))
                return Results.BadRequest(new { error = "status must be active|suspended|archived" });
            t.Status = st;
        }
        t.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(new { t.Id, t.Slug, t.Name, t.Status });
    }

    /// <summary>
    ///   Tenant'ı sil — ON DELETE CASCADE ile users/sessions/messages/audit/
    ///   vaults/api_keys/invitations/provider_configs hepsi düşer. Geri alınamaz.
    ///   Filesystem'deki vault dosyaları manuel silinmez (audit için tutulabilir).
    /// </summary>
    private static async Task<IResult> DeleteTenant(HttpContext http, Guid id, AltarisDbContext db)
    {
        if (!ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return Results.NotFound();
        db.Tenants.Remove(t);
        await db.SaveChangesAsync();
        return Results.NoContent();
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
            // MVP: store raw key — provider invocation needs plaintext.
            // TODO: wrap in libsodium / Azure KeyVault / AWS KMS envelope encryption
            // before exposing this column outside the host machine.
            p.ApiKeyEnc = req.ApiKey;
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
