using Altaris.Api.Permissions;
using Altaris.Api.Services;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /api/v1/admin/data-sources — Connector framework admin CRUD.
///   AdminAuth.RequireAdminRole() ile tenant_admin/platform_admin guard'ı uygulanır
///   (önceden RequireAuthorization tek başınaydı → her authenticated user erişebiliyordu).
/// </summary>
public static class DataSourceEndpoints
{
    public static IEndpointRouteBuilder MapDataSourceEndpoints(this IEndpointRouteBuilder app)
    {
        var grp = app.MapGroup("/api/v1/admin/data-sources").RequireAdminRole();
        grp.MapGet   ("",                List);
        grp.MapPost  ("",                Create);
        grp.MapPatch ("{id:guid}",       Update);
        grp.MapDelete("{id:guid}",       Delete);
        grp.MapPost  ("{id:guid}/test",  Test);
        grp.MapPost  ("{id:guid}/sync",  Sync);
        grp.MapGet   ("templates",       Templates);
        return app;
    }

    /// <summary>
    ///   Hazır connector preset'leri — admin UI bir kart listeden seçip
    ///   kendi credentials'ını girip tek tıkla data_source yaratabilir.
    /// </summary>
    private static IResult Templates() => Results.Ok(new object[]
    {
        new {
            kind = "logo_tiger",
            label = "Logo Tiger 3 ERP",
            description = "Türkiye'de en yaygın ERP. Cari, fatura, sipariş, stok endpoint'leri.",
            authType = "bearer",
            configTemplate = new {
                baseUrl = "https://erp.firma.com/api",
                endpoints = new object[] {
                    new {
                        path = "/v1/cariler?limit=500",
                        vaultPath = "logo/cariler.md", title = "Cariler",
                        rowsField = "data",
                        displayFields = new[] { "kod", "ad", "bakiye", "vergiNo" }
                    },
                    new {
                        path = "/v1/faturalar?from=2026-01-01&limit=1000",
                        vaultPath = "logo/faturalar.md", title = "Faturalar",
                        rowsField = "data",
                        displayFields = new[] { "no", "tarih", "cariAd", "tutar", "kdv" }
                    }
                }
            }
        },
        new {
            kind = "netsis",
            label = "Netsis ERP",
            description = "Netsis Wings/POS REST API. Cari, hareket, stok.",
            authType = "header",
            configTemplate = new {
                baseUrl = "https://netsis.firma.com:7070/api",
                headerName = "ApiKey",
                endpoints = new object[] {
                    new {
                        path = "/CariService.svc/GetCariList",
                        vaultPath = "netsis/cariler.md", title = "Netsis Cariler",
                        displayFields = new[] { "CariKod", "CariAdi", "Bakiye" }
                    }
                }
            }
        },
        new {
            kind = "salesforce",
            label = "Salesforce CRM",
            description = "Lead/Account/Opportunity/Contact SOQL üzerinden çek.",
            authType = "bearer",
            configTemplate = new {
                baseUrl = "https://YOUR-INSTANCE.my.salesforce.com",
                endpoints = new object[] {
                    new {
                        path = "/services/data/v59.0/query?q=SELECT+Id,Name,Industry,AnnualRevenue+FROM+Account+LIMIT+500",
                        vaultPath = "salesforce/accounts.md", title = "Accounts",
                        rowsField = "records",
                        displayFields = new[] { "Name", "Industry", "AnnualRevenue" }
                    },
                    new {
                        path = "/services/data/v59.0/query?q=SELECT+Id,Name,Amount,StageName,CloseDate+FROM+Opportunity+WHERE+IsClosed%3Dfalse+LIMIT+500",
                        vaultPath = "salesforce/opportunities.md", title = "Açık Fırsatlar",
                        rowsField = "records",
                        displayFields = new[] { "Name", "Amount", "StageName", "CloseDate" }
                    }
                }
            }
        },
        new {
            kind = "hubspot",
            label = "HubSpot CRM",
            description = "Companies, Deals, Contacts. v3 CRM API.",
            authType = "bearer",
            configTemplate = new {
                baseUrl = "https://api.hubapi.com",
                endpoints = new object[] {
                    new {
                        path = "/crm/v3/objects/companies?limit=100&properties=name,industry,annualrevenue",
                        vaultPath = "hubspot/companies.md", title = "Companies",
                        rowsField = "results",
                        displayFields = new[] { "id", "properties" }
                    },
                    new {
                        path = "/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate",
                        vaultPath = "hubspot/deals.md", title = "Deals",
                        rowsField = "results",
                        displayFields = new[] { "id", "properties" }
                    }
                }
            }
        },
        new {
            kind = "rest_api",
            label = "Generic REST API",
            description = "Herhangi bir REST endpoint'i — banka, fatura sağlayıcısı, internal tool.",
            authType = "none",
            configTemplate = new {
                baseUrl = "https://api.example.com",
                endpoints = new object[] {
                    new {
                        path = "/data?format=json",
                        vaultPath = "generic/data.md", title = "Sample Data"
                    }
                }
            }
        },
        new {
            kind = "csv",
            label = "Excel / CSV upload",
            description = "Tek seferlik dosya import — config.csvBase64 veya csvText.",
            authType = "none",
            configTemplate = new {
                csvText = "id,müşteri,tutar,tarih\n1,ACME Ltd,12500,2026-04-15\n2,Beta AŞ,8900,2026-04-22",
                delimiter = ",",
                groupByColumn = "",
                sheetName = "satış-q2"
            }
        },
    });

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
