using Altaris.Infrastructure.Vaults;

namespace Altaris.Api.Services;

/// <summary>
///   Saatlik vault permissions normalize sweep — external rsync / scp / manuel
///   kopyalar 600/700 perms ile düştüğünde container API'sinin okuyamamasını
///   engeller. Idempotent + cheap (sadece SetUnixFileMode çağırır).
///
///   Startup'ta da bir kez tetiklenir (gecikmesiz) ki user şu an problemde
///   olan vault'ları hemen düzelt-içinde başlatabilsin.
/// </summary>
public class VaultPermsWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<VaultPermsWorker> _log;

    public VaultPermsWorker(IServiceScopeFactory scopes, ILogger<VaultPermsWorker> log)
    {
        _scopes = scopes;
        _log    = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Startup'ta hemen bir kez çalış (UX: user şu anki sorunlu vault'ları
        // saat beklemesin)
        await SweepOnceAsync();

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
            await SweepOnceAsync();
        }
    }

    private async Task SweepOnceAsync()
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var store = scope.ServiceProvider.GetRequiredService<VaultStorage>();
            var root = store.VaultsRoot;
            if (!Directory.Exists(root)) return;

            // Async wrapper — IO Bound, Task.Run ile thread pool'a at
            var total = await Task.Run(() => store.NormalizePermissions(root));
            _log.LogInformation("VaultPerms sweep: {Count} file perms normalized under {Root}", total, root);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "VaultPerms sweep failed (continuing)");
        }
    }
}
