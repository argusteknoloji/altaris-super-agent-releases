namespace Altaris.Domain.Entities;

/// <summary>
///   Shadow row for full-text search. Canonical bytes stay on disk
///   (<see cref="Altaris.Infrastructure.Vaults.VaultStorage"/>); this table
///   is a denormalized index updated on every write.
/// </summary>
public class VaultFile
{
    public Guid Id { get; set; }
    public Guid VaultId { get; set; }
    public Guid TenantId { get; set; }
    public string Path { get; set; } = default!;
    public string Content { get; set; } = default!;
    public string Sha256 { get; set; } = default!;
    public int Bytes { get; set; }
    public DateTimeOffset IndexedAt { get; set; }
}
