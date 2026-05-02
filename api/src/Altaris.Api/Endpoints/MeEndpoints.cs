using Altaris.Infrastructure.Keycloak;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Self-service kullanıcı endpoint'leri — herkes kendi hesabıyla ilgili
///   bilgi alabilir / değiştirebilir, admin yetkisi gerektirmez.
/// </summary>
public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        // 2FA self-service
        app.MapGet ("/api/v1/me/totp/status",       GetTotpStatus     ).RequireAuthorization();
        app.MapPost("/api/v1/me/totp/disable",      DisableOwnTotp    ).RequireAuthorization();
        // Setup URL — kullanıcıyı Keycloak account console'una yönlendirir;
        // QR + verify orada yapılır, sonra kullanıcı return URL ile döner.
        app.MapGet ("/api/v1/me/totp/setup-url",    GetTotpSetupUrl   ).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> GetTotpStatus(AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        if (tc.UserId is null) return Results.Forbid();
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tc.UserId);
        if (u is null) return Results.NotFound();
        var enabled = await kc.HasTotpAsync(u.KeycloakSub);
        return Results.Ok(new { enabled, kind = "totp" });
    }

    private static async Task<IResult> DisableOwnTotp(AltarisDbContext db, ITenantContext tc, KeycloakAdminClient kc)
    {
        if (tc.UserId is null) return Results.Forbid();
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == tc.UserId);
        if (u is null) return Results.NotFound();
        await kc.RemoveTotpAsync(u.KeycloakSub);
        return Results.NoContent();
    }

    /// <summary>
    ///   Keycloak account console URL'i + return param — frontend kullanıcıyı
    ///   /realms/{realm}/account/totp sayfasına gönderir, QR setup orada
    ///   yapılır, ardından `referrer_uri` ile portala döner.
    /// </summary>
    private static IResult GetTotpSetupUrl(IConfiguration cfg, HttpContext ctx)
    {
        var publicAuthority = cfg["Keycloak:PublicAuthority"]
                              ?? cfg["Keycloak:Authority"]
                              ?? "http://localhost:8081/realms/altaris";
        var returnUrl = ctx.Request.Query["return"].ToString();
        if (string.IsNullOrEmpty(returnUrl))
            returnUrl = (cfg["Setup:PublicWebBase"] ?? "http://localhost:3000") + "/account/security";

        // Keycloak 21+ account console URL pattern: /realms/{r}/account/?#/security/signing-in
        // (eski versiyonlar /account/totp yoluna düşüyor — ikisi de redirect zinciri kuruyor).
        var url = $"{publicAuthority}/account/?referrer=altaris-web&referrer_uri={Uri.EscapeDataString(returnUrl)}#/security/signing-in";
        return Results.Ok(new { url, returnUrl });
    }
}
