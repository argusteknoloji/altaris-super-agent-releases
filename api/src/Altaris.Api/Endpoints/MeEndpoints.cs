using System.Security.Cryptography;
using System.Text;
using Altaris.Domain.Entities;
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

        // Recovery codes — TOTP cihazı kaybedildiğinde kullanılır.
        app.MapGet ("/api/v1/me/recovery-codes/status",   GetRecoveryStatus ).RequireAuthorization();
        app.MapPost("/api/v1/me/recovery-codes/generate", GenerateRecoveryCodes).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> GetRecoveryStatus(AltarisDbContext db, ITenantContext tc)
    {
        if (tc.UserId is null) return Results.Forbid();
        var unused = await db.Set<UserRecoveryCode>()
            .Where(c => c.UserId == tc.UserId && c.UsedAt == null)
            .CountAsync();
        var total = await db.Set<UserRecoveryCode>().CountAsync(c => c.UserId == tc.UserId);
        return Results.Ok(new { unused, total });
    }

    /// <summary>
    ///   10 adet tek-kullanımlık recovery code üretir (XXXX-XXXX format),
    ///   raw'ı bir kez döner; SHA-256 hash'lenmiş halleri DB'de saklar.
    ///   Mevcut kodları siler (yeni set tamamen üzerine yazar).
    /// </summary>
    private static async Task<IResult> GenerateRecoveryCodes(AltarisDbContext db, ITenantContext tc)
    {
        if (tc.UserId is null || tc.TenantId is null) return Results.Forbid();
        // Eskiyi temizle — yeni set tamamen yerini alır
        var existing = await db.Set<UserRecoveryCode>().Where(c => c.UserId == tc.UserId).ToListAsync();
        db.Set<UserRecoveryCode>().RemoveRange(existing);

        var codes = new List<string>(10);
        for (var i = 0; i < 10; i++)
        {
            // 8 byte random → 10-char base32-ish (XXXX-XXXX)
            var bytes = RandomNumberGenerator.GetBytes(5);
            var hex = Convert.ToHexString(bytes).ToUpperInvariant();
            var code = $"{hex[..4]}-{hex[4..]}";
            codes.Add(code);

            using var sha = SHA256.Create();
            var hash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(code)));
            db.Set<UserRecoveryCode>().Add(new UserRecoveryCode
            {
                Id = Guid.NewGuid(),
                UserId = tc.UserId.Value,
                TenantId = tc.TenantId.Value,
                CodeHash = hash,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }
        await db.SaveChangesAsync();
        return Results.Ok(new
        {
            codes,
            hint = "Save these codes now — they are only shown once. Use one to recover access if you lose your TOTP device."
        });
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
