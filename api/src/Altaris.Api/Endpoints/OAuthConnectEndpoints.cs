using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Web tarayıcısından OAuth provider bağlama (CLI'sız).
///
///   Akış (Claude):
///     1) POST /providers/oauth/start/claude  → backend PKCE verifier+challenge+state üretir,
///        Redis'e (state→verifier, 10 dk TTL) yazar, authorize_url döner.
///     2) Frontend yeni sekmede authorize_url'i açar. User OAuth'u tamamlar, Anthropic
///        platform.claude.com/oauth/code/callback'e redirect eder, kod ekrana yazar.
///     3) User kodu kopyalar, web modal'a yapıştırır.
///     4) POST /providers/oauth/exchange/claude {code, state} → backend verifier'ı bulur,
///        token endpoint'ten access+refresh token mint eder, /me/profile çağırır,
///        provider_configs upsert eder. Mevcut ConnectClaude logic'i ile aynı sonuç.
///
///   Codex (auth.openai.com) sadece loopback redirect_uri kabul ettiğinden web flow yok;
///   bu kullanıcıya UI'dan CLI komutu olarak gösteriliyor.
/// </summary>
public static class OAuthConnectEndpoints
{
    private const string AnthropicTokenUrl            = "https://platform.claude.com/v1/oauth/token";
    private const string AnthropicAuthorizeUrl        = "https://claude.com/cai/oauth/authorize";       // claude.ai (Pro/Max/Free)
    private const string AnthropicConsoleAuthorizeUrl = "https://platform.claude.com/oauth/authorize";  // Console (API kullanıcıları)
    private const string AnthropicProfileUrl   = "https://api.anthropic.com/api/oauth/profile";
    private const string AnthropicClientId     = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
    private const string AnthropicRedirectUri  = "https://platform.claude.com/oauth/code/callback";
    private const string AnthropicScopes       = "user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

    public static IEndpointRouteBuilder MapOAuthConnectEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/providers/oauth/start/claude",    StartClaude   ).RequireAuthorization();
        app.MapPost("/api/v1/providers/oauth/exchange/claude", ExchangeClaude).RequireAuthorization();
        return app;
    }

    private record StartRequest(string? Source);  // "claude_ai" (default) | "console"
    private record StartResponse(string AuthorizeUrl, string State, string RedirectUri);
    private record ExchangeRequest(string Code, string State, bool MakeDefault, string? Model);

    private static async Task<IResult> StartClaude(
        StartRequest? req, IConnectionMultiplexer redis, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        // CLI src/services/oauth/crypto.ts ile aynı: verifier=randomBytes(32),
        // challenge=SHA256(verifier), state=randomBytes(32) — hepsi base64url
        var verifier  = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var challenge = Base64UrlEncode(SHA256.HashData(Encoding.UTF8.GetBytes(verifier)));
        var state     = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

        // Redis'e state → {verifier, tenantId, userId} 10dk TTL
        var db = redis.GetDatabase();
        var stateData = JsonSerializer.Serialize(new
        {
            verifier,
            tenantId = tc.TenantId.Value.ToString(),
            userId   = tc.UserId?.ToString(),
        });
        await db.StringSetAsync($"oauth:claude:{state}", stateData, TimeSpan.FromMinutes(10));

        // Source seçimi: claude_ai (Pro/Max kullanıcıları) veya console (API kullanıcıları)
        var source = (req?.Source ?? "claude_ai").ToLowerInvariant();
        var authBase = source == "console" ? AnthropicConsoleAuthorizeUrl : AnthropicAuthorizeUrl;

        // CLI buildAuthUrl param sırası birebir (URLSearchParams.append order):
        //   code=true (Altaris upsell flag, claude.ai authorize için)
        //   client_id, response_type=code, redirect_uri, scope, code_challenge,
        //   code_challenge_method=S256, state
        // URLSearchParams form-urlencoded yapar (boşluk → +). EscapeDataString %20
        // verir; UrlEncode + verir → CLI ile aynı hash'lenmiş encoded string.
        var qs = new[]
        {
            ("code", "true"),
            ("client_id", AnthropicClientId),
            ("response_type", "code"),
            ("redirect_uri", AnthropicRedirectUri),
            ("scope", AnthropicScopes),
            ("code_challenge", challenge),
            ("code_challenge_method", "S256"),
            ("state", state),
        };
        var authorizeUrl = authBase + "?" + string.Join("&",
            qs.Select(p => $"{System.Net.WebUtility.UrlEncode(p.Item1)}={System.Net.WebUtility.UrlEncode(p.Item2)}"));

        return Results.Ok(new StartResponse(authorizeUrl, state, AnthropicRedirectUri));
    }

    private static async Task<IResult> ExchangeClaude(
        ExchangeRequest req,
        IConnectionMultiplexer redis,
        IHttpClientFactory hf,
        AltarisDbContext db,
        ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.State))
            return Results.BadRequest(new { error = "code + state required" });

        // State'i Redis'ten al, verifier'ı çıkar, tek-kullanım için sil
        var rdb = redis.GetDatabase();
        var stateRaw = await rdb.StringGetAsync($"oauth:claude:{req.State}");
        if (stateRaw.IsNullOrEmpty)
            return Results.BadRequest(new { error = "state expired or invalid" });
        await rdb.KeyDeleteAsync($"oauth:claude:{req.State}");

        using var stateDoc = JsonDocument.Parse(stateRaw.ToString());
        var verifier = stateDoc.RootElement.GetProperty("verifier").GetString()!;
        var stateTenant = stateDoc.RootElement.GetProperty("tenantId").GetString();
        if (stateTenant != tc.TenantId.Value.ToString())
            return Results.BadRequest(new { error = "tenant mismatch" });

        // Anthropic kod formatı: "<code>#<state>" — # varsa böl, yoksa ham code
        var codeOnly = req.Code.Trim();
        if (codeOnly.Contains('#')) codeOnly = codeOnly.Split('#', 2)[0];

        // Token exchange
        var http = hf.CreateClient();
        var body = JsonSerializer.Serialize(new
        {
            grant_type    = "authorization_code",
            code          = codeOnly,
            redirect_uri  = AnthropicRedirectUri,
            client_id     = AnthropicClientId,
            code_verifier = verifier,
            state         = req.State,
        });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var tokenRes = await http.PostAsync(AnthropicTokenUrl, content);
        if (!tokenRes.IsSuccessStatusCode)
        {
            var err = await tokenRes.Content.ReadAsStringAsync();
            return Results.Problem(detail: $"token exchange failed ({(int)tokenRes.StatusCode}): {err[..Math.Min(300, err.Length)]}");
        }
        var tokenJson = await tokenRes.Content.ReadAsStringAsync();
        using var tokenDoc = JsonDocument.Parse(tokenJson);
        var root = tokenDoc.RootElement;
        var accessToken  = root.GetProperty("access_token").GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn    = root.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;

        // Profile lookup → account_uuid + email (CLI getOauthProfile.ts ile aynı)
        // CLI sadece Authorization + Content-Type yolluyor; anthropic-beta YOK
        using var profileReq = new HttpRequestMessage(HttpMethod.Get, AnthropicProfileUrl);
        profileReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        using var profRes = await http.SendAsync(profileReq);
        string? accountUuid = null, email = null;
        if (profRes.IsSuccessStatusCode)
        {
            var profJson = await profRes.Content.ReadAsStringAsync();
            using var pd = JsonDocument.Parse(profJson);
            var pr = pd.RootElement;
            if (pr.TryGetProperty("account", out var acct))
            {
                if (acct.TryGetProperty("uuid", out var u))    accountUuid = u.GetString();
                // CLI iki farklı field kullanıyor — email_address (client.ts) ve email (claudeConnect)
                if (acct.TryGetProperty("email_address", out var em1) && !string.IsNullOrEmpty(em1.GetString())) email = em1.GetString();
                else if (acct.TryGetProperty("email", out var em2)) email = em2.GetString();
            }
            else
            {
                if (pr.TryGetProperty("uuid", out var u))   accountUuid = u.GetString();
                if (pr.TryGetProperty("email", out var em)) email       = em.GetString();
            }
        }
        else
        {
            var profErr = await profRes.Content.ReadAsStringAsync();
            return Results.Problem(detail: $"profile fetch HTTP {(int)profRes.StatusCode}: {profErr[..Math.Min(200, profErr.Length)]}");
        }
        if (string.IsNullOrEmpty(accountUuid))
            return Results.Problem(detail: "profile response'da account.uuid yok");

        // ConnectClaude logic'iyle aynı upsert
        var name = $"Claude · {email ?? accountUuid[..Math.Min(8, accountUuid.Length)]}";
        var existing = await db.ProviderConfigs.FirstOrDefaultAsync(p =>
            p.TenantId == tc.TenantId && p.Provider == "anthropic" && p.AccountId == accountUuid);

        if (existing is null)
        {
            existing = new ProviderConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tc.TenantId.Value,
                Provider = "anthropic",
                Name = name,
                BaseUrl = "https://api.anthropic.com",
                AuthKind = "oauth",
                Enabled = true,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            db.ProviderConfigs.Add(existing);
        }
        else
        {
            existing.Name = name;
        }

        existing.ApiKeyEnc            = accessToken;
        existing.RefreshTokenEnc      = refreshToken;
        existing.AccountId            = accountUuid;
        existing.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, expiresIn));
        existing.LastRefreshedAt      = DateTimeOffset.UtcNow;
        existing.DefaultModel         = req.Model ?? existing.DefaultModel ?? "claude-opus-4-7";
        existing.UpdatedAt            = DateTimeOffset.UtcNow;

        if (req.MakeDefault)
        {
            var others = await db.ProviderConfigs
                .Where(p => p.TenantId == tc.TenantId && p.Provider == "anthropic" && p.Id != existing.Id && p.IsDefault)
                .ToListAsync();
            foreach (var o in others) o.IsDefault = false;
            existing.IsDefault = true;
        }

        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            id        = existing.Id,
            name      = existing.Name,
            email,
            accountUuid,
            model     = existing.DefaultModel,
            expiresAt = existing.AccessTokenExpiresAt,
            isDefault = existing.IsDefault,
        });
    }

    private static string Base64UrlEncode(byte[] bytes)
        => Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    private static string Base64UrlEncode(string s)
        => s.Replace("+", "-").Replace("/", "_").TrimEnd('=');
}
