using Altaris.Infrastructure.MultiTenancy;

namespace Altaris.Api.Permissions;

/// <summary>
///   Per-user resource ownership helpers. Tenant_admin / platform_admin
///   her zaman bypass eder ("admin tümünü görür"). Diğer üyeler sadece
///   kendi yarattıkları kaynakları (vault, agent, vb.) okur ve düzenler.
/// </summary>
public static class OwnershipAuth
{
    public static bool IsAdmin(HttpContext http)
    {
        var roles = AdminAuth.ExtractRealmRoles(http);
        return roles.Contains("tenant_admin") || roles.Contains("platform_admin");
    }

    /// <summary>
    ///   true: kullanıcı admin VEYA kaynağın sahibi. false: ne biri ne diğeri.
    ///   ownerId null ise (eski kayıt — owner bilgisi yok) admin'e açık, üyeye kapalı
    ///   davranılır (güvenli default).
    /// </summary>
    public static bool OwnsOrAdmin(HttpContext http, ITenantContext tc, Guid? ownerId)
    {
        if (IsAdmin(http)) return true;
        if (tc.UserId is null || ownerId is null) return false;
        return ownerId == tc.UserId;
    }
}
