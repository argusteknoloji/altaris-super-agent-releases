namespace Altaris.Domain.Entities;

public class AgentSession
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string Source { get; set; } = "cli"; // cli | web | remote
    public string Provider { get; set; } = default!;
    public string Model { get; set; } = default!;
    public string? Title { get; set; }
    public string Status { get; set; } = "active";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public string Metadata { get; set; } = "{}";
    public bool RemoteControl { get; set; }
    public DateTimeOffset? RemoteControlAt { get; set; }

    public Tenant Tenant { get; set; } = default!;
    public User User { get; set; } = default!;
    public ICollection<SessionMessage> Messages { get; set; } = new List<SessionMessage>();
}

public class SessionMessage
{
    public long Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SessionId { get; set; }
    public string Role { get; set; } = default!; // user | assistant | tool | system
    public string Content { get; set; } = "{}";
    public int? TokensIn { get; set; }
    public int? TokensOut { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public AgentSession Session { get; set; } = default!;
}

public class AuditEvent
{
    public long Id { get; set; }
    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Actor { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string? ResourceType { get; set; }
    public string? ResourceId { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string Payload { get; set; } = "{}";
    public DateTimeOffset OccurredAt { get; set; }
}
