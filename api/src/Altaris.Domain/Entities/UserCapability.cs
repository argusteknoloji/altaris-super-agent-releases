namespace Altaris.Domain.Entities;

/// <summary>
///   Per-user override on top of the role-default capability set.
///   <c>effect = "allow"</c> ekler, <c>effect = "deny"</c> çıkarır.
/// </summary>
public class UserCapability
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string Capability { get; set; } = default!;
    public string Effect { get; set; } = "allow";   // "allow" | "deny"
    public Guid? GrantedBy { get; set; }
    public DateTimeOffset GrantedAt { get; set; }
}
