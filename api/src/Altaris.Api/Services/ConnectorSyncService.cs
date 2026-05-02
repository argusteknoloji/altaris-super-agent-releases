using Altaris.Domain.Entities;
using Altaris.Infrastructure.Connectors;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Vaults;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Services;

/// <summary>
///   Connector dispatcher — kind'e göre IConnector resolve eder, sync'leyip
///   gelen dosyaları VaultStorage'a yazar (embedding pipeline otomatik index).
///   Hem manual sync (admin button) hem periodic worker tarafından kullanılır.
/// </summary>
public class ConnectorSyncService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<ConnectorSyncService> _log;

    public ConnectorSyncService(IServiceProvider services, ILogger<ConnectorSyncService> log)
    {
        _services = services;
        _log = log;
    }

    private IConnector? Resolve(string kind) => kind switch
    {
        "csv"   => new CsvConnector(),
        "imap"  => new ImapConnector(),
        _       => null,
    };

    public async Task<TestResult> TestAsync(DataSource ds, string tenantSlug, string? targetVaultSlug, CancellationToken ct)
    {
        var connector = Resolve(ds.Kind);
        if (connector is null) return new TestResult(false, $"Bilinmeyen connector: {ds.Kind}");
        var ctx = new ConnectorContext(ds.Id, ds.TenantId, tenantSlug, ds.Name, ds.Config, ds.SecretEnc, ds.TargetVaultId, targetVaultSlug);
        try { return await connector.TestAsync(ctx, ct); }
        catch (Exception ex) { return new TestResult(false, ex.Message); }
    }

    public async Task<SyncResult> SyncAsync(DataSource ds, string tenantSlug, string? targetVaultSlug, CancellationToken ct)
    {
        var connector = Resolve(ds.Kind);
        if (connector is null) throw new InvalidOperationException($"unknown_connector_kind:{ds.Kind}");
        if (string.IsNullOrEmpty(targetVaultSlug))
            throw new InvalidOperationException("target_vault_required");

        var ctx = new ConnectorContext(ds.Id, ds.TenantId, tenantSlug, ds.Name, ds.Config, ds.SecretEnc, ds.TargetVaultId, targetVaultSlug);
        var result = await connector.SyncAsync(ctx, ct);

        // Dosyaları vault'a yaz (embedding pipeline otomatik triger olur)
        using var scope = _services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<VaultStorage>();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();

        // RLS context (worker bağlamında)
        await db.Database.ExecuteSqlRawAsync(
            "SELECT set_config('app.tenant_id', {0}, true)", ds.TenantId.ToString());

        foreach (var file in result.Files)
        {
            try
            {
                await storage.WriteTextAsync(tenantSlug, targetVaultSlug, file.RelativePath, file.Content, ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Connector write fail: {Path}", file.RelativePath);
            }
        }
        // Vault metadata refresh
        try
        {
            var v = await db.Vaults.FirstOrDefaultAsync(x => x.TenantId == ds.TenantId && x.Slug == targetVaultSlug, ct);
            if (v is not null)
            {
                var (files, bytes) = storage.Stats(tenantSlug, targetVaultSlug);
                v.FileCount = files; v.ByteSize = bytes; v.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }
        catch { /* metadata fail non-fatal */ }

        return result;
    }
}

/// <summary>
///   Periyodik connector sync — sync_interval_min'i set'li olan
///   data_sources için son sync'ten geçen süreyi kontrol, gelmesi gerekiyorsa
///   ConnectorSyncService.SyncAsync çağır.
/// </summary>
public class ConnectorPeriodicWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ConnectorPeriodicWorker> _log;

    public ConnectorPeriodicWorker(IServiceScopeFactory scopes, ILogger<ConnectorPeriodicWorker> log)
    {
        _scopes = scopes; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("ConnectorPeriodicWorker started");
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "Periodic sync failed"); }
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();
        var sync = scope.ServiceProvider.GetRequiredService<ConnectorSyncService>();

        var due = await db.DataSources.AsNoTracking()
            .Where(d => d.Enabled
                     && d.SyncIntervalMin != null
                     && (d.LastSyncAt == null
                         || d.LastSyncAt.Value.AddMinutes(d.SyncIntervalMin!.Value) < DateTimeOffset.UtcNow))
            .ToListAsync(ct);

        foreach (var ds in due)
        {
            var tenantSlug = await db.Tenants.AsNoTracking()
                .Where(t => t.Id == ds.TenantId).Select(t => t.Slug).FirstOrDefaultAsync(ct);
            string? vaultSlug = null;
            if (ds.TargetVaultId is { } vid)
                vaultSlug = await db.Vaults.AsNoTracking()
                    .Where(v => v.Id == vid).Select(v => v.Slug).FirstOrDefaultAsync(ct);
            if (string.IsNullOrEmpty(tenantSlug) || string.IsNullOrEmpty(vaultSlug)) continue;

            try
            {
                _log.LogInformation("Periodic sync: {Kind} → vault {Vault}", ds.Kind, vaultSlug);
                var result = await sync.SyncAsync(ds, tenantSlug, vaultSlug, ct);
                await db.DataSources.Where(x => x.Id == ds.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(x => x.LastSyncAt, (DateTimeOffset?)DateTimeOffset.UtcNow)
                        .SetProperty(x => x.LastSyncStatus, "ok")
                        .SetProperty(x => x.LastSyncError, (string?)null), ct);
                _log.LogInformation("Sync ok: {Files} dosya, {Note}", result.FileCount, result.Note);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Periodic sync failed for {Id}", ds.Id);
                var err = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                await db.DataSources.Where(x => x.Id == ds.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(x => x.LastSyncAt, (DateTimeOffset?)DateTimeOffset.UtcNow)
                        .SetProperty(x => x.LastSyncStatus, "error")
                        .SetProperty(x => x.LastSyncError, err), ct);
            }
        }
    }
}
