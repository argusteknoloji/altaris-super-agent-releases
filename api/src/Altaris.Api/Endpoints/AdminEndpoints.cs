using System.Security.Cryptography;
using System.Text;
using Altaris.Api.Permissions;
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
        var grp = app.MapGroup("/api/v1/admin").RequireAdminRole();

        // ===== USERS (Keycloak + local mirror) =====
        grp.MapGet("/users", ListUsers);
        grp.MapPost("/users", CreateUser);
        grp.MapPatch("/users/{userId:guid}", UpdateUser);
        grp.MapDelete("/users/{userId:guid}", DeleteUser);
        grp.MapPost("/users/{userId:guid}/reset-password", ResetPassword);
        // Capability management (per-user override on top of role defaults)
        grp.MapGet ("/users/{userId:guid}/capabilities",      GetUserCapabilities);
        grp.MapPut ("/users/{userId:guid}/capabilities",      ReplaceUserCapabilities);
        // Catalogue (registry + role defaults) for the admin UI matrix
        grp.MapGet ("/capabilities/catalog",                  GetCapabilityCatalog);
        // Active Keycloak SSO sessions (list / kill one / kill all)
        grp.MapGet    ("/users/{userId:guid}/sso-sessions",                  ListUserSessions);
        grp.MapDelete ("/users/{userId:guid}/sso-sessions/{sessionId}",      KillUserSession);
        grp.MapPost   ("/users/{userId:guid}/sso-sessions/logout-all",       LogoutAllSessions);
        // 2FA enforcement
        grp.MapPost   ("/users/{userId:guid}/require-totp",                  RequireTotp);
        grp.MapPost   ("/users/{userId:guid}/remove-totp",                   RemoveTotp);
        // KVKK / GDPR
        grp.MapGet    ("/users/{userId:guid}/data-export",                   DataExport);
        grp.MapPost   ("/users/{userId:guid}/data-erase",                    DataErase);

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

        // ===== TENANT SETTINGS (require_totp, audit retention) =====
        grp.MapGet ("/tenant-settings",                GetTenantSettings);
        grp.MapPatch("/tenant-settings",               UpdateTenantSettings);
        grp.MapPost("/tenant-settings/apply-totp-all", ApplyTotpToAllUsers);

        return app;
    }

    // ---- TENANT SETTINGS ----
    public record TenantSettingsDto(bool RequireTotp, int? AuditRetentionDays);
    public record TenantSettingsUpdate(bool? RequireTotp, int? AuditRetentionDays);

    private static async Task<IResult> GetTenantSettings(AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var t = await db.Tenants.AsNoTracking()
            .Where(x => x.Id == tc.TenantId)
            .Select(x => new TenantSettingsDto(x.RequireTotp, x.AuditRetentionDays))
            .FirstOrDefaultAsync();
        return t is null ? Results.NotFound() : Results.Ok(t);
    }

    private static async Task<IResult> UpdateTenantSettings(TenantSettingsUpdate req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == tc.TenantId);
        if (t is null) return Results.NotFound();
        if (req.RequireTotp is not null)         t.RequireTotp = req.RequireTotp.Value;
        // 0 = "sonsuz tut" (NULL'a normalize); negatif kabul edilmez.
        if (req.AuditRetentionDays is not null)  t.AuditRetentionDays = req.AuditRetentionDays.Value <= 0 ? null : req.AuditRetentionDays.Value;
        t.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(new TenantSettingsDto(t.RequireTotp, t.AuditRetentionDays));
    }

    /// <summary>
    ///   require_totp aktif edildiğinde mevcut kullanıcılara da uygulamak için —
    ///   her tenant user'ına CONFIGURE_TOTP required-action push'lar. Kullanıcılar
    ///   bir sonraki login'de TOTP kurmaya yönlendirilir.
    /// </summary>
    private static async Task<IResult> ApplyTotpToAllUsers(AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var subs = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tc.TenantId)
            .Select(u => u.KeycloakSub)
            .ToListAsync();
        int ok = 0, fail = 0;
        foreach (var s in subs)
        {
            try { await kc.RequireTotpAsync(s); ok++; }
            catch { fail++; }
        }
        return Results.Ok(new { applied = ok, failed = fail, total = subs.Count });
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
            if (!AdminAuth.ExtractRealmRoles(http).Contains("platform_admin"))
                return Results.Forbid();
            var target = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == targetId);
            if (target is null) return Results.BadRequest(new { error = "target tenant not found" });
            effectiveTenantId   = target.Id;
            effectiveTenantSlug = target.Slug;
        }

        // Aynı e-posta DB'de zaten varsa erken dön (UI net cevap görsün)
        var emailNorm = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == emailNorm))
            return Results.Conflict(new { error = "user_email_exists", detail = $"Bu e-posta ({req.Email}) zaten kayıtlı." });

        string kcId;
        try
        {
            kcId = await kc.CreateUserAsync(new CreateKeycloakUserRequest(
                Email: req.Email,
                FirstName: req.FirstName,
                LastName: req.LastName,
                TenantSlug: effectiveTenantSlug,
                Password: req.Password,
                TemporaryPassword: req.Temporary,
                RealmRoles: new[] { role }
            ));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("409"))
        {
            // Keycloak: User exists with same username / email
            return Results.Conflict(new { error = "keycloak_user_exists", detail = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // Diğer KC hataları (4xx body dahil) — UI mesajı görsün
            return Results.Problem(detail: ex.Message, statusCode: 502, title: "Keycloak hatası");
        }
        catch (Exception ex)
        {
            return Results.Problem(detail: ex.Message, statusCode: 500, title: "Kullanıcı oluşturulamadı");
        }
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

        // Tenant'ta require_totp aktifse yeni kullanıcıya CONFIGURE_TOTP push'la —
        // bir sonraki login'de TOTP setup wizard'ına yönlenecek.
        var tenantRequiresTotp = await db.Tenants.AsNoTracking()
            .Where(x => x.Id == effectiveTenantId)
            .Select(x => x.RequireTotp)
            .FirstOrDefaultAsync();
        if (tenantRequiresTotp)
        {
            try { await kc.RequireTotpAsync(kcId); } catch { /* best-effort, audit görür */ }
        }

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

    // ---- CAPABILITIES ----
    private static async Task<IResult> GetCapabilityCatalog() => await Task.FromResult(Results.Ok(new
    {
        all = Altaris.Domain.Permissions.Capabilities.All,
        defaults = new
        {
            tenant_member  = Altaris.Domain.Permissions.RoleDefaults.Member.OrderBy(s => s),
            tenant_admin   = Altaris.Domain.Permissions.RoleDefaults.TenantAdmin.OrderBy(s => s),
            platform_admin = Altaris.Domain.Permissions.RoleDefaults.PlatformAdmin.OrderBy(s => s),
        }
    }));

    private static async Task<IResult> GetUserCapabilities(Guid userId, AltarisDbContext db, ITenantContext tc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();

        var defaults = Altaris.Domain.Permissions.RoleDefaults.ForRole(u.Role);
        var overrides = await db.UserCapabilities.AsNoTracking()
            .Where(c => c.UserId == userId)
            .Select(c => new { c.Capability, c.Effect, c.GrantedAt })
            .ToListAsync();
        var effective = new HashSet<string>(defaults);
        foreach (var o in overrides)
        {
            if (o.Effect == "allow") effective.Add(o.Capability);
            else if (o.Effect == "deny") effective.Remove(o.Capability);
        }
        return Results.Ok(new
        {
            userId,
            role = u.Role,
            defaults = defaults.OrderBy(s => s),
            overrides,
            effective = effective.OrderBy(s => s),
        });
    }

    public record CapabilityOverrideEntry(string Capability, string Effect);
    public record ReplaceUserCapabilitiesRequest(IReadOnlyList<CapabilityOverrideEntry> Overrides);

    /// <summary>
    ///   Tüm override'ları wholesale değiştir. UI matrix bu şekilde gönderir
    ///   (delete-all + insert) — küçük tablo, yarış yok, basit semantik.
    /// </summary>
    private static async Task<IResult> ReplaceUserCapabilities(
        Guid userId, ReplaceUserCapabilitiesRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();

        var validCaps = new HashSet<string>(Altaris.Domain.Permissions.Capabilities.All);
        var entries = (req.Overrides ?? new List<CapabilityOverrideEntry>())
            .Where(e => validCaps.Contains(e.Capability))
            .Where(e => e.Effect == "allow" || e.Effect == "deny")
            .GroupBy(e => e.Capability)
            .Select(g => g.Last())
            .ToList();

        await db.UserCapabilities
            .Where(c => c.UserId == userId)
            .ExecuteDeleteAsync();
        foreach (var e in entries)
        {
            db.UserCapabilities.Add(new Domain.Entities.UserCapability
            {
                Id = Guid.NewGuid(),
                TenantId = tc.TenantId.Value,
                UserId = userId,
                Capability = e.Capability,
                Effect = e.Effect,
                GrantedBy = tc.UserId,
                GrantedAt = DateTimeOffset.UtcNow,
            });
        }
        await db.SaveChangesAsync();
        return Results.Ok(new { count = entries.Count });
    }

    // ---- SSO SESSIONS (Keycloak) ----
    private static async Task<IResult> ListUserSessions(Guid userId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        var rows = await kc.ListSessionsAsync(u.KeycloakSub);
        return Results.Ok(rows);
    }

    private static async Task<IResult> KillUserSession(Guid userId, string sessionId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.DeleteSessionAsync(sessionId);
        return Results.NoContent();
    }

    private static async Task<IResult> LogoutAllSessions(Guid userId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.LogoutAllAsync(u.KeycloakSub);
        return Results.NoContent();
    }

    // ---- 2FA ----
    private static async Task<IResult> RequireTotp(Guid userId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.RequireTotpAsync(u.KeycloakSub);
        return Results.NoContent();
    }
    private static async Task<IResult> RemoveTotp(Guid userId, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        await kc.RemoveTotpAsync(u.KeycloakSub);
        return Results.NoContent();
    }

    // ---- KVKK / GDPR ----
    /// <summary>
    ///   "Right to data portability" — kullanıcının tenant'taki tüm
    ///   verisi tek JSON döküm (sessions/messages/audit/api_keys/vaults metadata).
    ///   Vault dosya içerikleri filesystem'de — bu endpoint metadata özetini
    ///   döner; full vault export ayrı bir endpoint olabilir.
    /// </summary>
    private static async Task<IResult> DataExport(Guid userId, AltarisDbContext db, ITenantContext tc)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();

        var sessions = await db.Sessions.AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => new { s.Id, s.Source, s.Provider, s.Model, s.Title, s.Status, s.StartedAt, s.EndedAt })
            .ToListAsync();
        var messages = await db.SessionMessages.AsNoTracking()
            .Join(db.Sessions, m => m.SessionId, s => s.Id, (m, s) => new { m, s })
            .Where(x => x.s.UserId == userId)
            .Select(x => new { x.m.Id, x.m.SessionId, x.m.Role, x.m.Content, x.m.CreatedAt })
            .ToListAsync();
        var audits = await db.AuditEvents.AsNoTracking()
            .Where(a => a.UserId == userId)
            .Select(a => new { a.Id, a.Actor, a.Action, a.ResourceType, a.ResourceId, a.Ip, a.OccurredAt })
            .ToListAsync();
        var apiKeys = await db.ApiKeys.AsNoTracking()
            .Where(k => k.UserId == userId)
            .Select(k => new { k.Id, k.Name, k.Prefix, k.CreatedAt, k.LastUsedAt, k.RevokedAt })
            .ToListAsync();
        var vaults = await db.Vaults.AsNoTracking()
            .Where(v => v.OwnerUserId == userId)
            .Select(v => new { v.Id, v.Slug, v.Name, v.Visibility, v.FileCount, v.ByteSize, v.CreatedAt, v.UpdatedAt })
            .ToListAsync();

        var bundle = new
        {
            exportedAt = DateTimeOffset.UtcNow,
            requestedBy = tc.UserEmail,
            user = new { u.Id, u.Email, u.DisplayName, u.Role, u.KeycloakSub, u.CreatedAt },
            tenant = new { id = tc.TenantId, slug = tc.TenantSlug },
            sessions, messages, audits, apiKeys, vaults,
        };
        var bytes = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(bundle, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        return Results.File(
            bytes,
            contentType: "application/json",
            fileDownloadName: $"altaris-user-export-{u.Email}-{DateTimeOffset.UtcNow:yyyyMMdd-HHmm}.json"
        );
    }

    public record DataEraseRequest(string Confirm);

    /// <summary>
    ///   "Right to erasure" — KVKK 11. madde / GDPR Article 17.
    ///   Mesajları + audit log'u + api_keys'i ANONIMIZE eder (hard delete yerine
    ///   PII'yi kaldırır), Keycloak hesabını + lokal user row'unu hard-delete eder.
    ///   Vault'lar OwnerUserId üzerinden FK ile düşeceği için CASCADE; canonical
    ///   bytes filesystem'de kalır (admin manuel temizleyebilir).
    /// </summary>
    private static async Task<IResult> DataErase(Guid userId, DataEraseRequest req, AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        var u = await db.Users.FirstOrDefaultAsync(x => x.Id == userId && x.TenantId == tc.TenantId);
        if (u is null) return Results.NotFound();
        if (req.Confirm != $"erase {u.Email}")
            return Results.BadRequest(new { error = "confirm_required", expected = $"erase {u.Email}" });

        // 1) Audit row'da PII'yi anonymize et (FK + log invariant kalsın)
        await db.AuditEvents
            .Where(a => a.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Actor, "[erased]")
                .SetProperty(a => a.UserId, (Guid?)null)
                .SetProperty(a => a.Ip, (string?)null)
                .SetProperty(a => a.UserAgent, (string?)null));

        // 2) Session messages content'ini sil (transcript okunamaz hale getir)
        var sessionIds = await db.Sessions.Where(s => s.UserId == userId).Select(s => s.Id).ToListAsync();
        if (sessionIds.Count > 0)
        {
            await db.SessionMessages
                .Where(m => sessionIds.Contains(m.SessionId))
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.Content, "{\"text\":\"[erased]\"}"));
        }

        // 3) Keycloak hesabını sil
        try { await kc.DeleteUserAsync(u.KeycloakSub); } catch { /* zaten gitmiş olabilir */ }

        // 4) Lokal user row'unu sil — sessions/api_keys/vaults FK CASCADE düşer
        db.Users.Remove(u);
        await db.SaveChangesAsync();

        // 5) Audit kaydı (kim sildi)
        db.AuditEvents.Add(new Domain.Entities.AuditEvent
        {
            TenantId = tc.TenantId,
            UserId = tc.UserId,
            Actor = tc.UserEmail ?? "unknown",
            Action = "user.kvkk_erased",
            ResourceType = "user",
            ResourceId = u.Id.ToString(),
            Payload = "{\"reason\":\"data_subject_request\"}",
            OccurredAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
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
        if (!AdminAuth.ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var rows = await db.Tenants.OrderBy(t => t.Slug)
            .Select(t => new { t.Id, t.Slug, t.Name, t.Status, t.CreatedAt })
            .ToListAsync();
        return Results.Ok(rows);
    }

    public record CreateTenantRequest(string Slug, string Name);

    private static async Task<IResult> CreateTenant(HttpContext http, CreateTenantRequest req, AltarisDbContext db)
    {
        if (!AdminAuth.ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
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
        if (!AdminAuth.ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
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
        if (!AdminAuth.ExtractRealmRoles(http).Contains("platform_admin")) return Results.Forbid();
        var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == id);
        if (t is null) return Results.NotFound();
        db.Tenants.Remove(t);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // ---- AUDIT ----
    private static async Task<IResult> ListAudit(
        AltarisDbContext db, ITenantContext tc,
        string? actor, string? action, string? resourceType, string? from, string? to, string? q,
        int take = 200, int skip = 0)
    {
        var query = db.AuditEvents.Where(a => a.TenantId == tc.TenantId);
        if (!string.IsNullOrEmpty(actor))        query = query.Where(a => EF.Functions.ILike(a.Actor, $"%{actor}%"));
        if (!string.IsNullOrEmpty(action))       query = query.Where(a => EF.Functions.ILike(a.Action, $"%{action}%"));
        if (!string.IsNullOrEmpty(resourceType)) query = query.Where(a => a.ResourceType == resourceType);
        if (DateTimeOffset.TryParse(from, out var dFrom)) query = query.Where(a => a.OccurredAt >= dFrom);
        if (DateTimeOffset.TryParse(to,   out var dTo))   query = query.Where(a => a.OccurredAt <= dTo);
        if (!string.IsNullOrEmpty(q))
        {
            var like = $"%{q}%";
            query = query.Where(a =>
                EF.Functions.ILike(a.Actor, like) ||
                EF.Functions.ILike(a.Action, like) ||
                EF.Functions.ILike(a.ResourceType ?? "", like) ||
                EF.Functions.ILike(a.ResourceId ?? "", like) ||
                EF.Functions.ILike(a.Ip ?? "", like));
        }

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(a => a.OccurredAt)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 1000))
            .Select(a => new { a.Id, a.Actor, a.Action, a.ResourceType, a.ResourceId, a.Ip, a.OccurredAt })
            .ToListAsync();
        return Results.Ok(new { items = rows, total });
    }

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
