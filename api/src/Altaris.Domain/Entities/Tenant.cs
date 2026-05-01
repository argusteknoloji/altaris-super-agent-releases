namespace Altaris.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Status { get; set; } = "active";
    public string KeycloakRealm { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<AgentSession> Sessions { get; set; } = new List<AgentSession>();
}
