namespace Altaris.Infrastructure.MultiTenancy;

public interface ITenantContext
{
    Guid? TenantId { get; }
    string? TenantSlug { get; }
    Guid? UserId { get; }
    string? UserEmail { get; }
    void Set(Guid tenantId, string tenantSlug, Guid userId, string userEmail);
}

public class TenantContext : ITenantContext
{
    public Guid? TenantId { get; private set; }
    public string? TenantSlug { get; private set; }
    public Guid? UserId { get; private set; }
    public string? UserEmail { get; private set; }

    public void Set(Guid tenantId, string tenantSlug, Guid userId, string userEmail)
    {
        TenantId = tenantId;
        TenantSlug = tenantSlug;
        UserId = userId;
        UserEmail = userEmail;
    }
}
