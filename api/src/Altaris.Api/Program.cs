using Altaris.Api.Endpoints;
using Altaris.Api.Middleware;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddHttpClient();

builder.Services.AddDbContext<AltarisDbContext>(opts =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")
                   ?? "Host=localhost;Port=5432;Database=altaris;Username=altaris;Password=altaris_dev"));

builder.Services.AddScoped<ITenantContext, TenantContext>();

var keycloakAuthority = builder.Configuration["Keycloak:Authority"]
                        ?? "http://localhost:8081/realms/altaris";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = keycloakAuthority;
        o.Audience = "altaris-api";
        o.RequireHttpsMetadata = false; // dev only
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            NameClaimType = "preferred_username",
            RoleClaimType = "realm_access.roles"
        };
        // Accept token from ?access_token= query for WebSocket upgrades
        o.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
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

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:3000")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "altaris-api" }));

app.MapGet("/api/v1/me", (ITenantContext tc) => Results.Ok(new
{
    tenantId = tc.TenantId,
    tenantSlug = tc.TenantSlug,
    userId = tc.UserId,
    email = tc.UserEmail
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

app.Run();
