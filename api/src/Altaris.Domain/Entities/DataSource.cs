namespace Altaris.Domain.Entities;

/// <summary>
///   External data source — Excel, CSV, IMAP, Exchange, Logo Tiger,
///   Netsis, Salesforce, HubSpot vb. Her sync'te connector worker
///   target_vault_id'ye markdown/CSV olarak yazar; embedding pipeline
///   otomatik index eder. RAG sırasında bu vault da semantic search'e dahil.
/// </summary>
public class DataSource
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Kind { get; set; } = default!;
    public string Name { get; set; } = default!;
    /// <summary>JSONB connector-specific config (server, mailbox, query vb).</summary>
    public string Config { get; set; } = "{}";
    /// <summary>Encrypted secret (password, OAuth refresh token vb).</summary>
    public string? SecretEnc { get; set; }
    public Guid? TargetVaultId { get; set; }
    public bool Enabled { get; set; } = true;
    public DateTimeOffset? LastSyncAt { get; set; }
    public string? LastSyncStatus { get; set; }
    public string? LastSyncError { get; set; }
    public int? SyncIntervalMin { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
