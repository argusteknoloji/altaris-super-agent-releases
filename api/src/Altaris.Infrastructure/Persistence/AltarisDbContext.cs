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
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<ProviderConfig> ProviderConfigs => Set<ProviderConfig>();
    public DbSet<Vault> Vaults => Set<Vault>();
    public DbSet<VaultFile> VaultFiles => Set<VaultFile>();
    public DbSet<VaultEmbedding> VaultEmbeddings => Set<VaultEmbedding>();
    public DbSet<UserCapability> UserCapabilities => Set<UserCapability>();
    public DbSet<ExecutiveAgent> ExecutiveAgents => Set<ExecutiveAgent>();
    public DbSet<ExecutiveJob> ExecutiveJobs => Set<ExecutiveJob>();
    public DbSet<DataSource> DataSources => Set<DataSource>();

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
            e.Property(x => x.RequireTotp).HasColumnName("require_totp").HasDefaultValue(false);
            e.Property(x => x.AuditRetentionDays).HasColumnName("audit_retention_days");
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
            e.Property(x => x.RemoteControl).HasColumnName("remote_control");
            e.Property(x => x.RemoteControlAt).HasColumnName("remote_control_at");
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

        modelBuilder.Entity<Invitation>(e =>
        {
            e.ToTable("invitations");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.Role).HasColumnName("role");
            e.Property(x => x.Token).HasColumnName("token");
            e.Property(x => x.InvitedBy).HasColumnName("invited_by");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasIndex(x => x.Token).IsUnique();
        });

        modelBuilder.Entity<ApiKey>(e =>
        {
            e.ToTable("api_keys");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Prefix).HasColumnName("prefix");
            e.Property(x => x.Hash).HasColumnName("hash");
            e.Property(x => x.LastUsedAt).HasColumnName("last_used_at");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ProviderConfig>(e =>
        {
            e.ToTable("provider_configs");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Provider).HasColumnName("provider");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.BaseUrl).HasColumnName("base_url");
            e.Property(x => x.ApiKeyEnc).HasColumnName("api_key_enc");
            e.Property(x => x.DefaultModel).HasColumnName("default_model");
            e.Property(x => x.IsDefault).HasColumnName("is_default");
            e.Property(x => x.Enabled).HasColumnName("enabled");
            e.Property(x => x.Metadata).HasColumnName("metadata").HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.AuthKind).HasColumnName("auth_kind").HasDefaultValue("static");
            e.Property(x => x.RefreshTokenEnc).HasColumnName("refresh_token_enc");
            e.Property(x => x.IdTokenEnc).HasColumnName("id_token_enc");
            e.Property(x => x.AccountId).HasColumnName("account_id");
            e.Property(x => x.AccessTokenExpiresAt).HasColumnName("access_token_expires_at");
            e.Property(x => x.LastRefreshedAt).HasColumnName("last_refreshed_at");
        });

        modelBuilder.Entity<Vault>(e =>
        {
            e.ToTable("vaults");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Visibility).HasColumnName("visibility");
            e.Property(x => x.FileCount).HasColumnName("file_count");
            e.Property(x => x.ByteSize).HasColumnName("byte_size");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        });

        modelBuilder.Entity<VaultFile>(e =>
        {
            e.ToTable("vault_files");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.VaultId).HasColumnName("vault_id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Path).HasColumnName("path");
            e.Property(x => x.Content).HasColumnName("content");
            e.Property(x => x.Sha256).HasColumnName("sha256");
            e.Property(x => x.Bytes).HasColumnName("bytes");
            e.Property(x => x.IndexedAt).HasColumnName("indexed_at");
            e.HasIndex(x => new { x.VaultId, x.Path }).IsUnique();
        });

        modelBuilder.Entity<VaultEmbedding>(e =>
        {
            e.ToTable("vault_embeddings");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.VaultId).HasColumnName("vault_id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.FileId).HasColumnName("file_id");
            e.Property(x => x.FilePath).HasColumnName("file_path");
            e.Property(x => x.ChunkIndex).HasColumnName("chunk_index");
            e.Property(x => x.ChunkText).HasColumnName("chunk_text");
            e.Property(x => x.EmbeddingModel).HasColumnName("embedding_model");
            e.Property(x => x.Embedding).HasColumnName("embedding").HasColumnType("vector");
            e.Property(x => x.IndexedAt).HasColumnName("indexed_at");
            e.HasIndex(x => new { x.VaultId, x.FilePath, x.ChunkIndex, x.EmbeddingModel }).IsUnique();
        });

        modelBuilder.Entity<UserCapability>(e =>
        {
            e.ToTable("user_capabilities");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Capability).HasColumnName("capability");
            e.Property(x => x.Effect).HasColumnName("effect");
            e.Property(x => x.GrantedBy).HasColumnName("granted_by");
            e.Property(x => x.GrantedAt).HasColumnName("granted_at");
            e.HasIndex(x => new { x.UserId, x.Capability }).IsUnique();
        });

        modelBuilder.Entity<ExecutiveAgent>(e =>
        {
            e.ToTable("executive_agents");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Slug).HasColumnName("slug");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.SystemPrompt).HasColumnName("system_prompt");
            e.Property(x => x.Model).HasColumnName("model");
            e.Property(x => x.EmbeddingModel).HasColumnName("embedding_model");
            e.Property(x => x.ProviderConfigId).HasColumnName("provider_config_id");
            e.Property(x => x.VaultFilter).HasColumnName("vault_filter").HasColumnType("jsonb");
            e.Property(x => x.Tools).HasColumnName("tools").HasColumnType("jsonb");
            e.Property(x => x.ScheduleCron).HasColumnName("schedule_cron");
            e.Property(x => x.SchedulePrompt).HasColumnName("schedule_prompt");
            e.Property(x => x.Enabled).HasColumnName("enabled");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        });

        modelBuilder.Entity<ExecutiveJob>(e =>
        {
            e.ToTable("executive_jobs");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.AgentId).HasColumnName("agent_id");
            e.Property(x => x.ThreadId).HasColumnName("thread_id");
            e.Property(x => x.Question).HasColumnName("question");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.Answer).HasColumnName("answer");
            e.Property(x => x.Citations).HasColumnName("citations").HasColumnType("jsonb");
            e.Property(x => x.ErrorText).HasColumnName("error_text");
            e.Property(x => x.Trace).HasColumnName("trace").HasColumnType("jsonb");
            e.Property(x => x.ScheduledFor).HasColumnName("scheduled_for");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.CompletedAt).HasColumnName("completed_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.ClaimedBy).HasColumnName("claimed_by");
            e.Property(x => x.ClaimedAt).HasColumnName("claimed_at");
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
        });

        modelBuilder.Entity<DataSource>(e =>
        {
            e.ToTable("data_sources");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TenantId).HasColumnName("tenant_id");
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.Name).HasColumnName("name");
            e.Property(x => x.Config).HasColumnName("config").HasColumnType("jsonb");
            e.Property(x => x.SecretEnc).HasColumnName("secret_enc");
            e.Property(x => x.TargetVaultId).HasColumnName("target_vault_id");
            e.Property(x => x.Enabled).HasColumnName("enabled");
            e.Property(x => x.LastSyncAt).HasColumnName("last_sync_at");
            e.Property(x => x.LastSyncStatus).HasColumnName("last_sync_status");
            e.Property(x => x.LastSyncError).HasColumnName("last_sync_error");
            e.Property(x => x.SyncIntervalMin).HasColumnName("sync_interval_min");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.HasIndex(x => x.TenantId);
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
