namespace Altaris.Domain.Entities;

/// <summary>
///   RAG-layer chunk embedding for a vault file.
///   Sırasıyla: vault → file → chunk_index → vector.
///   embedding_model field zorunlu çünkü farklı sağlayıcılar/modeller
///   farklı boyutlarda vector üretir (1536 OpenAI, 384 sentence-tx, 1024 cohere).
///   Aynı tabloda farklı boyutlu vektörler için her query
///   `WHERE embedding_model = ?` filter'ı kullanmalı.
///
///   pgvector kolonu raw bytes/string yerine direkt 'vector' tipinde —
///   Pgvector.EntityFrameworkCore paketi ile EF üzerinden okunur/yazılır.
/// </summary>
public class VaultEmbedding
{
    public Guid Id { get; set; }
    public Guid VaultId { get; set; }
    public Guid TenantId { get; set; }
    public Guid? FileId { get; set; }
    public string FilePath { get; set; } = default!;
    public int ChunkIndex { get; set; }
    public string ChunkText { get; set; } = default!;
    public string EmbeddingModel { get; set; } = default!;
    public Pgvector.Vector? Embedding { get; set; }
    public DateTimeOffset IndexedAt { get; set; }
}
