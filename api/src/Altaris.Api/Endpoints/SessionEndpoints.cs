using System.Collections.Concurrent;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Marker tipi — ILogger&lt;JitRefreshLogCategory&gt; için kategori adı sağlar.
///   Static endpoint sınıfı ILogger&lt;Self&gt; alamadığı için ayrı bir public tip.
/// </summary>
public sealed class JitRefreshLogCategory { }

/// <summary>
///   Session detail + transcript endpoints (own + admin views).
/// </summary>
public static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        // Tenant-scoped read of provider configs (chat picker — no secrets)
        app.MapGet("/api/v1/providers", async (AltarisDbContext db, ITenantContext tc) =>
        {
            if (tc.TenantId is null) return Results.Forbid();
            var rows = await db.ProviderConfigs
                .Where(p => p.TenantId == tc.TenantId && p.Enabled)
                .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Provider).ThenBy(p => p.Name)
                .Select(p => new { p.Id, p.Provider, p.Name, p.DefaultModel, p.IsDefault })
                .ToListAsync();
            return Results.Ok(rows);
        }).RequireAuthorization();

        // Tenant-scoped read of the ACTIVE provider with full credentials.
        // Used by altaris CLI bootstrap so users don't have to export env vars.
        // ?provider=lmstudio narrows by type; otherwise the tenant's default
        // (or first enabled) is returned. Writes a terminal.bootstrap audit row.
        //
        // JIT OAuth refresh: bootstrap path (CLI ALTARIS_OAUTH_TOKEN env) RT'yi
        // CLI'a vermiyor → CLI in-session refresh yapamıyor. Background sweep
        // (CodexTokenRefreshWorker) proaktif yeniliyor ama 5 dk poll aralığı
        // race window bırakıyor: o aralıkta /active çağrılırsa stale token
        // dönüp CLI'da 401 patlatıyordu. Burada response döndürmeden önce
        // expired-or-soon olanı senkron yeniliyoruz; refresh fail ise 503 dön
        // ki kullanıcı silently 401 spam'i yerine net hata görsün.
        app.MapGet("/api/v1/providers/active", async (
            AltarisDbContext db, ITenantContext tc, HttpContext ctx,
            IHttpClientFactory http, ILogger<JitRefreshLogCategory> log,
            string? provider, Guid? id) =>
        {
            if (tc.TenantId is null) return Results.Forbid();
            var q = db.ProviderConfigs.Where(p => p.TenantId == tc.TenantId && p.Enabled);
            if (id.HasValue) q = q.Where(p => p.Id == id.Value);
            if (!string.IsNullOrEmpty(provider)) q = q.Where(p => p.Provider == provider);
            // Entity (tracking) — RefreshOneAsync DB güncellemek için tracked entity bekliyor.
            var row = await q
                .OrderByDescending(p => p.IsDefault)
                .ThenBy(p => p.Provider).ThenBy(p => p.Name)
                .FirstOrDefaultAsync();
            if (row is null) return Results.NotFound(new { error = "no enabled provider configured" });

            // ── JIT refresh (anthropic + codex OAuth) ─────────────────────
            if (row.AuthKind == "oauth"
                && (row.Provider == "anthropic" || row.Provider == "codex"))
            {
                var soon = DateTimeOffset.UtcNow.AddMinutes(5);
                var expired = row.AccessTokenExpiresAt is null
                            || row.AccessTokenExpiresAt < soon;
                if (expired)
                {
                    var ok = await JitRefreshOAuthAsync(row, db, http, log);
                    if (!ok)
                    {
                        // RT muhtemelen revoke veya provider IdP down. 503 + audit:
                        // CLI tarafı stale token alıp 401 spam yapmasın, kullanıcı
                        // "Anthropic'i web panelden yeniden bağlayın" mesajı görsün.
                        db.AuditEvents.Add(new Domain.Entities.AuditEvent
                        {
                            TenantId = tc.TenantId, UserId = tc.UserId,
                            Actor = tc.UserEmail ?? "unknown",
                            Action = "providers.oauth.refresh_failed",
                            ResourceType = "provider_config", ResourceId = row.Id.ToString(),
                            Ip = ctx.Connection.RemoteIpAddress?.ToString(),
                            UserAgent = ctx.Request.Headers.UserAgent.ToString(),
                            Payload = JsonSerializer.Serialize(new { provider = row.Provider }),
                            OccurredAt = DateTimeOffset.UtcNow
                        });
                        await db.SaveChangesAsync();
                        return Results.Problem(
                            statusCode: 503,
                            title: "provider_oauth_refresh_failed",
                            detail: $"{row.Provider} OAuth token süresi doldu, otomatik yenileme başarısız. " +
                                    $"Web panelden provider'ı yeniden bağlayın (/admin/providers).");
                    }
                    // RefreshOneAsync tracked entity'i in-place güncelledi → row taze.
                }
            }

            db.AuditEvents.Add(new Domain.Entities.AuditEvent
            {
                TenantId = tc.TenantId, UserId = tc.UserId,
                Actor = tc.UserEmail ?? "unknown",
                Action = "providers.active.read",
                ResourceType = "provider_config", ResourceId = row.Id.ToString(),
                Ip = ctx.Connection.RemoteIpAddress?.ToString(),
                UserAgent = ctx.Request.Headers.UserAgent.ToString(),
                Payload = "{}", OccurredAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                id = row.Id, provider = row.Provider, name = row.Name,
                baseUrl = row.BaseUrl, apiKey = row.ApiKeyEnc,
                model = row.DefaultModel, isDefault = row.IsDefault,
                authKind = row.AuthKind, accountId = row.AccountId,
                expiresAt = row.AccessTokenExpiresAt
            });
        }).RequireAuthorization();

        // Caller's own session detail + messages
        app.MapGet("/api/v1/sessions/{id:guid}", GetOwnSession).RequireAuthorization();
        app.MapGet("/api/v1/sessions/{id:guid}/messages", GetOwnMessages).RequireAuthorization();

        // Admin: tenant-wide list with filters + arama
        app.MapGet("/api/v1/admin/sessions", AdminListSessions)
           .RequireAuthorization()
           .AddEndpointFilter(AdminGuard);
        app.MapGet("/api/v1/admin/sessions/{id:guid}", AdminGetSession)
           .RequireAuthorization()
           .AddEndpointFilter(AdminGuard);
        app.MapGet("/api/v1/admin/sessions/{id:guid}/messages", AdminGetMessages)
           .RequireAuthorization()
           .AddEndpointFilter(AdminGuard);

        return app;
    }

    // Per-provider in-process semaphore: aynı provider_config_id için paralel
    // /providers/active çağrıları tek refresh'te birleşsin (race + idempotency).
    // Multi-instance API'ye geçilirse redis distributed lock'a taşınır — tek
    // instance setup'ta (mevcut prod) bu yeterli ve maliyetsiz.
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> _refreshLocks = new();

    private static async Task<bool> JitRefreshOAuthAsync(
        ProviderConfig row, AltarisDbContext db,
        IHttpClientFactory http, ILogger<JitRefreshLogCategory> log)
    {
        var sem = _refreshLocks.GetOrAdd(row.Id, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            // Lock alındıktan sonra DB'yi tekrar oku — başka bir request bizden
            // önce refresh etmiş olabilir. EF'in change tracker'ı row'u zaten
            // tutuyor; AccessTokenExpiresAt yeniden valid ise erken çık.
            await db.Entry(row).ReloadAsync();
            if (row.AccessTokenExpiresAt is { } exp
                && exp > DateTimeOffset.UtcNow.AddMinutes(5))
            {
                return true;
            }

            var ok = row.Provider.ToLowerInvariant() switch
            {
                "anthropic" => await AnthropicTokenRefresher.RefreshOneAsync(row, db, http),
                "codex"     => await CodexTokenRefresher.RefreshOneAsync(row, db, http),
                _           => false,
            };
            if (!ok)
            {
                log.LogWarning("JIT OAuth refresh failed: {Provider} {Id} ({Name})",
                    row.Provider, row.Id, row.Name);
                return false;
            }
            log.LogInformation("JIT OAuth refresh ok: {Provider} {Id} ({Name})",
                row.Provider, row.Id, row.Name);
            return true;
        }
        finally
        {
            sem.Release();
        }
    }

    private static async ValueTask<object?> AdminGuard(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var raClaim = http.User.FindFirst("realm_access")?.Value;
        var roles = new HashSet<string>();
        if (!string.IsNullOrEmpty(raClaim))
        {
            try
            {
                using var doc = JsonDocument.Parse(raClaim);
                if (doc.RootElement.TryGetProperty("roles", out var arr))
                    foreach (var el in arr.EnumerateArray()) if (el.GetString() is { } s) roles.Add(s);
            }
            catch { }
        }
        if (!roles.Contains("tenant_admin") && !roles.Contains("platform_admin"))
            return Results.Forbid();
        return await next(ctx);
    }

    private static async Task<IResult> GetOwnSession(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId && x.UserId == tc.UserId);
        if (s is null) return Results.NotFound();
        return Results.Ok(new { s.Id, s.Source, s.Provider, s.Model, s.Title, s.Status, s.StartedAt, s.EndedAt, s.Metadata });
    }

    private static async Task<IResult> GetOwnMessages(Guid id, AltarisDbContext db, ITenantContext tc, int take = 1000)
    {
        var ownership = await db.Sessions.AnyAsync(x => x.Id == id && x.TenantId == tc.TenantId && x.UserId == tc.UserId);
        if (!ownership) return Results.NotFound();
        var msgs = await db.SessionMessages
            .Where(m => m.SessionId == id)
            .OrderBy(m => m.CreatedAt)
            .Take(Math.Min(take, 5000))
            .Select(m => new { m.Id, m.Role, m.Content, m.CreatedAt })
            .ToListAsync();
        return Results.Ok(msgs);
    }

    public record SessionListResp(IEnumerable<object> Items, int Total);

    private static async Task<IResult> AdminListSessions(
        AltarisDbContext db, ITenantContext tc,
        Guid? userId, string? source, string? provider, string? status, string? q, string? from, string? to,
        int take = 50, int skip = 0)
    {
        if (tc.TenantId is null) return Results.Forbid();

        var query = db.Sessions
            .Where(s => s.TenantId == tc.TenantId)
            .Join(db.Users.Where(u => u.TenantId == tc.TenantId), s => s.UserId, u => u.Id, (s, u) => new { s, u });

        if (userId.HasValue)              query = query.Where(x => x.s.UserId == userId.Value);
        if (!string.IsNullOrEmpty(source))   query = query.Where(x => x.s.Source == source);
        if (!string.IsNullOrEmpty(provider)) query = query.Where(x => x.s.Provider == provider);
        if (!string.IsNullOrEmpty(status))   query = query.Where(x => x.s.Status == status);
        if (DateTimeOffset.TryParse(from, out var dFrom)) query = query.Where(x => x.s.StartedAt >= dFrom);
        if (DateTimeOffset.TryParse(to, out var dTo))     query = query.Where(x => x.s.StartedAt <= dTo);
        if (!string.IsNullOrEmpty(q))
        {
            var like = $"%{q}%";
            query = query.Where(x =>
                EF.Functions.ILike(x.s.Title ?? "", like) ||
                EF.Functions.ILike(x.u.Email, like) ||
                EF.Functions.ILike(x.s.Provider, like) ||
                EF.Functions.ILike(x.s.Model, like));
        }

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(x => x.s.StartedAt)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 200))
            .Select(x => new
            {
                x.s.Id, x.s.Source, x.s.Provider, x.s.Model, x.s.Title, x.s.Status,
                x.s.StartedAt, x.s.EndedAt,
                user = new { id = x.u.Id, email = x.u.Email, displayName = x.u.DisplayName }
            })
            .ToListAsync();

        return Results.Ok(new { items = rows, total });
    }

    private static async Task<IResult> AdminGetSession(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var s = await db.Sessions
            .Where(x => x.Id == id && x.TenantId == tc.TenantId)
            .Join(db.Users, x => x.UserId, u => u.Id, (x, u) => new
            {
                x.Id, x.Source, x.Provider, x.Model, x.Title, x.Status, x.StartedAt, x.EndedAt, x.Metadata,
                user = new { id = u.Id, email = u.Email, displayName = u.DisplayName }
            })
            .FirstOrDefaultAsync();
        if (s is null) return Results.NotFound();
        return Results.Ok(s);
    }

    private static async Task<IResult> AdminGetMessages(Guid id, AltarisDbContext db, ITenantContext tc, int take = 1000)
    {
        var exists = await db.Sessions.AnyAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (!exists) return Results.NotFound();
        var msgs = await db.SessionMessages
            .Where(m => m.SessionId == id)
            .OrderBy(m => m.CreatedAt)
            .Take(Math.Clamp(take, 1, 5000))
            .Select(m => new { m.Id, m.Role, m.Content, m.CreatedAt })
            .ToListAsync();
        return Results.Ok(msgs);
    }
}
