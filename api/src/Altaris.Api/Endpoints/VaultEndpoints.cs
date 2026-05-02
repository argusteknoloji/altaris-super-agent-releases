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
        app.MapGet   ("/api/v1/vaults/{slug}/manifest",GetManifest).RequireAuthorization();   // path + bytes + sha256
        app.MapGet   ("/api/v1/vaults/{slug}/file",    GetFile).RequireAuthorization();      // ?path=relative
        app.MapPut   ("/api/v1/vaults/{slug}/file",    PutFile).RequireAuthorization();      // body: {path, content, parentChecksum?}
        app.MapDelete("/api/v1/vaults/{slug}/file",    DeleteFile).RequireAuthorization();

        app.MapPatch ("/api/v1/vaults/{slug}",         PatchVault).RequireAuthorization();   // body: {visibility?, name?}

        app.MapGet   ("/api/v1/vaults/{slug}/search",  Search).RequireAuthorization();       // ?q=...
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
                v.Id, v.Slug, v.Name, v.Status, v.Visibility, v.FileCount, v.ByteSize,
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
            // Seed FTS index with scaffold contents so search works on day one.
            foreach (var f in store.List(tc.TenantSlug, vault.Slug))
            {
                if (!IsIndexable(f.Path)) continue;
                string text;
                try { text = await store.ReadTextAsync(tc.TenantSlug, vault.Slug, f.Path, default); }
                catch { continue; }
                db.VaultFiles.Add(new Altaris.Domain.Entities.VaultFile
                {
                    Id = Guid.NewGuid(), VaultId = vault.Id, TenantId = vault.TenantId,
                    Path = f.Path, Content = text,
                    Sha256 = VaultStorage.ComputeChecksum(text), Bytes = text.Length,
                    IndexedAt = DateTimeOffset.UtcNow
                });
            }
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

    /// <summary>
    ///   PUT body. <c>ParentChecksum</c> is the SHA-256 the client believes the
    ///   server currently has — when present, the server checks before writing
    ///   and returns 409 + a conflict envelope if it doesn't match (typical
    ///   pattern when two devices edit the same note offline).
    /// </summary>
    public record PutFileRequest(string Path, string Content, string? ParentChecksum = null);

    private static async Task<IResult> PutFile(
        string slug, PutFileRequest body, AltarisDbContext db, ITenantContext tc,
        VaultStorage store, CancellationToken ct)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();

        // Conflict detection — if the client sent a parentChecksum it must match
        // the server-side current checksum (or both must be empty for new files).
        if (body.ParentChecksum is not null)
        {
            string current;
            try { current = store.ComputeChecksum(tc.TenantSlug, slug, body.Path); }
            catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }

            if (!string.Equals(current, body.ParentChecksum, StringComparison.OrdinalIgnoreCase))
            {
                string serverContent = "";
                try { serverContent = await store.ReadTextAsync(tc.TenantSlug, slug, body.Path, ct); }
                catch { /* file may have been deleted */ }
                return Results.Conflict(new
                {
                    error = "checksum_mismatch",
                    serverChecksum = current,
                    serverContent,
                    yourChecksum   = body.ParentChecksum
                });
            }
        }

        try
        {
            await store.WriteTextAsync(tc.TenantSlug, slug, body.Path, body.Content, ct);
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }

        var v = await db.Vaults.FirstAsync(x => x.TenantId == tc.TenantId && x.Slug == slug, ct);
        var (files, bytes) = store.Stats(tc.TenantSlug, slug);
        v.FileCount = files; v.ByteSize = bytes; v.UpdatedAt = DateTimeOffset.UtcNow;

        // FTS index upsert. Only .md (and a small allowlist) actually need
        // searchable bytes; everything else stays disk-only.
        if (IsIndexable(body.Path))
        {
            var contentHash = VaultStorage.ComputeChecksum(body.Content);
            var row = await db.VaultFiles.FirstOrDefaultAsync(
                x => x.VaultId == v.Id && x.Path == body.Path, ct);
            if (row is null)
            {
                db.VaultFiles.Add(new Altaris.Domain.Entities.VaultFile
                {
                    Id = Guid.NewGuid(), VaultId = v.Id, TenantId = v.TenantId,
                    Path = body.Path, Content = body.Content,
                    Sha256 = contentHash, Bytes = body.Content.Length,
                    IndexedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                row.Content   = body.Content;
                row.Sha256    = contentHash;
                row.Bytes     = body.Content.Length;
                row.IndexedAt = DateTimeOffset.UtcNow;
            }
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            path     = body.Path,
            checksum = VaultStorage.ComputeChecksum(body.Content)
        });
    }

    private static bool IsIndexable(string path)
    {
        var lower = path.ToLowerInvariant();
        return lower.EndsWith(".md") || lower.EndsWith(".markdown")
            || lower.EndsWith(".txt") || lower.EndsWith(".json")
            || lower.EndsWith(".yaml") || lower.EndsWith(".yml");
    }

    /// <summary>
    ///   Manifest = tree + per-file SHA256. Used by `altaris vault push` to
    ///   diff local against server before issuing PUTs (saves bandwidth and
    ///   surfaces the conflict candidates upfront).
    /// </summary>
    private static IResult GetManifest(string slug, ITenantContext tc, VaultStorage store)
    {
        if (tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        var rows = store.List(tc.TenantSlug, slug)
            .Select(f => new {
                path = f.Path,
                bytes = f.Bytes,
                modifiedUtc = f.ModifiedUtc,
                sha256 = store.ComputeChecksum(tc.TenantSlug, slug, f.Path)
            })
            .ToList();
        return Results.Ok(rows);
    }

    public record PatchVaultRequest(string? Visibility, string? Name);

    private static async Task<IResult> PatchVault(
        string slug, PatchVaultRequest body, AltarisDbContext db, ITenantContext tc, CancellationToken ct)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var v = await db.Vaults.FirstOrDefaultAsync(x => x.TenantId == tc.TenantId && x.Slug == slug, ct);
        if (v is null) return Results.NotFound();
        if (v.OwnerUserId != tc.UserId) return Results.Forbid();   // only owner

        if (!string.IsNullOrWhiteSpace(body.Visibility))
        {
            var vis = body.Visibility.Trim().ToLowerInvariant();
            if (vis is not ("private" or "tenant" or "executive"))
                return Results.BadRequest(new { error = "visibility must be private | tenant | executive" });
            v.Visibility = vis;
        }
        if (!string.IsNullOrWhiteSpace(body.Name))
            v.Name = body.Name.Trim();

        v.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { v.Id, v.Slug, v.Name, v.Visibility });
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

        var idx = await db.VaultFiles.FirstOrDefaultAsync(x => x.VaultId == v.Id && x.Path == path, ct);
        if (idx is not null) db.VaultFiles.Remove(idx);

        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    /// <summary>
    ///   Vault full-text search (Postgres). websearch_to_tsquery understands
    ///   "double quotes", -negation, OR — same surface as GitHub/Slack search.
    ///   ts_headline picks the most relevant snippet for each hit; the trigram
    ///   index gives us fuzzy fallback when the user mistypes.
    /// </summary>
    private static async Task<IResult> Search(string slug, string q, AltarisDbContext db, ITenantContext tc, VaultStorage store, int limit = 50, CancellationToken ct = default)
    {
        if (tc.TenantId is null || tc.TenantSlug is null) return Results.Forbid();
        if (!store.VaultExists(tc.TenantSlug, slug)) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(q)) return Results.Ok(Array.Empty<object>());

        var v = await db.Vaults.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tc.TenantId && x.Slug == slug, ct);
        if (v is null) return Results.NotFound();

        var sql = @"
            SELECT path,
                   ts_headline('simple', content,
                       websearch_to_tsquery('simple', {0}),
                       'StartSel=«,StopSel=»,MaxFragments=2,MaxWords=18,MinWords=5'
                   )                                                          AS snippet,
                   ts_rank(ts, websearch_to_tsquery('simple', {0}))           AS rank,
                   GREATEST(
                       ts_rank(ts, websearch_to_tsquery('simple', {0})),
                       similarity(content, {0}) * 0.3
                   )                                                          AS score
            FROM vault_files
            WHERE vault_id = {1}
              AND (ts @@ websearch_to_tsquery('simple', {0})
                   OR content ILIKE '%' || {0} || '%'
                   OR content % {0})
            ORDER BY score DESC
            LIMIT {2}";

        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);

        // Use raw ADO so we can read arbitrary columns without an entity type.
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = string.Format(sql,
            "@q", "@vid", "@lim").Replace("{0}", "@q").Replace("{1}", "@vid").Replace("{2}", "@lim");
        // The format-replacement above is just to keep the SQL readable; rebuild
        // with named params.
        cmd.CommandText = @"
            SELECT path,
                   ts_headline('simple', content,
                       websearch_to_tsquery('simple', @q),
                       'StartSel=«,StopSel=»,MaxFragments=2,MaxWords=18,MinWords=5'
                   ) AS snippet
            FROM vault_files
            WHERE vault_id = @vid
              AND (ts @@ websearch_to_tsquery('simple', @q)
                   OR content ILIKE '%' || @q || '%'
                   OR content % @q)
            ORDER BY GREATEST(
                ts_rank(ts, websearch_to_tsquery('simple', @q)),
                similarity(content, @q) * 0.3
            ) DESC
            LIMIT @lim";

        var pq   = cmd.CreateParameter(); pq.ParameterName = "q";   pq.Value = q;       cmd.Parameters.Add(pq);
        var pvid = cmd.CreateParameter(); pvid.ParameterName = "vid"; pvid.Value = v.Id; cmd.Parameters.Add(pvid);
        var plim = cmd.CreateParameter(); plim.ParameterName = "lim"; plim.Value = limit; cmd.Parameters.Add(plim);

        var hits = new List<object>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            hits.Add(new
            {
                path     = rd.GetString(0),
                snippet  = rd.IsDBNull(1) ? "" : rd.GetString(1),
                lineHint = 1   // FTS doesn't return line numbers; keep field for UI compat.
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
