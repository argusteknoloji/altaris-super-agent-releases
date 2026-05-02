using Altaris.Infrastructure.Embeddings;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Şirketin İkinci Beyni — yöneticinin doğal dilde sorduğu sorulara,
///   tenant'ın vault'larından + (Sprint EB-2 sonrası) connector'larından
///   gelen veriye dayanarak kaynak gösteren cevap üretir.
///
///   MVP akışı (bu endpoint):
///     1. Kullanıcı sorusu → embedding üret
///     2. Tenant'ın executive-flag'li vault'larında semantic search (top-k chunk)
///     3. Chunk'ları context'e koy, LLM'e prompt yaz
///     4. LLM cevabı + chunk path'lerinden citation listesi
///     5. SSE stream cevap (UI yazıldıkça gelir)
///
///   Sonraki sprint'lerde:
///     - Connector verilerini search index'ine ekle (EB-2)
///     - Risk/forecast özel araçlar (EB-5/EB-6)
///     - Daily brief cron (EB-5)
/// </summary>
public static class ExecutiveBrainEndpoints
{
    public static IEndpointRouteBuilder MapExecutiveBrainEndpoints(this IEndpointRouteBuilder app)
    {
        // RAG ask — JSON cevap (MVP, streaming sonra).
        app.MapPost("/api/v1/executive-brain/ask", Ask).RequireAuthorization();

        // Sources lookup — bir cevabın citation'larını görüntüle.
        // Şu an inline döner; ileride multi-vault search için ayrı endpoint.

        return app;
    }

    public record AskRequest(string Question, int? TopK, bool? IncludeAllVaults);
    public record Citation(string Vault, string Path, int ChunkIndex, string Snippet, float Distance);
    public record AskResponse(string Question, string Answer, IReadOnlyList<Citation> Sources, string Model, int VaultCount);

    private static async Task<IResult> Ask(
        AskRequest req,
        AltarisDbContext db, ITenantContext tc,
        EmbeddingClient embed, EmbeddingIndexer indexer,
        IHttpClientFactory httpFactory,
        CancellationToken ct)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(req.Question))
            return Results.BadRequest(new { error = "question_required" });

        // 1. Provider çöz (embedding + LLM aynı tenant default'undan)
        var prov = await db.ProviderConfigs.AsNoTracking()
            .Where(p => p.TenantId == tc.TenantId && p.Enabled)
            .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Provider)
            .FirstOrDefaultAsync(ct);
        if (prov is null)
            return Results.BadRequest(new { error = "no_provider" });

        var embeddingModel = (prov.DefaultModel ?? "").Contains("embed", StringComparison.OrdinalIgnoreCase)
            ? prov.DefaultModel!
            : "text-embedding-3-small";
        var llmModel = (prov.DefaultModel ?? "claude-sonnet-4-6");
        if (llmModel.Contains("embed", StringComparison.OrdinalIgnoreCase)) llmModel = "claude-sonnet-4-6";

        // 2. Hangi vault'larda arayacağız? Default: visibility executive + tenant.
        //    includeAllVaults=true ise private dahil hepsini ara (tenant_admin önerilir).
        var vaultQuery = db.Vaults.AsNoTracking().Where(v => v.TenantId == tc.TenantId);
        if (req.IncludeAllVaults != true)
            vaultQuery = vaultQuery.Where(v => v.Visibility == "executive" || v.Visibility == "tenant");
        var vaults = await vaultQuery.Select(v => new { v.Id, v.Slug }).ToListAsync(ct);

        if (vaults.Count == 0)
        {
            return Results.Ok(new AskResponse(
                req.Question,
                "Bu tenant'ta executive-erişimli vault yok. Önce admin panelinden bir vault'a 'tenant' veya 'executive' visibility ver, içine doküman ekle ve reindex'le.",
                Array.Empty<Citation>(), llmModel, 0));
        }

        // 3. Soruyu embedding'e çevir
        EmbeddingClient.EmbedResult queryEmbed;
        try
        {
            queryEmbed = await embed.EmbedAsync(new EmbeddingClient.EmbedRequest(
                prov.BaseUrl ?? "", prov.ApiKeyEnc ?? "", embeddingModel, new[] { req.Question }), ct);
        }
        catch (Exception ex)
        {
            return Results.Problem($"Soru embedding'i üretilemedi: {ex.Message}", statusCode: 502);
        }
        if (queryEmbed.Vectors.Count == 0)
            return Results.Problem("Embedding boş döndü", statusCode: 502);

        // 4. Her vault'ta semantic search, top-k chunk topla
        var k = Math.Clamp(req.TopK ?? 6, 1, 20);
        var allHits = new List<(string vaultSlug, EmbeddingIndexer.SearchHit hit)>();
        foreach (var v in vaults)
        {
            try
            {
                var hits = await indexer.SearchAsync(v.Id, embeddingModel, queryEmbed.Vectors[0], k, ct);
                foreach (var h in hits) allHits.Add((v.Slug, h));
            }
            catch { /* tek vault fail diğerlerini engellemez */ }
        }
        // Distance ASC sırala, top-k al (multi-vault cross-aggregate)
        allHits.Sort((a, b) => a.hit.Distance.CompareTo(b.hit.Distance));
        var topHits = allHits.Take(k).ToList();

        if (topHits.Count == 0)
        {
            return Results.Ok(new AskResponse(
                req.Question,
                "İlgili bilgi bulamadım. Vault'larında bu konuyla ilgili doküman olmayabilir veya vault embedding index'i eksik (admin panelinden 'Reindex' butonuna bas).",
                Array.Empty<Citation>(), llmModel, vaults.Count));
        }

        // 5. LLM context'i hazırla — her chunk'a [n] etiketi ver, prompt'a yaz
        var contextParts = new List<string>();
        var citations = new List<Citation>();
        for (int i = 0; i < topHits.Count; i++)
        {
            var (slug, h) = topHits[i];
            var label = $"[{i + 1}]";
            contextParts.Add($"{label} Kaynak: {slug}/{h.FilePath} (chunk {h.ChunkIndex})\n{h.Snippet}\n");
            citations.Add(new Citation(slug, h.FilePath, h.ChunkIndex, h.Snippet, h.Distance));
        }

        var systemPrompt = """
            Sen Altaris Executive Brain'sin — yöneticilerin sorularına şirketin
            kendi belge tabanından cevap veren bir AI'sın.

            KURALLAR:
            1. SADECE aşağıdaki context'te verilen bilgileri kullan. Tahmin etme,
               uydurma, dış bilgi ekleme.
            2. Her cümlenin sonunda kaynağını köşeli parantezde belirt: [1] [2] vb.
            3. Cevap context'te yoksa: "Bu soruya cevap verecek belge bulamadım"
               de + ne tür belge eklenmesi gerektiğini öner.
            4. Türkçe cevap ver, kısa ve direkt ol — yönetici zamanı kıymetli.
            5. Sayısal veri varsa kaynaktan birebir alıntıla, hesaplama yapma.
            """;
        var userPrompt =
            "Soru: " + req.Question + "\n\n" +
            "İlgili belge parçaları:\n\n" + string.Join("\n", contextParts) +
            "\nKurallara uyarak cevap ver.";

        // 6. LLM çağrısı (provider-agnostic: OpenAI compat shape kullanılır)
        var llm = httpFactory.CreateClient();
        var llmEndpoint = (prov.BaseUrl ?? "").TrimEnd('/') + "/v1/chat/completions";
        var msg = new HttpRequestMessage(HttpMethod.Post, llmEndpoint)
        {
            Content = System.Net.Http.Json.JsonContent.Create(new
            {
                model = llmModel,
                messages = new[] {
                    new { role = "system", content = systemPrompt },
                    new { role = "user",   content = userPrompt   }
                },
                max_tokens = 1024,
                temperature = 0.2
            }),
        };
        if (!string.IsNullOrEmpty(prov.ApiKeyEnc))
            msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", prov.ApiKeyEnc);

        string answer;
        try
        {
            using var resp = await llm.SendAsync(msg, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var errText = await resp.Content.ReadAsStringAsync(ct);
                return Results.Problem($"LLM hatası: HTTP {resp.StatusCode} — {errText}", statusCode: 502);
            }
            var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(cancellationToken: ct);
            answer = body.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
        }
        catch (Exception ex)
        {
            return Results.Problem($"LLM bağlantısı: {ex.Message}", statusCode: 502);
        }

        // 7. Audit kaydı — kim ne sordu, hangi kaynaklardan cevap geldi
        db.AuditEvents.Add(new Domain.Entities.AuditEvent
        {
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId,
            Actor = tc.UserEmail ?? "unknown",
            Action = "executive_brain.ask",
            ResourceType = "question",
            ResourceId = null,
            Payload = System.Text.Json.JsonSerializer.Serialize(new
            {
                question = req.Question,
                model = llmModel,
                citations = citations.Select(c => $"{c.Vault}/{c.Path}:{c.ChunkIndex}"),
                answerChars = answer.Length,
            }),
            OccurredAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        return Results.Ok(new AskResponse(req.Question, answer, citations, llmModel, vaults.Count));
    }
}
