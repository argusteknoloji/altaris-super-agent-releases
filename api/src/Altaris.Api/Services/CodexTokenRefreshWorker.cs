using Altaris.Api.Endpoints;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Services;

/// <summary>
///   Background hosted service that walks the OAuth-backed provider rows and
///   refreshes any access_token that's within <see cref="RefreshThreshold"/>
///   of expiry. Runs every <see cref="PollInterval"/>. Failures get logged
///   and retried on the next pass — refresh_tokens are long-lived.
/// </summary>
public class CodexTokenRefreshWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval     = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan RefreshThreshold = TimeSpan.FromMinutes(10);

    private readonly IServiceScopeFactory _scopes;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<CodexTokenRefreshWorker> _log;

    public CodexTokenRefreshWorker(
        IServiceScopeFactory scopes,
        IHttpClientFactory http,
        ILogger<CodexTokenRefreshWorker> log)
    {
        _scopes = scopes;
        _http   = http;
        _log    = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Initial small delay so this doesn't pile on top of API startup.
        try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); } catch { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RefreshExpiringAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Codex token refresh sweep failed");
            }

            try { await Task.Delay(PollInterval, stoppingToken); } catch { break; }
        }
    }

    private async Task RefreshExpiringAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();

        var cutoff = DateTimeOffset.UtcNow.Add(RefreshThreshold);
        var due = await db.ProviderConfigs
            .Where(p => p.AuthKind == "oauth"
                     && p.Enabled
                     && p.RefreshTokenEnc != null
                     && p.AccessTokenExpiresAt != null
                     && p.AccessTokenExpiresAt < cutoff)
            .ToListAsync(ct);

        if (due.Count == 0) return;
        _log.LogInformation("Codex refresh sweep — {Count} token(s) due", due.Count);

        foreach (var p in due)
        {
            ct.ThrowIfCancellationRequested();
            var ok = await CodexTokenRefresher.RefreshOneAsync(p, db, _http);
            _log.LogInformation("Codex refresh {Id} ({Name}): {Status}",
                p.Id, p.Name, ok ? "ok" : "failed");
        }
    }
}
