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
        .Enrich.WithProperty("env", ctx.HostingEnvironment.EnvironmentName));

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
    builder.Services.AddDbContext<AltarisDbContext>(opts => opts.UseNpgsql(pgConn));

    builder.Services.AddScoped<ITenantContext, TenantContext>();
    builder.Services.AddScoped<Altaris.Infrastructure.Permissions.CapabilityResolver>();
    builder.Services.AddHostedService<Altaris.Api.Services.CodexTokenRefreshWorker>();

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
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS auth_kind                TEXT NOT NULL DEFAULT 'static';
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS refresh_token_enc        TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS id_token_enc             TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS account_id               TEXT;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS access_token_expires_at  TIMESTAMPTZ;
                ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS last_refreshed_at        TIMESTAMPTZ;

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
            ");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Schema patch failed (continuing — likely first-run before tables exist)");
        }
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
    app.MapCodexProviderEndpoints();

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
