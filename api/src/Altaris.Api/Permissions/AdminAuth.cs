namespace Altaris.Api.Permissions;

/// <summary>
///   Paylaşılan admin role guard — `/api/v1/admin/*` altındaki her MapGroup
///   için aynı tenant_admin/platform_admin filter'ını uygular. Daha önce her
///   endpoint dosyası kendi filter'ını yazıyordu (veya hiç yazmıyordu —
///   örn. DataSourceEndpoints), bu da yetkilendirme açığına yol açıyordu.
/// </summary>
public static class AdminAuth
{
    public static RouteGroupBuilder RequireAdminRole(this RouteGroupBuilder grp)
    {
        return (RouteGroupBuilder)grp
            .RequireAuthorization()
            .AddEndpointFilter(async (ctx, next) =>
            {
                var roles = ExtractRealmRoles(ctx.HttpContext);
                if (!roles.Contains("tenant_admin") && !roles.Contains("platform_admin"))
                    return Results.Forbid();
                return await next(ctx);
            });
    }

    public static IReadOnlySet<string> ExtractRealmRoles(HttpContext http)
    {
        var raClaim = http.User.FindFirst("realm_access")?.Value;
        if (string.IsNullOrEmpty(raClaim)) return new HashSet<string>();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(raClaim);
            if (doc.RootElement.TryGetProperty("roles", out var arr)
                && arr.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                return arr.EnumerateArray()
                    .Select(x => x.GetString() ?? "")
                    .Where(s => s.Length > 0)
                    .ToHashSet();
            }
        }
        catch { }
        return new HashSet<string>();
    }
}
