using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Altaris.Infrastructure.Vaults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Vault REST surface — list / create / browse / read / write / delete /
///   search (ripgrep-style scan) / graph (wikilink network).
/// </summary>
public static class VaultEndpoints
{
    public static IEndpointRouteBuilder MapVaultEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet   ("/api/v1/vaults",                ListVaults).RequireAuthorization();
        app.MapPost  ("/api/v1/vaults",                CreateVault).RequireAuthorization();
        app.MapDelete("/api/v1/vaults/{slug}",         DeleteVault).RequireAuthorization();

        app.MapGet   ("/api/v1/vaults/{slug}/tree",    GetTree).RequireAuthorization();
        app.MapGet   ("/api/v1/vaults/{slug}/file",    GetFile).RequireAuthorization();   // ?path=relative
        app.MapPut   ("/api/v1/vaults/{slug}/file",    PutFile).RequireAuthorization();   // body: {path, content}
        app.MapDelete("/api/v1/vaults/{slug}/file",    DeleteFile).RequireAuthorization();

        app.MapGet   ("/api/v1/vaults/{slug}/search",  Search).RequireAuthorization();    // ?q=...
        app.MapGet   ("/api/v1/vaults/{slug}/graph",   Graph).RequireAuthorization();
        return app;
    }

    // ─── REST ────────────────────────────────────────────────────────────────

    private static async Task<IResult> ListVaults(AltarisDbContext db, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var rows = await db.Vaults
            .Where(v => v.TenantId == tc.TenantId)
            .OrderByDescending(v => v.UpdatedAt)
            .Join(db.Users, v => v.OwnerUserId, u => u.Id, (v, u) => new
            {
                v.Id, v.Slug, v.Name, v.Status, v.FileCount, v.ByteSize,
                v.CreatedAt, v.UpdatedAt,
                owner = new { id = u.Id, email = u.Email }
            })
            .ToListAsync();
        return Results.Ok(rows);
    }

    public record CreateVaultRequest(string Slug, string Name);

    private static async Task<IResult> CreateVault(
        CreateVaultRequest req, AltarisDbContext db, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantId is null || tc.UserId is null || tc.TenantSlug is null) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(req.Slug) || string.IsNullOrWhiteSpace(req.Name))
            return Results.BadRequest(new { error = "slug + name required" });

        if (await db.Vaults.AnyAsync(v => v.TenantId == tc.TenantId && v.Slug == req.Slug.ToLowerInvariant()))
            return Results.Conflict(new { error = "slug already exists" });

        var vault = new Vault
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            OwnerUserId = tc.UserId.Value,
            Slug = req.Slug.ToLowerInvariant(),
            Name = req.Name.Trim(),
            Status = "active",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Vaults.Add(vault);

        try
        {
            var path = store.VaultPath(tc.TenantSlug, vault.Slug);
            VaultScaffold.Apply(path, vault.Name);
            var (files, bytes) = store.Stats(tc.TenantSlug, vault.Slug);
            vault.FileCount = files;
            vault.ByteSize  = bytes;
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            try { store.DeleteVault(tc.TenantSlug, vault.Slug); } catch { }
            return Results.Problem(detail: ex.Message);
        }

        return Results.Created($"/api/v1/vaults/{vault.Slug}", new
        {
            id = vault.Id, slug = vault.Slug, name = vault.Name,
            fileCount = vault.FileCount, byteSize = vault.ByteSize
        });
    }

    private static async Task<IResult> DeleteVault(
        string slug, AltarisDbContext db, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        var v = await db.Vaults.FirstOrDefaultAsync(x => x.TenantId == tc.TenantId && x.Slug == slug);
        if (v is null) return Results.NotFound();
        if (v.OwnerUserId != tc.UserId) return Results.Forbid();   // only owner
        try { store.DeleteVault(tc.TenantSlug, v.Slug); } catch { }
        db.Vaults.Remove(v);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static IResult GetTree(string slug, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        return Results.Ok(store.List(tc.TenantSlug, slug).OrderBy(f => f.Path).ToList());
    }

    private static async Task<IResult> GetFile(string slug, string path, ITenantContext tc, VaultStorage store, CancellationToken ct)
    {
        if (tc.TenantSlug is null) return Results.Forbid();
        try
        {
            var content = await store.ReadTextAsync(tc.TenantSlug, slug, path, ct);
            return Results.Ok(new { path, content });
        }
        catch (FileNotFoundException) { return Results.NotFound(); }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
    }

    public record PutFileRequest(string Path, string Content);

    private static async Task<IResult> PutFile(
        string slug, PutFileRequest body, AltarisDbContext db, ITenantContext tc,
        VaultStorage store, CancellationToken ct)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        try
        {
            await store.WriteTextAsync(tc.TenantSlug, slug, body.Path, body.Content, ct);
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }

        var v = await db.Vaults.FirstAsync(x => x.TenantId == tc.TenantId && x.Slug == slug, ct);
        var (files, bytes) = store.Stats(tc.TenantSlug, slug);
        v.FileCount = files; v.ByteSize = bytes; v.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteFile(
        string slug, string path, AltarisDbContext db, ITenantContext tc, VaultStorage store, CancellationToken ct)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        try { store.Delete(tc.TenantSlug, slug, path); }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
        var v = await db.Vaults.FirstAsync(x => x.TenantId == tc.TenantId && x.Slug == slug, ct);
        var (files, bytes) = store.Stats(tc.TenantSlug, slug);
        v.FileCount = files; v.ByteSize = bytes; v.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Search(string slug, string q, ITenantContext tc, VaultStorage store, int limit = 50, CancellationToken ct = default)
    {
        if (tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(q)) return Results.Ok(Array.Empty<object>());

        var hits = new List<object>();
        var needle = q.ToLowerInvariant();
        foreach (var f in store.List(tc.TenantSlug, slug))
        {
            if (hits.Count >= limit) break;
            if (!f.Path.EndsWith(".md", StringComparison.OrdinalIgnoreCase)) continue;
            string text;
            try { text = await store.ReadTextAsync(tc.TenantSlug, slug, f.Path, ct); }
            catch { continue; }
            var lower = text.ToLowerInvariant();
            var idx = lower.IndexOf(needle);
            if (idx < 0) continue;
            var start = Math.Max(0, idx - 60);
            var end   = Math.Min(text.Length, idx + needle.Length + 60);
            hits.Add(new
            {
                path = f.Path,
                snippet = (start > 0 ? "…" : "") + text.Substring(start, end - start) + (end < text.Length ? "…" : ""),
                lineHint = text.Substring(0, idx).Count(c => c == '\n') + 1
            });
        }
        return Results.Ok(hits);
    }

    private static IResult Graph(string slug, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        return Results.Ok(store.BuildGraph(tc.TenantSlug, slug));
    }
}
