using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Codex (ChatGPT) OAuth-backed provider endpoints. The CLI handles the
///   browser-side OAuth dance against auth.openai.com, then POSTs the
///   resulting token set here so the platform can:
///     1. Persist it as a tenant-shared provider entry
///     2. Refresh the access_token in the background before expiry
///     3. Hand it back through /api/v1/providers/active for any CLI/web
///        session that picks this provider.
///
///   The "ApiKeyEnc" column gets the (still plaintext — TODO envelope crypto)
///   access_token so existing consumers keep working unchanged.
/// </summary>
public static class CodexProviderEndpoints
{
    public static IEndpointRouteBuilder MapCodexProviderEndpoints(this IEndpointRouteBuilder app)
    {
        // CLI hands a full OAuth token set up to the platform. Upserts a
        // Codex provider row keyed by (tenant, provider=codex, name).
        app.MapPost("/api/v1/providers/connect/codex",  ConnectCodex).RequireAuthorization();
        // Same pattern, for Claude/Anthropic (claude.ai or Console OAuth).
        app.MapPost("/api/v1/providers/connect/claude", ConnectClaude).RequireAuthorization();

        // Server-side refresh nudge — admin can force a token refresh from
        // the web admin if the background job is stuck.
        app.MapPost("/api/v1/providers/{id:guid}/refresh", RefreshNow).RequireAuthorization();

        return app;
    }

    public record ConnectClaudeRequest(
        string  AccessToken,
        string? RefreshToken,
        string  AccountUuid,            // Anthropic account UUID (token exchange'den)
        string? OrganizationUuid,
        string? Email,
        long?   ExpiresAt,              // Unix epoch seconds (opencode'un sakladığı format)
        string? Name,
        string? Model,                  // claude-sonnet-4-7, claude-opus-4-7 vb.
        bool    MakeDefault
    );

    private static async Task<IResult> ConnectClaude(
        ConnectClaudeRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrEmpty(req.AccessToken) || string.IsNullOrEmpty(req.AccountUuid))
            return Results.BadRequest(new { error = "access_token and account_uuid required" });

        var name = string.IsNullOrEmpty(req.Name)
            ? $"Claude · {req.Email ?? req.AccountUuid[..Math.Min(8, req.AccountUuid.Length)]}"
            : req.Name;
        var expiresAt = req.ExpiresAt.HasValue
            ? DateTimeOffset.FromUnixTimeSeconds(req.ExpiresAt.Value)
            : DateTimeOffset.UtcNow.AddHours(1);   // Anthropic default ~1 saat

        var existing = await db.ProviderConfigs.FirstOrDefaultAsync(p =>
            p.TenantId == tc.TenantId && p.Provider == "anthropic" && p.AccountId == req.AccountUuid);

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

        existing.ApiKeyEnc            = req.AccessToken;
        existing.RefreshTokenEnc      = req.RefreshToken;
        existing.AccountId            = req.AccountUuid;
        existing.AccessTokenExpiresAt = expiresAt;
        existing.LastRefreshedAt      = DateTimeOffset.UtcNow;
        existing.DefaultModel         = req.Model ?? existing.DefaultModel ?? "claude-sonnet-4-7";
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
            model     = existing.DefaultModel,
            expiresAt = existing.AccessTokenExpiresAt,
            isDefault = existing.IsDefault,
        });
    }

    public record ConnectCodexRequest(
        string AccessToken,
        string? RefreshToken,
        string? IdToken,
        string AccountId,
        int    ExpiresIn,        // seconds, from token endpoint
        string? Name,            // optional friendly label; defaults to email-or-account
        string? Model,           // codexplan / codexspark
        bool   MakeDefault
    );

    private static async Task<IResult> ConnectCodex(
        ConnectCodexRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrEmpty(req.AccessToken) || string.IsNullOrEmpty(req.AccountId))
            return Results.BadRequest(new { error = "access_token and account_id required" });

        var name = string.IsNullOrEmpty(req.Name)
            ? $"Codex · {req.AccountId[..Math.Min(8, req.AccountId.Length)]}"
            : req.Name;
        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, req.ExpiresIn));

        var existing = await db.ProviderConfigs.FirstOrDefaultAsync(p =>
            p.TenantId == tc.TenantId && p.Provider == "codex" && p.AccountId == req.AccountId);

        if (existing is null)
        {
            existing = new ProviderConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tc.TenantId.Value,
                Provider = "codex",
                Name = name,
                BaseUrl = "https://chatgpt.com/backend-api/codex",
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

        existing.ApiKeyEnc           = req.AccessToken;
        existing.RefreshTokenEnc     = req.RefreshToken;
        existing.IdTokenEnc          = req.IdToken;
        existing.AccountId           = req.AccountId;
        existing.AccessTokenExpiresAt = expiresAt;
        existing.LastRefreshedAt     = DateTimeOffset.UtcNow;
        existing.DefaultModel        = req.Model ?? existing.DefaultModel ?? "codexplan";
        existing.UpdatedAt           = DateTimeOffset.UtcNow;

        if (req.MakeDefault)
        {
            // Demote other Codex defaults so isDefault is unique-ish per type.
            var others = await db.ProviderConfigs
                .Where(p => p.TenantId == tc.TenantId && p.Provider == "codex" && p.Id != existing.Id && p.IsDefault)
                .ToListAsync();
            foreach (var o in others) o.IsDefault = false;
            existing.IsDefault = true;
        }

        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            id = existing.Id,
            name = existing.Name,
            model = existing.DefaultModel,
            expiresAt = existing.AccessTokenExpiresAt,
            isDefault = existing.IsDefault,
        });
    }

    private static async Task<IResult> RefreshNow(
        Guid id, AltarisDbContext db, ITenantContext tc, IHttpClientFactory http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var p = await db.ProviderConfigs.FirstOrDefaultAsync(x =>
            x.Id == id && x.TenantId == tc.TenantId && x.AuthKind == "oauth");
        if (p is null) return Results.NotFound();

        var ok = await CodexTokenRefresher.RefreshOneAsync(p, db, http);
        return ok
            ? Results.Ok(new { id = p.Id, expiresAt = p.AccessTokenExpiresAt })
            : Results.Problem("refresh failed — see server logs", statusCode: 502);
    }
}

/// <summary>
///   Calls auth.openai.com's token endpoint with the stored refresh_token to
///   mint a new access_token. Shared between the manual /refresh endpoint and
///   the background hosted service.
/// </summary>
public static class CodexTokenRefresher
{
    private const string TokenUrl = "https://auth.openai.com/oauth/token";
    private const string ClientId  = "app_EMoamEEZ73f0CkXaXp7hrann";   // Codex CLI public client

    public static async Task<bool> RefreshOneAsync(
        ProviderConfig p, AltarisDbContext db, IHttpClientFactory httpFactory)
    {
        if (string.IsNullOrEmpty(p.RefreshTokenEnc)) return false;
        try
        {
            using var client = httpFactory.CreateClient();
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"]    = "refresh_token",
                ["refresh_token"] = p.RefreshTokenEnc,
                ["client_id"]     = ClientId,
            });
            using var res = await client.PostAsync(TokenUrl, form);
            if (!res.IsSuccessStatusCode) return false;
            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var access = root.GetProperty("access_token").GetString();
            var expires = root.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;
            var newRefresh = root.TryGetProperty("refresh_token", out var r) ? r.GetString() : p.RefreshTokenEnc;
            var newId      = root.TryGetProperty("id_token", out var i) ? i.GetString() : p.IdTokenEnc;
            if (string.IsNullOrEmpty(access)) return false;

            p.ApiKeyEnc = access;
            p.RefreshTokenEnc = newRefresh;
            p.IdTokenEnc = newId;
            p.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, expires));
            p.LastRefreshedAt = DateTimeOffset.UtcNow;
            p.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }
}
