using System.Security.Claims;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Middleware;

public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, AltarisDbContext db)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var tenantSlug = context.User.FindFirst("tid")?.Value;
        var sub = context.User.FindFirst("sub")?.Value
                  ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = context.User.FindFirst("email")?.Value
                    ?? context.User.FindFirst(ClaimTypes.Email)?.Value
                    ?? "unknown";

        if (string.IsNullOrEmpty(tenantSlug) || string.IsNullOrEmpty(sub))
        {
            var allClaims = string.Join(", ", context.User.Claims.Select(c => c.Type));
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync($"Missing tenant or subject claim. Saw: {allClaims}");
            return;
        }

        // Tenant override (X-Tenant-Override header) — sadece platform_admin
        // role'üne sahip kullanıcılar başka tenant olarak görüntüleyebilir.
        // Audit log kayıt yine kullanıcının kendi user row'una yazılır;
        // RLS context override edilen tenant'a göre kurulur.
        var overrideSlug = context.Request.Headers["X-Tenant-Override"].ToString();
        if (!string.IsNullOrEmpty(overrideSlug) && overrideSlug != tenantSlug)
        {
            var raClaim = context.User.FindFirst("realm_access")?.Value ?? "";
            if (raClaim.Contains("platform_admin"))
            {
                tenantSlug = overrideSlug;
            }
            // değilse override sessizce yok sayılır (header üreten kötü niyetli
            // istemci normal tenant'ında çalışmaya devam eder).
        }

        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == tenantSlug);
        if (tenant is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync($"Unknown tenant: {tenantSlug}");
            return;
        }

        // Set Postgres session var so RLS policies can filter
        var tenantIdParam = new Npgsql.NpgsqlParameter("tenant_id", tenant.Id.ToString());
        await db.Database.ExecuteSqlRawAsync("SELECT set_config('app.tenant_id', @tenant_id, true)", tenantIdParam);

        // Upsert user (just-in-time provisioning from Keycloak)
        var user = await db.Users.FirstOrDefaultAsync(u => u.TenantId == tenant.Id && u.KeycloakSub == sub);
        if (user is null)
        {
            user = new Domain.Entities.User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                KeycloakSub = sub,
                Email = email,
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        tenantContext.Set(tenant.Id, tenant.Slug, user.Id, user.Email);
        await _next(context);
    }
}
