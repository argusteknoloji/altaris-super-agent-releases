using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Services;

/// <summary>
///   Tenant'ların audit_retention_days ayarına göre eski audit_events satırlarını
///   siler. KVKK / GDPR "saklama süresi" gerekliliği + storage hijyeni.
///
///   Davranış:
///     - audit_retention_days NULL veya 0 = sonsuz tut, atla
///     - Saatte bir tetiklenir (volume düşük, agresif çalışmaya gerek yok)
///     - Her tenant için DELETE WHERE tenant_id=X AND created_at &lt; cutoff
///     - Bulk delete; ExecuteDelete EF 7+ raw SQL'e derler — N+1 yok
/// </summary>
public class AuditRetentionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AuditRetentionWorker> _log;

    public AuditRetentionWorker(IServiceScopeFactory scopes, ILogger<AuditRetentionWorker> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("AuditRetentionWorker started");
        // İlk tetik: 5dk delay (boot sırasında DB hazır olsun)
        try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "Audit retention sweep failed"); }

            try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();

        var tenants = await db.Tenants.AsNoTracking()
            .Where(t => t.AuditRetentionDays != null && t.AuditRetentionDays > 0)
            .Select(t => new { t.Id, t.Slug, Days = t.AuditRetentionDays!.Value })
            .ToListAsync(ct);

        foreach (var t in tenants)
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-t.Days);
            var deleted = await db.AuditEvents
                .Where(a => a.TenantId == t.Id && a.OccurredAt < cutoff)
                .ExecuteDeleteAsync(ct);
            if (deleted > 0)
                _log.LogInformation("Audit sweep tenant={Slug} deleted={Count} cutoff={Cutoff}",
                    t.Slug, deleted, cutoff);
        }
    }
}
