using Altaris.Domain.Entities;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Altaris.Infrastructure.Embeddings;

/// <summary>
///   File-level ingestion: bir vault dosyasını chunk'la, tenant'ın aktif
///   embedding provider'ından embedding al, vault_embeddings tablosuna upsert.
///   Idempotent: aynı (vault_id, file_path, chunk_index, model) için
///   varsa update, yoksa insert.
/// </summary>
public class EmbeddingIndexer
{
    private readonly AltarisDbContext _db;
    private readonly EmbeddingClient _client;
    private readonly ILogger<EmbeddingIndexer> _log;

    public EmbeddingIndexer(AltarisDbContext db, EmbeddingClient client, ILogger<EmbeddingIndexer> log)
    {
        _db = db; _client = client; _log = log;
    }

    public record IngestRequest(
        Guid VaultId, Guid TenantId, Guid? FileId, string FilePath, string Content,
        string EmbeddingBaseUrl, string EmbeddingApiKey, string EmbeddingModel);

    public async Task IngestAsync(IngestRequest req, CancellationToken ct = default)
    {
        var chunks = Chunker.Split(req.Content);
        if (chunks.Count == 0)
        {
            _log.LogDebug("EmbedIndex skip empty: {Path}", req.FilePath);
            return;
        }

        // Embedding provider'a tek seferde batch yolla (bandwidth tasarrufu).
        var inputs = chunks.Select(c => c.Text).ToList();
        EmbeddingClient.EmbedResult result;
        try
        {
            result = await _client.EmbedAsync(
                new EmbeddingClient.EmbedRequest(
                    req.EmbeddingBaseUrl, req.EmbeddingApiKey, req.EmbeddingModel, inputs),
                ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Embedding fetch failed for {Path}", req.FilePath);
            return;
        }

        // Eski chunk'ları (file_path için) temizle — file güncellendiyse
        // chunk count azalmış olabilir, orphan satırı olmasın.
        await _db.VaultEmbeddings
            .Where(e => e.VaultId == req.VaultId
                     && e.FilePath == req.FilePath
                     && e.EmbeddingModel == req.EmbeddingModel)
            .ExecuteDeleteAsync(ct);

        for (int i = 0; i < chunks.Count; i++)
        {
            _db.VaultEmbeddings.Add(new VaultEmbedding
            {
                Id = Guid.NewGuid(),
                VaultId = req.VaultId,
                TenantId = req.TenantId,
                FileId = req.FileId,
                FilePath = req.FilePath,
                ChunkIndex = chunks[i].Index,
                ChunkText = chunks[i].Text,
                EmbeddingModel = req.EmbeddingModel,
                Embedding = new Pgvector.Vector(result.Vectors[i]),
                IndexedAt = DateTimeOffset.UtcNow,
            });
        }
        await _db.SaveChangesAsync(ct);
        _log.LogInformation("Embedded {Chunks} chunks for {Path} ({Model})",
            chunks.Count, req.FilePath, req.EmbeddingModel);
    }

    public async Task RemoveAsync(Guid vaultId, string filePath, CancellationToken ct = default)
    {
        await _db.VaultEmbeddings
            .Where(e => e.VaultId == vaultId && e.FilePath == filePath)
            .ExecuteDeleteAsync(ct);
    }

    public record SearchHit(string FilePath, int ChunkIndex, string Snippet, float Distance);

    /// <summary>
    ///   Cosine similarity arama. Pgvector operatörü `<=>` (cosine distance,
    ///   küçük = daha benzer). LIMIT k semantic top hit.
    /// </summary>
    public async Task<IReadOnlyList<SearchHit>> SearchAsync(
        Guid vaultId, string embeddingModel, float[] queryVector, int k, CancellationToken ct = default)
    {
        var qVec = new Pgvector.Vector(queryVector);
        // EF.Functions / Pgvector raw extension için raw-SQL en stabil:
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT file_path, chunk_index, chunk_text,
                   embedding <=> @vec AS distance
            FROM vault_embeddings
            WHERE vault_id = @vid AND embedding_model = @model
            ORDER BY embedding <=> @vec ASC
            LIMIT @k";
        var pVec   = cmd.CreateParameter(); pVec.ParameterName   = "vec";   pVec.Value = qVec;            cmd.Parameters.Add(pVec);
        var pVid   = cmd.CreateParameter(); pVid.ParameterName   = "vid";   pVid.Value = vaultId;         cmd.Parameters.Add(pVid);
        var pModel = cmd.CreateParameter(); pModel.ParameterName = "model"; pModel.Value = embeddingModel; cmd.Parameters.Add(pModel);
        var pK     = cmd.CreateParameter(); pK.ParameterName     = "k";     pK.Value = k;                  cmd.Parameters.Add(pK);

        var hits = new List<SearchHit>();
        await using var rd = await cmd.ExecuteReaderAsync(ct);
        while (await rd.ReadAsync(ct))
        {
            var text = rd.GetString(2);
            var snippet = text.Length > 400 ? text[..400] + "…" : text;
            hits.Add(new SearchHit(rd.GetString(0), rd.GetInt32(1), snippet, (float)rd.GetDouble(3)));
        }
        return hits;
    }
}
