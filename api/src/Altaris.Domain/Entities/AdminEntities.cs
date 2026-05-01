namespace Altaris.Domain.Entities;

public class Invitation
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Email { get; set; } = default!;
    public string Role { get; set; } = "tenant_member";
    public string Token { get; set; } = default!;
    public Guid? InvitedBy { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ApiKey
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = default!;
    public string Prefix { get; set; } = default!;
    public string Hash { get; set; } = default!;
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ProviderConfig
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Provider { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? BaseUrl { get; set; }
    public string? ApiKeyEnc { get; set; }
    public string? DefaultModel { get; set; }
    public bool IsDefault { get; set; }
    public bool Enabled { get; set; } = true;
    public string Metadata { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
