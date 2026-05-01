using System.Threading.RateLimiting;
using Altaris.Api.Endpoints;
using Altaris.Api.Middleware;
using Altaris.Infrastructure.Keycloak;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Presence;
using Altaris.Infrastructure.Pty;
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

    var pgConn = builder.Configuration.GetConnectionString("Postgres")
                 ?? "Host=localhost;Port=5433;Database=altaris;Username=altaris;Password=altaris_dev";
    builder.Services.AddDbContext<AltarisDbContext>(opts => opts.UseNpgsql(pgConn));

    builder.Services.AddScoped<ITenantContext, TenantContext>();

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

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.Authority = keycloakAuthority;
            o.Audience  = "altaris-api";
            o.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
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

    app.MapGet("/api/v1/me", (ITenantContext tc) => Results.Ok(new
    {
        tenantId   = tc.TenantId,
        tenantSlug = tc.TenantSlug,
        userId     = tc.UserId,
        email      = tc.UserEmail
    })).RequireAuthorization();

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
