namespace Altaris.Domain.Entities;

public class Vault
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Status { get; set; } = "active";       // active | archived
    /// <summary>
    ///   private    — yalnızca sahibi okur/yazar.
    ///   tenant     — tenant'taki tüm üyeler okur (yazma yine sahip).
    ///   executive  — yalnızca Executive Brain service principal okuyabilir
    ///                (V3 tenant-wide cross-vault sentez ajanı için ayrılmış).
    /// </summary>
    public string Visibility { get; set; } = "private";  // private | tenant | executive
    public int FileCount { get; set; }
    public long ByteSize { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
