using Altaris.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Infrastructure.Persistence;

public class AltarisDbContext : DbContext
{
    public AltarisDbContext(DbContextOptions<AltarisDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<AgentSession> Sessions => Set<AgentSession>();
    public DbSet<SessionMessage> SessionMessages => Set<SessionMessage>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(e =>
        {
            e.ToTable("tenants");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.KeycloakRealm).HasColumnName("keycloak_realm");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.KeycloakSub).HasColumnName("keycloak_sub");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.DisplayName).HasColumnName("display_name");
            e.Property(x => x.Role).HasColumnName("role");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Tenant).WithMany(x => x.Users).HasForeignKey(x => x.TenantId);
        });

        modelBuilder.Entity<AgentSession>(e =>
        {
            e.ToTable("agent_sessions");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Source).HasColumnName("source");
            e.Property(x => x.Provider).HasColumnName("provider");
            e.Property(x => x.Model).HasColumnName("model");
            e.Property(x => x.Title).HasColumnName("title");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.EndedAt).HasColumnName("ended_at");
            e.Property(x => x.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
        });

        modelBuilder.Entity<SessionMessage>(e =>
        {
            e.ToTable("session_messages");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.SessionId).HasColumnName("session_id");
            e.Property(x => x.Role).HasColumnName("role");
            e.Property(x => x.Content).HasColumnName("content").HasColumnType("jsonb");
            e.Property(x => x.TokensIn).HasColumnName("tokens_in");
            e.Property(x => x.TokensOut).HasColumnName("tokens_out");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne(x => x.Session).WithMany(x => x.Messages).HasForeignKey(x => x.SessionId);
        });

        modelBuilder.Entity<AuditEvent>(e =>
        {
            e.ToTable("audit_events");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Actor).HasColumnName("actor");
            e.Property(x => x.Action).HasColumnName("action");
            e.Property(x => x.ResourceType).HasColumnName("resource_type");
            e.Property(x => x.ResourceId).HasColumnName("resource_id");
            e.Property(x => x.Ip).HasColumnName("ip");
            e.Property(x => x.UserAgent).HasColumnName("user_agent");
            e.Property(x => x.Payload).HasColumnName("payload").HasColumnType("jsonb");
            e.Property(x => x.OccurredAt).HasColumnName("occurred_at");
        });
    }
}
