using System.Threading.RateLimiting;
using Altaris.Api.Endpoints;
using Altaris.Api.Middleware;
using Altaris.Infrastructure.Keycloak;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Presence;
using Altaris.Infrastructure.Pty;
using Altaris.Infrastructure.RemoteControl;
using Altaris.Infrastructure.Vaults;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using StackExchange.Redis;

// Bootstrap Serilog before the host so even early startup errors land in console
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "altaris-api")
    .WriteTo.Console(outputTemplate:
        "{Timestamp:HH:mm:ss.fff} [{Level:u3}] {service}: {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("service", "altaris-api")
        .Enrich.WithProperty("env", ctx.HostingEnvironment.EnvironmentName)
        // Console sink her ortamda zorunlu — appsettings'te WriteTo yoksa
        // ReadFrom.Configuration sinkleri sıfırlar ve loglar yutulur.
        .WriteTo.Console(outputTemplate:
            "{Timestamp:HH:mm:ss.fff} [{Level:u3}] {service}: {Message:lj} {Properties:j}{NewLine}{Exception}"));

    // ── Required configuration in production ────────────────────────────────
    if (builder.Environment.IsProduction())
    {
        string Req(string key)
        {
            var v = builder.Configuration[key];
            if (string.IsNullOrWhiteSpace(v))
                throw new InvalidOperationException($"Production config missing: {key}");
            return v;
        }
        Req("ConnectionStrings:Postgres");
        Req("Keycloak:Authority");
        Req("Keycloak:AdminClientSecret");
    }

    builder.Services.AddOpenApi();
    builder.Services.AddHttpClient();

    // Keycloak admin client (service account)
    builder.Services.AddSingleton(_ => new KeycloakAdminOptions
    {
        AdminBase         = builder.Configuration["Keycloak:AdminBase"]         ?? "http://localhost:8081/admin",
        RealmBase         = builder.Configuration["Keycloak:Authority"]         ?? "http://localhost:8081/realms/altaris",
        Realm             = builder.Configuration["Keycloak:Realm"]             ?? "altaris",
        AdminClientId     = builder.Configuration["Keycloak:AdminClientId"]     ?? "altaris-admin-svc",
        AdminClientSecret = builder.Configuration["Keycloak:AdminClientSecret"] ?? "dev-only-altaris-admin-svc-secret-replace-in-prod"
    });
    builder.Services.AddHttpClient<KeycloakAdminClient>();

    // Redis presence
    var redisConn = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6380";
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
    builder.Services.AddSingleton<PresenceTracker>();
    builder.Services.AddSingleton<PtySessionManager>();
    builder.Services.AddSingleton<RemoteControlBroker>();

    // Vault filesystem storage
    var vaultsRoot = builder.Configuration["Vaults:RootDir"]
                     ?? Environment.GetEnvironmentVariable("ALTARIS_VAULTS_ROOT")
                     ?? Path.Combine(Environment.GetEnvironmentVariable("HOME") ?? "/tmp",
                                     ".altaris", "server-vaults");
    Directory.CreateDirectory(vaultsRoot);
    builder.Services.AddSingleton(new VaultStorageOptions { RootDir = vaultsRoot });
    builder.Services.AddSingleton<VaultStorage>();

    var pgConn = builder.Configuration.GetConnectionString("Postgres")
                 ?? "Host=localhost;Port=5433;Database=altaris;Username=altaris;Password=altaris_dev";
    builder.Services.AddDbContext<AltarisDbContext>(opts =>
        opts.UseNpgsql(pgConn, npg => npg.UseVector()));

    builder.Services.AddScoped<ITenantContext, TenantContext>();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<Altaris.Infrastructure.Permissions.CapabilityResolver>();

    // Embedding pipeline (Sprint EB-1) — vault.PUT event'inde Indexer'a
    // file gönderir; HttpClientFactory ile network call'lar pool'lanır.
    builder.Services.AddHttpClient<Altaris.Infrastructure.Embeddings.EmbeddingClient>();
    builder.Services.AddScoped<Altaris.Infrastructure.Embeddings.EmbeddingIndexer>();
    builder.Services.AddHostedService<Altaris.Api.Services.CodexTokenRefreshWorker>();
    // Executive Brain async job worker (queue → RAG → LLM → answer/citations)
    builder.Services.AddHostedService<Altaris.Api.Services.ExecutiveJobWorker>();
    // Executive Brain cron scheduler (schedule_cron'lu agent'ları periyodik tetikle)
    builder.Services.AddHostedService<Altaris.Api.Services.ExecutiveScheduler>();
    // Connector framework (Sprint EB-2) — external data sources → vault
    builder.Services.AddScoped<Altaris.Api.Services.ConnectorSyncService>();
    builder.Services.AddHostedService<Altaris.Api.Services.ConnectorPeriodicWorker>();
    // Sprint #68 — tenant.audit_retention_days'e göre eski audit_events satırlarını siler (KVKK/GDPR)
    builder.Services.AddHostedService<Altaris.Api.Services.AuditRetentionWorker>();
    builder.Services.AddHostedService<Altaris.Api.Services.VaultPermsWorker>();

    // ── Health checks (liveness vs readiness) ──────────────────────────────
    builder.Services.AddHealthChecks()
        .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })
        .AddNpgSql(pgConn, name: "postgres", tags: new[] { "ready" })
        .AddRedis(redisConn, name: "redis", tags: new[] { "ready" });

    // ── Rate limiting ──────────────────────────────────────────────────────
    builder.Services.AddRateLimiter(o =>
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            var key = ctx.User.FindFirst("sub")?.Value
                      ?? ctx.Connection.RemoteIpAddress?.ToString()
                      ?? "anon";
            return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit          = 200,
                ReplenishmentPeriod = TimeSpan.FromSeconds(10),
                TokensPerPeriod     = 100,
                AutoReplenishment   = true,
                QueueLimit          = 0
            });
        });
        o.AddPolicy("admin-write", ctx =>
            RateLimitPartition.GetFixedWindowLimiter(
                ctx.User.FindFirst("sub")?.Value ?? "anon",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                }));
    });

    var keycloakAuthority = builder.Configuration["Keycloak:Authority"]
                            ?? "http://localhost:8081/realms/altaris";
    // When the API runs in a container the issuer is reachable from the
    // browser as http://localhost:8081 (which is also baked into JWT 'iss')
    // but discovery from inside the container must use the container DNS
    // (http://keycloak:8080). Setting MetadataAddress decouples the two.
    var keycloakMetadata  = builder.Configuration["Keycloak:MetadataAddress"];

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.Authority = keycloakAuthority;
            if (!string.IsNullOrEmpty(keycloakMetadata)) o.MetadataAddress = keycloakMetadata;
            o.Audience  = "altaris-api";
            o.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                // Container modunda discovery'i container DNS (keycloak:8080)
                // üzerinden yapıyoruz ama tokendaki 'iss' claim'i her zaman
                // public hostname (localhost:8081). İki kaynak tutarsız olabilir
                // diye ValidIssuers listesi ile her ikisini de kabul ediyoruz.
                ValidIssuer  = keycloakAuthority,
                ValidIssuers = new[]
                {
                    keycloakAuthority,
                    builder.Configuration["Keycloak:AltIssuer"] ?? "http://keycloak:8080/realms/altaris"
                },
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                NameClaimType = "preferred_username",
                RoleClaimType = "realm_access.roles"
            };
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var token = ctx.Request.Query["access_token"].ToString();
                    var path = ctx.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(token) && path.StartsWithSegments("/ws"))
                        ctx.Token = token;
                    return Task.CompletedTask;
                }
            };
        });
    builder.Services.AddAuthorization();

    // CORS — origins from config in production
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                        ?? new[] { "http://localhost:3000" };
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

    // Forwarded headers — required behind Caddy/Traefik for correct client IP + scheme
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        o.KnownNetworks.Clear();
        o.KnownProxies.Clear();
    });

    var app = builder.Build();

    // Idempotent schema patches for columns added after the initial init.sql.
    // Postgres skips init.sql on subsequent container starts, so existing
    // databases need ALTER TABLE applied at API startup.
    //
    // ÖNEMLI: Tek ExecuteSqlRawAsync bloğunda bir statement fail ederse Postgres
    // tüm transaction'ı abort eder ve sonraki statement'lar SKIP olur (vault
    // status/file_count/byte_size kolonları bu yüzden prod'a düşmemişti). Her
    // statement kendi başına çalıştırılıyor + try/catch + WARN log.
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();
        var sqlBlock = @"
                /* ─── 2026-05-03: yeni patch'ler — vault eksik kolonları ─── */
                ALTER TABLE vaults ADD COLUMN IF NOT EXISTS status     TEXT    NOT NULL DEFAULT 'active';
                ALTER TABLE vaults ADD COLUMN IF NOT EXISTS file_count INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE vaults ADD COLUMN IF NOT EXISTS byte_size  BIGINT  NOT NULL DEFAULT 0;

                /* Job live PTY preview — running job CLI subprocess'i bir AgentSession
                   altinda yayin yapiyor; frontend bu ID'yi xterm.js viewer'da kullanir */
                ALTER TABLE executive_jobs ADD COLUMN IF NOT EXISTS remote_session_id UUID;
                /* Follow-up zinciri: aynı thread içinde CLI session uzatma — parent.cli_session_id
                   --resume olarak child job'a forward ediliyor */
                ALTER TABLE executive_jobs ADD COLUMN IF NOT EXISTS cli_session_id TEXT;
                ALTER TABLE executive_jobs ADD COLUMN IF NOT EXISTS parent_job_id UUID;
                CREATE INDEX IF NOT EXISTS executive_jobs_parent_idx ON executive_jobs(parent_job_id);

                /* Per-job vault override + recurring schedule linkage */
                ALTER TABLE executive_jobs ADD COLUMN IF NOT EXISTS vault_slugs JSONB;
                ALTER TABLE executive_jobs ADD COLUMN IF NOT EXISTS schedule_id UUID;
                CREATE INDEX IF NOT EXISTS executive_jobs_schedule_idx ON executive_jobs(schedule_id);

                /* Recurring is sablonlari — kullanicinin Isler sayfasindan
                   yarattigi her gun/her saat/haftaici tipi periyodik joblar */
                CREATE TABLE IF NOT EXISTS executive_job_schedules (
                    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    created_by          UUID NOT NULL,
                    name                TEXT NOT NULL,
                    description         TEXT,
                    instructions        TEXT NOT NULL,
                    agent_id            UUID,
                    provider_config_id  UUID,
                    vault_slugs         JSONB,
                    schedule_cron       TEXT NOT NULL,
                    schedule_kind       TEXT NOT NULL DEFAULT 'daily',
                    enabled             BOOLEAN NOT NULL DEFAULT true,
                    last_fired_at       TIMESTAMPTZ,
                    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS executive_job_schedules_tenant_idx
                    ON executive_job_schedules(tenant_id, enabled);
                /* AgentSession.source CHECK constraint relax: executive-brain-job ekle */
                ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_source_check;
                ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_source_check
                    CHECK (source = ANY (ARRAY['cli','web','remote','executive-brain-job']));

                /* ─── vault_files (init.sql'den geri ekleme — eksikti) ─── */
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
                CREATE TABLE IF NOT EXISTS vault_files (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    vault_id        UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    path            TEXT NOT NULL,
                    content         TEXT NOT NULL,
                    sha256          TEXT NOT NULL,
                    bytes           INTEGER NOT NULL,
                    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    ts              tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
                    UNIQUE (vault_id, path)
                );
                CREATE INDEX IF NOT EXISTS vault_files_ts_idx       ON vault_files USING GIN (ts);
                CREATE INDEX IF NOT EXISTS vault_files_trgm_idx     ON vault_files USING GIN (content gin_trgm_ops);
                CREATE INDEX IF NOT EXISTS vault_files_tenant_idx   ON vault_files (tenant_id);
                ALTER TABLE vault_files ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_vault_files ON vault_files;
                CREATE POLICY tenant_isolation_vault_files ON vault_files
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                /* ─── webhooks (Sprint #77) ─── */
                CREATE TABLE IF NOT EXISTS webhooks (
                    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    slug         TEXT NOT NULL,
                    name         TEXT NOT NULL,
                    secret       TEXT NOT NULL,
                    target_kind  TEXT NOT NULL CHECK (target_kind IN ('agent','terminal')),
                    target_id    UUID,
                    enabled      BOOLEAN NOT NULL DEFAULT true,
                    last_fired_at TIMESTAMPTZ,
                    fire_count   INTEGER NOT NULL DEFAULT 0,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (tenant_id, slug)
                );
                CREATE INDEX IF NOT EXISTS webhooks_tenant_idx ON webhooks(tenant_id);
                ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_webhooks ON webhooks;
                CREATE POLICY tenant_isolation_webhooks ON webhooks
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                CREATE TABLE IF NOT EXISTS webhook_invocations (
                    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    webhook_id   UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
                    tenant_id    UUID NOT NULL,
                    payload      JSONB,
                    status       TEXT NOT NULL,
                    error_text   TEXT,
                    job_id       UUID,
                    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS webhook_inv_webhook_idx ON webhook_invocations(webhook_id, received_at DESC);

                /* ─── recovery codes (Sprint #80) ─── */
                CREATE TABLE IF NOT EXISTS user_recovery_codes (
                    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    code_hash    TEXT NOT NULL,
                    used_at      TIMESTAMPTZ,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS user_rec_user_idx ON user_recovery_codes(user_id);

                /* ─── tenant_settings 2fa flag ─── */
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT false;

                /* ─── eski patch'ler ─── */
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS auth_kind                TEXT NOT NULL DEFAULT 'static';
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS refresh_token_enc        TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS id_token_enc             TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS account_id               TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS access_token_expires_at  TIMESTAMPTZ;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS last_refreshed_at        TIMESTAMPTZ;

                CREATE EXTENSION IF NOT EXISTS ""vector"";

                CREATE TABLE IF NOT EXISTS data_sources (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    kind            TEXT NOT NULL,
                    name            TEXT NOT NULL,
                    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
                    secret_enc      TEXT,
                    target_vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
                    enabled         BOOLEAN NOT NULL DEFAULT true,
                    last_sync_at    TIMESTAMPTZ,
                    last_sync_status TEXT,
                    last_sync_error TEXT,
                    sync_interval_min INTEGER,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS data_sources_tenant_idx ON data_sources(tenant_id);
                ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_data_sources ON data_sources;
                CREATE POLICY tenant_isolation_data_sources ON data_sources
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                CREATE TABLE IF NOT EXISTS executive_agents (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    slug            TEXT NOT NULL,
                    name            TEXT NOT NULL,
                    description     TEXT,
                    system_prompt   TEXT NOT NULL,
                    model           TEXT,
                    embedding_model TEXT,
                    vault_filter    JSONB,
                    tools           JSONB NOT NULL DEFAULT '[]'::jsonb,
                    schedule_cron   TEXT,
                    schedule_prompt TEXT,
                    enabled         BOOLEAN NOT NULL DEFAULT true,
                    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (tenant_id, slug)
                );
                CREATE INDEX IF NOT EXISTS executive_agents_tenant_idx ON executive_agents(tenant_id);
                -- Sprint #75: per-agent provider override
                ALTER TABLE executive_agents
                  ADD COLUMN IF NOT EXISTS provider_config_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL;
                ALTER TABLE executive_agents ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_exec_agents ON executive_agents;
                CREATE POLICY tenant_isolation_exec_agents ON executive_agents
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                CREATE TABLE IF NOT EXISTS executive_jobs (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
                    agent_id        UUID REFERENCES executive_agents(id) ON DELETE SET NULL,
                    thread_id       UUID,
                    question        TEXT NOT NULL,
                    status          TEXT NOT NULL DEFAULT 'pending',
                    answer          TEXT,
                    citations       JSONB,
                    error_text      TEXT,
                    trace           JSONB,
                    scheduled_for   TIMESTAMPTZ,
                    started_at      TIMESTAMPTZ,
                    completed_at    TIMESTAMPTZ,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    claimed_by      TEXT,
                    claimed_at      TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS executive_jobs_tenant_idx ON executive_jobs(tenant_id, created_at DESC);
                -- Sprint #76: per-job provider override (web landing ad-hoc soru)
                ALTER TABLE executive_jobs
                  ADD COLUMN IF NOT EXISTS provider_config_id UUID REFERENCES provider_configs(id) ON DELETE SET NULL;
                CREATE INDEX IF NOT EXISTS executive_jobs_status_idx ON executive_jobs(status) WHERE status IN ('pending','running');
                CREATE INDEX IF NOT EXISTS executive_jobs_thread_idx ON executive_jobs(thread_id) WHERE thread_id IS NOT NULL;
                ALTER TABLE executive_jobs ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_exec_jobs ON executive_jobs;
                CREATE POLICY tenant_isolation_exec_jobs ON executive_jobs
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                CREATE TABLE IF NOT EXISTS vault_embeddings (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    vault_id        UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    file_id         UUID REFERENCES vault_files(id) ON DELETE CASCADE,
                    file_path       TEXT NOT NULL,
                    chunk_index     INTEGER NOT NULL,
                    chunk_text      TEXT NOT NULL,
                    embedding_model TEXT NOT NULL,
                    embedding       vector,
                    indexed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (vault_id, file_path, chunk_index, embedding_model)
                );
                CREATE INDEX IF NOT EXISTS vault_embeddings_tenant_idx ON vault_embeddings(tenant_id);
                CREATE INDEX IF NOT EXISTS vault_embeddings_vault_idx  ON vault_embeddings(vault_id);
                ALTER TABLE vault_embeddings ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_vault_embeds ON vault_embeddings;
                CREATE POLICY tenant_isolation_vault_embeds ON vault_embeddings
                    USING (tenant_id::text = current_setting('app.tenant_id', true));

                CREATE TABLE IF NOT EXISTS user_capabilities (
                    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    capability      TEXT NOT NULL,
                    effect          TEXT NOT NULL CHECK (effect IN ('allow','deny')),
                    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
                    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (user_id, capability)
                );
                CREATE INDEX IF NOT EXISTS user_capabilities_user_idx ON user_capabilities(user_id);
                ALTER TABLE user_capabilities ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_user_caps ON user_capabilities;
                CREATE POLICY tenant_isolation_user_caps ON user_capabilities
                    USING (tenant_id::text = current_setting('app.tenant_id', true));
            ";

        // Statement'ları noktalı virgülle ayır + her birini kendi tx'inde çalıştır.
        // Yorum satırlarını ve boşları atla. Postgres'te DDL TX-safe olduğundan
        // tek tek çalıştırmak güvenli; bir fail ederse sonrakiler etkilenmiyor.
        var statements = sqlBlock
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => System.Text.RegularExpressions.Regex.Replace(s, @"/\*.*?\*/", "", System.Text.RegularExpressions.RegexOptions.Singleline).Trim())
            .Where(s => s.Length > 0 && !s.StartsWith("--"))
            .ToArray();

        // Raw ADO.NET — EF Core ExecuteSqlRawAsync SQL'i String.Format ile
        // parse ediyor ve '{}'::jsonb gibi literal'leri parametre placeholder
        // sanip patlatıyordu. NpgsqlCommand direkt çalıştırınca sorun yok.
        var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();
        var ok = 0; var failed = 0;
        foreach (var stmt in statements)
        {
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = stmt;
                await cmd.ExecuteNonQueryAsync();
                ok++;
            }
            catch (Exception ex)
            {
                failed++;
                var preview = stmt.Length > 80 ? stmt[..80] + "…" : stmt;
                Log.Warning(ex, "Schema patch statement failed (continuing): {Sql}", preview);
            }
        }
        Log.Information("Schema patch: {Ok} ok / {Failed} failed", ok, failed);
    }

    app.UseForwardedHeaders();
    app.UseSerilogRequestLogging();
    if (app.Environment.IsDevelopment()) app.MapOpenApi();

    app.UseCors();
    app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseMiddleware<TenantResolutionMiddleware>();
    app.UseAuthorization();

    // ── Health endpoints ───────────────────────────────────────────────────
    app.MapHealthChecks("/health/live",  new() { Predicate = r => r.Tags.Contains("live") });
    app.MapHealthChecks("/health/ready", new() { Predicate = r => r.Tags.Contains("ready") });
    app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "altaris-api" }));

    // Public CLI bootstrap config — `altaris login --api <url>` hits this
    // anonymously to discover the deployment-specific Keycloak issuer + client.
    // Lets one CLI binary work against multiple installs (cloud, on-prem, local).
    app.MapGet("/api/v1/config/cli", (IConfiguration cfg) =>
    {
        var issuer   = cfg["Auth:Issuer"]      ?? Environment.GetEnvironmentVariable("ALTARIS_KEYCLOAK_ISSUER")   ?? "http://localhost:8081/realms/altaris";
        var clientId = cfg["Auth:CliClientId"] ?? Environment.GetEnvironmentVariable("ALTARIS_CLI_CLIENT_ID")     ?? "altaris-cli";
        var webBase  = cfg["Web:BaseUrl"]      ?? Environment.GetEnvironmentVariable("ALTARIS_WEB_BASE")          ?? "";
        return Results.Ok(new { issuer, clientId, webBase });
    }).AllowAnonymous();

    app.MapGet("/api/v1/me/capabilities", async (Altaris.Infrastructure.Permissions.CapabilityResolver cr) =>
        Results.Ok(new { capabilities = (await cr.EffectiveAsync()).OrderBy(s => s).ToArray() })
    ).RequireAuthorization();

    app.MapGet("/api/v1/me", async (HttpContext http, ITenantContext tc, Altaris.Infrastructure.Permissions.CapabilityResolver cr) =>
    {
        // Expose realm roles + effective capabilities to the UI so pages can
        // hide/show actions without each one re-decoding the JWT or refetching.
        var roles = new List<string>();
        var raClaim = http.User.FindFirst("realm_access")?.Value;
        if (!string.IsNullOrEmpty(raClaim))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(raClaim);
                if (doc.RootElement.TryGetProperty("roles", out var arr)
                    && arr.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var el in arr.EnumerateArray())
                        if (el.GetString() is { } s) roles.Add(s);
                }
            }
            catch { /* malformed claim — fall through with empty roles */ }
        }
        var caps = await cr.EffectiveAsync();
        return Results.Ok(new
        {
            tenantId   = tc.TenantId,
            tenantSlug = tc.TenantSlug,
            userId     = tc.UserId,
            email      = tc.UserEmail,
            roles,
            isPlatformAdmin = roles.Contains("platform_admin"),
            isTenantAdmin   = roles.Contains("tenant_admin") || roles.Contains("platform_admin"),
            capabilities = caps.OrderBy(s => s).ToArray()
        });
    }).RequireAuthorization();

    app.MapGet("/api/v1/sessions", async (AltarisDbContext db, ITenantContext tc) =>
    {
        if (tc.TenantId is null) return Results.Forbid();
        var sessions = await db.Sessions
            .Where(s => s.TenantId == tc.TenantId && s.UserId == tc.UserId)
            .OrderByDescending(s => s.StartedAt)
            .Take(100)
            .Select(s => new { s.Id, s.Source, s.Provider, s.Model, s.Title, s.Status, s.StartedAt, s.EndedAt })
            .ToListAsync();
        return Results.Ok(sessions);
    }).RequireAuthorization();

    app.MapChatEndpoints();
    app.MapPtyEndpoints();
    app.MapAdminEndpoints();
    app.MapSessionEndpoints();
    app.MapPresenceEndpoints();
    app.MapFileEndpoints();
    app.MapRemoteControlEndpoints();
    app.MapVaultEndpoints();
    app.MapSetupEndpoints();
    app.MapInviteEndpoints();
    app.MapMeEndpoints();
    app.MapCodexProviderEndpoints();
    app.MapOAuthConnectEndpoints();
    app.MapExecutiveBrainEndpoints();
    app.MapDataSourceEndpoints();
    app.MapWebhookEndpoints();

    Log.Information("Altaris API starting in {Env}", app.Environment.EnvironmentName);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Altaris API failed to start");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
