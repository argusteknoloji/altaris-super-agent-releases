using Altaris.Domain.Permissions;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Infrastructure.Permissions;

/// <summary>
///   Calling code uses <c>RequireCapabilityAsync(ctx, "vault.write")</c>;
///   resolver merges role defaults + per-user overrides and returns 403
///   if the capability isn't effective. Result is request-scoped cached
///   so multiple checks on one request hit the DB once.
/// </summary>
public class CapabilityResolver
{
    private readonly AltarisDbContext _db;
    private readonly ITenantContext _tc;
    private readonly IHttpContextAccessor _http;
    private IReadOnlySet<string>? _cachedEffective;

    public CapabilityResolver(AltarisDbContext db, ITenantContext tc, IHttpContextAccessor http)
    {
        _db = db;
        _tc = tc;
        _http = http;
    }

    /// <summary>
    ///   JWT realm_access.roles içindeki en yüksek role'u döndür.
    ///   Lokal user.Role mirror sync'den önce bile doğru sonuç verir.
    /// </summary>
    private string ResolveRoleFromJwt()
    {
        var claim = _http.HttpContext?.User.FindFirst("realm_access")?.Value;
        if (string.IsNullOrEmpty(claim)) return "";
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(claim);
            if (!doc.RootElement.TryGetProperty("roles", out var arr)
                || arr.ValueKind != System.Text.Json.JsonValueKind.Array) return "";
            var roles = new HashSet<string>();
            foreach (var el in arr.EnumerateArray())
                if (el.GetString() is { } s) roles.Add(s);
            // Hierarchy: platform_admin > tenant_admin > tenant_member
            if (roles.Contains("platform_admin")) return "platform_admin";
            if (roles.Contains("tenant_admin"))   return "tenant_admin";
            if (roles.Contains("tenant_member"))  return "tenant_member";
        }
        catch { /* malformed claim */ }
        return "";
    }

    /// <summary>
    ///   Resolve the effective capability set for the current user.
    ///   Falls back to role defaults if local user row not found yet
    ///   (first-login race) — Keycloak claims become source of truth.
    /// </summary>
    public async Task<IReadOnlySet<string>> EffectiveAsync(CancellationToken ct = default)
    {
        if (_cachedEffective is not null) return _cachedEffective;

        // Role resolution priority:
        //   1) JWT realm_access (her zaman authoritative — Keycloak'ta admin
        //      rol değiştirdiyse anında etkili olsun, lokal mirror sync
        //      beklemesin).
        //   2) Lokal user.Role (mirror — JWT yoksa, örn. background worker).
        //   3) "tenant_member" (default).
        var userRole = ResolveRoleFromJwt();
        if (string.IsNullOrEmpty(userRole) && _tc.UserId is { } uid)
        {
            var local = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == uid)
                .Select(u => u.Role)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrEmpty(local)) userRole = local;
        }
        if (string.IsNullOrEmpty(userRole)) userRole = "tenant_member";

        var effective = new HashSet<string>(RoleDefaults.ForRole(userRole));

        // Apply per-user overrides
        if (_tc.UserId is { } uid2)
        {
            var overrides = await _db.UserCapabilities
                .AsNoTracking()
                .Where(c => c.UserId == uid2)
                .Select(c => new { c.Capability, c.Effect })
                .ToListAsync(ct);
            foreach (var o in overrides)
            {
                if (o.Effect == "allow") effective.Add(o.Capability);
                else if (o.Effect == "deny") effective.Remove(o.Capability);
            }
        }

        _cachedEffective = effective;
        return effective;
    }

    public async Task<bool> HasAsync(string capability, CancellationToken ct = default)
    {
        var set = await EffectiveAsync(ct);
        return set.Contains(capability);
    }
}

// HTTP extension method'u API project'inde (Altaris.Api/Permissions) — bu
// dosya yalnız domain + EF erişiyor, AspNetCore'a bağımlı değil.
