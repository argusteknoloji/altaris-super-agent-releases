using Altaris.Api.Services;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /api/v1/admin/data-sources — Connector framework admin CRUD.
///   tenant_admin yetkisi altında çalışır (AdminGuard zaten /admin grubunda).
/// </summary>
public static class DataSourceEndpoints
{
    public static IEndpointRouteBuilder MapDataSourceEndpoints(this IEndpointRouteBuilder app)
    {
        var grp = app.MapGroup("/api/v1/admin/data-sources").RequireAuthorization();
        grp.MapGet   ("",                List);
        grp.MapPost  ("",                Create);
        grp.MapPatch ("{id:guid}",       Update);
        grp.MapDelete("{id:guid}",       Delete);
        grp.MapPost  ("{id:guid}/test",  Test);
        grp.MapPost  ("{id:guid}/sync",  Sync);
        return app;
    }

    public record DataSourceDto(Guid Id, string Kind, string Name, string Config,
                                Guid? TargetVaultId, bool Enabled,
                                DateTimeOffset? LastSyncAt, string? LastSyncStatus, string? LastSyncError,
                                int? SyncIntervalMin, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
    private static DataSourceDto ToDto(DataSource d) => new(
        d.Id, d.Kind, d.Name, d.Config, d.TargetVaultId, d.Enabled,
        d.LastSyncAt, d.LastSyncStatus, d.LastSyncError, d.SyncIntervalMin, d.CreatedAt, d.UpdatedAt);

    private static async Task<IResult> List(AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var rows = await db.DataSources.AsNoTracking()
            .Where(d => d.TenantId == tc.TenantId)
            .OrderBy(d => d.Name)
            .ToListAsync();
        return Results.Ok(rows.Select(ToDto));
    }

    public record CreateRequest(string Kind, string Name, string? Config, string? Secret,
                                Guid? TargetVaultId, int? SyncIntervalMin, bool Enabled = true);

    private static async Task<IResult> Create(CreateRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(req.Kind) || string.IsNullOrWhiteSpace(req.Name))
            return Results.BadRequest(new { error = "kind+name required" });
        var allowed = new[] { "csv", "imap", "exchange", "logo_tiger", "netsis", "salesforce", "hubspot", "pdf_bulk" };
        if (!allowed.Contains(req.Kind))
            return Results.BadRequest(new { error = "unsupported_kind", allowed });

        var d = new DataSource
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            Kind = req.Kind,
            Name = req.Name.Trim(),
            Config = string.IsNullOrEmpty(req.Config) ? "{}" : req.Config,
            SecretEnc = req.Secret,    // TODO: envelope encryption Sprint #67
            TargetVaultId = req.TargetVaultId,
            Enabled = req.Enabled,
            SyncIntervalMin = req.SyncIntervalMin,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.DataSources.Add(d);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/admin/data-sources/{d.Id}", ToDto(d));
    }

    public record UpdateRequest(string? Name, string? Config, string? Secret, Guid? TargetVaultId,
                                int? SyncIntervalMin, bool? Enabled);

    private static async Task<IResult> Update(Guid id, UpdateRequest req, AltarisDbContext db, ITenantContext tc)
    {
        var d = await db.DataSources.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (d is null) return Results.NotFound();
        if (!string.IsNullOrWhiteSpace(req.Name)) d.Name = req.Name.Trim();
        if (req.Config is not null) d.Config = string.IsNullOrEmpty(req.Config) ? "{}" : req.Config;
        if (req.Secret is not null) d.SecretEnc = string.IsNullOrEmpty(req.Secret) ? null : req.Secret;
        if (req.TargetVaultId is not null) d.TargetVaultId = req.TargetVaultId;
        if (req.SyncIntervalMin is not null) d.SyncIntervalMin = req.SyncIntervalMin;
        if (req.Enabled is not null) d.Enabled = req.Enabled.Value;
        d.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(ToDto(d));
    }

    private static async Task<IResult> Delete(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        var d = await db.DataSources.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (d is null) return Results.NotFound();
        db.DataSources.Remove(d);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> Test(Guid id, AltarisDbContext db, ITenantContext tc, ConnectorSyncService sync)
    {
        var d = await db.DataSources.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (d is null) return Results.NotFound();
        string? vaultSlug = null;
        if (d.TargetVaultId is { } vid)
            vaultSlug = await db.Vaults.AsNoTracking().Where(v => v.Id == vid).Select(v => v.Slug).FirstOrDefaultAsync();
        var r = await sync.TestAsync(d, tc.TenantSlug ?? "", vaultSlug, default);
        return Results.Ok(new { ok = r.Ok, message = r.Message });
    }

    private static async Task<IResult> Sync(Guid id, AltarisDbContext db, ITenantContext tc, ConnectorSyncService sync)
    {
        var d = await db.DataSources.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (d is null) return Results.NotFound();
        if (d.TargetVaultId is null) return Results.BadRequest(new { error = "target_vault_required" });

        var vaultSlug = await db.Vaults.AsNoTracking()
            .Where(v => v.Id == d.TargetVaultId).Select(v => v.Slug).FirstOrDefaultAsync();
        if (vaultSlug is null) return Results.BadRequest(new { error = "vault_not_found" });

        try
        {
            var r = await sync.SyncAsync(d, tc.TenantSlug ?? "", vaultSlug, default);
            d.LastSyncAt = DateTimeOffset.UtcNow;
            d.LastSyncStatus = "ok";
            d.LastSyncError = null;
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true, fileCount = r.FileCount, note = r.Note });
        }
        catch (Exception ex)
        {
            d.LastSyncAt = DateTimeOffset.UtcNow;
            d.LastSyncStatus = "error";
            d.LastSyncError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await db.SaveChangesAsync();
            return Results.Problem(ex.Message);
        }
    }
}
