namespace Altaris.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string KeycloakSub { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "member";
    public DateTimeOffset CreatedAt { get; set; }

    public Tenant Tenant { get; set; } = default!;
}
