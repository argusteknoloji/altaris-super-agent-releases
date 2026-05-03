namespace Altaris.Domain.Entities;

/// <summary>
///   Tek-kullanımlık 2FA recovery code. SHA-256 hash'lenmiş saklanır;
///   plain text yalnızca generate sırasında bir kez kullanıcıya gösterilir.
///   TOTP cihazı kaybolduğunda Keycloak custom auth flow bu kodu doğrular.
/// </summary>
public class UserRecoveryCode
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public string CodeHash { get; set; } = default!;
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
