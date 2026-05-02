namespace Altaris.Infrastructure.Connectors;

/// <summary>
///   Bir external veri kaynağını vault'a senkronize eden component.
///   Worker IConnector resolve eder, Sync() çağırır, döndürdüğü dosyaları
///   tenant'ın target_vault_id'sine yazar; embedding pipeline otomatik
///   index eder. Test() bağlantı doğrulama amaçlı (admin UI için).
/// </summary>
public interface IConnector
{
    /// <summary>data_sources.kind ile eşleşmeli (örn: 'imap', 'excel').</summary>
    string Kind { get; }

    /// <summary>Bağlantı + auth doğrulama. Hata fırlatırsa UI 'fail' gösterir.</summary>
    Task<TestResult> TestAsync(ConnectorContext ctx, CancellationToken ct = default);

    /// <summary>
    ///   Veriyi çek + dosyalar olarak vault'a yazılacak liste döner.
    ///   Worker bu dosyaları VaultStorage.WriteTextAsync ile yazar.
    /// </summary>
    Task<SyncResult> SyncAsync(ConnectorContext ctx, CancellationToken ct = default);
}

/// <summary>Connector çalıştırırken ihtiyacı olan her şey.</summary>
public record ConnectorContext(
    Guid DataSourceId,
    Guid TenantId,
    string TenantSlug,
    string Name,
    string ConfigJson,
    string? Secret,
    Guid? TargetVaultId,
    string? TargetVaultSlug);

public record TestResult(bool Ok, string? Message);

public record SyncFile(string RelativePath, string Content);

public record SyncResult(int FileCount, IReadOnlyList<SyncFile> Files, string? Note = null);
