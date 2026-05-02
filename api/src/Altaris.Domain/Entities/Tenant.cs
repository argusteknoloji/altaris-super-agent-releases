namespace Altaris.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Status { get; set; } = "active";
    public string KeycloakRealm { get; set; } = default!;
    /// <summary>
    ///   Tüm tenant kullanıcılarının TOTP kurmasını zorunlu kıl.
    ///   true ise: yeni kullanıcı yaratıldığında CONFIGURE_TOTP required-action
    ///   ekleniyor + admin "Apply to all" ile mevcut kullanıcılara da uygulayabilir.
    /// </summary>
    public bool RequireTotp { get; set; } = false;
    /// <summary>
    ///   Audit log retention (gün). null/0 = sonsuz tut. Background sweeper
    ///   bu değerden eski rowları siler (KVKK/GDPR + storage hijyeni).
    /// </summary>
    public int? AuditRetentionDays { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<AgentSession> Sessions { get; set; } = new List<AgentSession>();
}
