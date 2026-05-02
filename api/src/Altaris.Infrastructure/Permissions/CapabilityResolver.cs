using Altaris.Domain.Permissions;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
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
    private IReadOnlySet<string>? _cachedEffective;

    public CapabilityResolver(AltarisDbContext db, ITenantContext tc)
    {
        _db = db;
        _tc = tc;
    }

    /// <summary>
    ///   Resolve the effective capability set for the current user.
    ///   Falls back to role defaults if local user row not found yet
    ///   (first-login race) — Keycloak claims become source of truth.
    /// </summary>
    public async Task<IReadOnlySet<string>> EffectiveAsync(CancellationToken ct = default)
    {
        if (_cachedEffective is not null) return _cachedEffective;

        // Determine user's role (local mirror first, fallback to "tenant_member")
        var userRole = "tenant_member";
        if (_tc.UserId is { } uid)
        {
            var local = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == uid)
                .Select(u => u.Role)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrEmpty(local)) userRole = local;
        }

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
