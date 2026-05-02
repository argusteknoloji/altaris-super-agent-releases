using Altaris.Domain.Entities;
using Altaris.Infrastructure.Embeddings;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Altaris.Api.Services;

/// <summary>
///   BackgroundService — pending executive_jobs satırlarını claim edip
///   RAG + LLM pipeline ile işler. Multi-instance safe (claim atomik update),
///   stale-claim recovery (60sn aşımı), retry-friendly.
///
///   Çalışma akışı:
///     1. SELECT FOR UPDATE SKIP LOCKED ile pending job al, claim et
///     2. Status → running, started_at = now
///     3. Tenant context + agent çöz
///     4. Provider çöz (embedding + LLM)
///     5. Question embedding üret
///     6. Vault filter'a göre semantic search
///     7. LLM call (system prompt = agent.SystemPrompt veya default)
///     8. Citation + answer + trace yaz, status → completed
///     9. Hata varsa: status → failed, error_text yaz
/// </summary>
public class ExecutiveJobWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ExecutiveJobWorker> _log;
    private readonly string _workerId = Environment.MachineName + ":" + Guid.NewGuid().ToString("N")[..8];

    public ExecutiveJobWorker(IServiceScopeFactory scopes, ILogger<ExecutiveJobWorker> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("ExecutiveJobWorker started ({WorkerId})", _workerId);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var didWork = await ProcessOneAsync(stoppingToken);
                if (!didWork)
                {
                    // Boş kuyruk → 2 sn bekle (DB load'unu kısıtla)
                    await Task.Delay(2000, stoppingToken);
                }
                // Stale claim recovery (60sn'den fazla running ama heartbeat yok)
                await ReleaseStaleClaimsAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Worker loop error");
                await Task.Delay(5000, stoppingToken);
            }
        }
    }

    /// <summary>Atomik olarak bir pending job claim et. Yoksa false döner.</summary>
    private async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();

        // Atomik claim: SELECT FOR UPDATE SKIP LOCKED ile race-free.
        // RLS'i bypass etmek için schema-owner role'üyle çalışıyoruz; init.sql
        // POLICY 'app.tenant_id' set'lemediğinde tüm satırları görür.
        // Worker hiç tenant context set etmediği için bu doğal.
        var job = await db.ExecutiveJobs
            .FromSqlRaw(@"
                UPDATE executive_jobs SET
                  status = 'running',
                  claimed_by = {0},
                  claimed_at = now(),
                  started_at = now()
                WHERE id = (
                  SELECT id FROM executive_jobs
                  WHERE status = 'pending'
                    AND (scheduled_for IS NULL OR scheduled_for <= now())
                  ORDER BY created_at
                  FOR UPDATE SKIP LOCKED
                  LIMIT 1
                )
                RETURNING *", _workerId)
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (job is null) return false;

        _log.LogInformation("Claimed job {JobId} for tenant {TenantId}", job.Id, job.TenantId);

        // Tenant context — RLS için (vault_embeddings sorguları)
        await db.Database.ExecuteSqlRawAsync(
            "SELECT set_config('app.tenant_id', {0}, true)", job.TenantId.ToString());

        var trace = new List<object>();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await ExecuteJobAsync(scope, db, job, trace, ct);
            await MarkCompletedAsync(db, job.Id, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Job {JobId} failed", job.Id);
            await MarkFailedAsync(db, job.Id, ex.Message, trace, ct);
        }
        return true;
    }

    private async Task ExecuteJobAsync(IServiceScope scope, AltarisDbContext db, ExecutiveJob job,
        List<object> trace, CancellationToken ct)
    {
        var http = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
        var embed = scope.ServiceProvider.GetRequiredService<EmbeddingClient>();
        var indexer = scope.ServiceProvider.GetRequiredService<EmbeddingIndexer>();

        // 1. Agent + provider çöz
        ExecutiveAgent? agent = null;
        if (job.AgentId is { } aid)
            agent = await db.ExecutiveAgents.AsNoTracking().FirstOrDefaultAsync(a => a.Id == aid, ct);

        var prov = await db.ProviderConfigs.AsNoTracking()
            .Where(p => p.TenantId == job.TenantId && p.Enabled)
            .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Provider)
            .FirstOrDefaultAsync(ct);
        if (prov is null) throw new InvalidOperationException("no_provider_configured");

        var embeddingModel = agent?.EmbeddingModel
            ?? ((prov.DefaultModel ?? "").Contains("embed", StringComparison.OrdinalIgnoreCase)
                ? prov.DefaultModel!
                : "text-embedding-3-small");
        var llmModel = agent?.Model ?? prov.DefaultModel ?? "claude-sonnet-4-6";
        if (llmModel.Contains("embed", StringComparison.OrdinalIgnoreCase)) llmModel = "claude-sonnet-4-6";

        trace.Add(new { step = "resolve_agent_provider", ms = 0, agent = agent?.Slug, model = llmModel, embedModel = embeddingModel });

        // 2. Vault filter
        var sw = System.Diagnostics.Stopwatch.StartNew();
        IQueryable<Vault> vq = db.Vaults.AsNoTracking().Where(v => v.TenantId == job.TenantId);
        string[]? filter = null;
        if (agent?.VaultFilter is not null)
        {
            try { filter = JsonSerializer.Deserialize<string[]>(agent.VaultFilter); } catch { }
        }
        if (filter is not null && filter.Length > 0)
            vq = vq.Where(v => filter.Contains(v.Slug));
        else
            vq = vq.Where(v => v.Visibility == "executive" || v.Visibility == "tenant");
        var vaults = await vq.Select(v => new { v.Id, v.Slug }).ToListAsync(ct);
        trace.Add(new { step = "vault_filter", ms = sw.ElapsedMilliseconds, count = vaults.Count });

        if (vaults.Count == 0)
        {
            await SaveAnswerAsync(db, job.Id,
                "Bu sorguya erişimli vault bulunamadı. Önce admin panelinden bir vault'a 'executive' veya 'tenant' visibility ver.",
                Array.Empty<object>(), trace, ct);
            return;
        }

        // 3. Question embedding
        sw.Restart();
        EmbeddingClient.EmbedResult queryEmb;
        try
        {
            queryEmb = await embed.EmbedAsync(new EmbeddingClient.EmbedRequest(
                prov.BaseUrl ?? "", prov.ApiKeyEnc ?? "", embeddingModel, new[] { job.Question }), ct);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Embedding üretilemedi: {ex.Message}", ex);
        }
        trace.Add(new { step = "question_embed", ms = sw.ElapsedMilliseconds, model = embeddingModel });

        // 4. Cross-vault search
        sw.Restart();
        var allHits = new List<(string slug, EmbeddingIndexer.SearchHit hit)>();
        foreach (var v in vaults)
        {
            try
            {
                var hits = await indexer.SearchAsync(v.Id, embeddingModel, queryEmb.Vectors[0], 6, ct);
                foreach (var h in hits) allHits.Add((v.Slug, h));
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Vault {VaultId} search failed", v.Id);
            }
        }
        allHits.Sort((a, b) => a.hit.Distance.CompareTo(b.hit.Distance));
        var top = allHits.Take(8).ToList();
        trace.Add(new { step = "semantic_search", ms = sw.ElapsedMilliseconds, hits = top.Count });

        if (top.Count == 0)
        {
            await SaveAnswerAsync(db, job.Id,
                "İlgili belge bulamadım. Vault embedding index'i eksik olabilir — admin panelinden 'Reindex' çalıştır.",
                Array.Empty<object>(), trace, ct);
            return;
        }

        // 5. LLM context
        sw.Restart();
        var contextParts = new List<string>();
        var citations = new List<object>();
        for (int i = 0; i < top.Count; i++)
        {
            var label = $"[{i + 1}]";
            contextParts.Add($"{label} Kaynak: {top[i].slug}/{top[i].hit.FilePath} (chunk {top[i].hit.ChunkIndex})\n{top[i].hit.Snippet}\n");
            citations.Add(new {
                vault = top[i].slug, path = top[i].hit.FilePath,
                chunkIndex = top[i].hit.ChunkIndex, snippet = top[i].hit.Snippet,
                distance = top[i].hit.Distance,
            });
        }

        var systemPrompt = agent?.SystemPrompt ?? """
            Sen Altaris Executive Brain'sin. SADECE verilen context'i kullan,
            tahmin etme. Her cümlede [n] citation ver. Türkçe, kısa, doğrudan.
            """;
        var userPrompt = $"Soru: {job.Question}\n\nİlgili belgeler:\n\n" +
                         string.Join("\n", contextParts) +
                         "\nKurallara uyarak cevap ver.";

        // Multi-turn: thread'in önceki turn'lerini kısaca context'e ekle
        var prior = await db.ExecutiveJobs.AsNoTracking()
            .Where(p => p.ThreadId == job.ThreadId
                     && p.Id != job.Id
                     && p.Status == "completed"
                     && p.CompletedAt < job.CreatedAt)
            .OrderByDescending(p => p.CreatedAt)
            .Take(3)
            .Select(p => new { p.Question, p.Answer })
            .ToListAsync(ct);
        if (prior.Count > 0)
        {
            var memory = string.Join("\n",
                prior.AsEnumerable().Reverse().Select((p, i) =>
                    $"Önceki tur {i + 1}: Soru → {p.Question}\nCevap → {p.Answer?[..Math.Min(p.Answer.Length, 600)]}"));
            userPrompt = "Önceki konuşma:\n" + memory + "\n\n---\n" + userPrompt;
        }

        var llm = http.CreateClient();
        llm.Timeout = TimeSpan.FromMinutes(3);
        var llmEndpoint = (prov.BaseUrl ?? "").TrimEnd('/') + "/v1/chat/completions";
        var msg = new HttpRequestMessage(HttpMethod.Post, llmEndpoint)
        {
            Content = System.Net.Http.Json.JsonContent.Create(new
            {
                model = llmModel,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user",   content = userPrompt   },
                },
                max_tokens = 2048,
                temperature = 0.2,
            }),
        };
        if (!string.IsNullOrEmpty(prov.ApiKeyEnc))
            msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", prov.ApiKeyEnc);

        using var resp = await llm.SendAsync(msg, ct);
        var bodyText = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"LLM HTTP {resp.StatusCode}: {bodyText}");

        var json = JsonDocument.Parse(bodyText);
        var answer = json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
        trace.Add(new { step = "llm_call", ms = sw.ElapsedMilliseconds, model = llmModel, chars = answer.Length });

        await SaveAnswerAsync(db, job.Id, answer, citations, trace, ct);
    }

    private static async Task SaveAnswerAsync(AltarisDbContext db, Guid jobId, string answer, IEnumerable<object> citations,
        List<object> trace, CancellationToken ct)
    {
        // ExecuteUpdate expression tree optional args / range / .ToArray() vb.
        // desteklemiyor; tüm değerleri pre-compute lokal değişkenlere çıkar.
        var citJson = JsonSerializer.Serialize(citations);
        var trJson  = JsonSerializer.Serialize(trace);
        await db.ExecutiveJobs
            .Where(j => j.Id == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Answer, answer)
                .SetProperty(j => j.Citations, citJson)
                .SetProperty(j => j.Trace, trJson), ct);
    }

    private async Task MarkCompletedAsync(AltarisDbContext db, Guid jobId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        await db.ExecutiveJobs
            .Where(j => j.Id == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Status, "completed")
                .SetProperty(j => j.CompletedAt, (DateTimeOffset?)now), ct);
        _log.LogInformation("Job {JobId} completed", jobId);
    }

    private async Task MarkFailedAsync(AltarisDbContext db, Guid jobId, string error, List<object> trace, CancellationToken ct)
    {
        try
        {
            var truncated = error.Length > 4000 ? error.Substring(0, 4000) : error;
            var trJson = JsonSerializer.Serialize(trace);
            var now = DateTimeOffset.UtcNow;
            await db.ExecutiveJobs
                .Where(j => j.Id == jobId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(j => j.Status, "failed")
                    .SetProperty(j => j.ErrorText, truncated)
                    .SetProperty(j => j.Trace, trJson)
                    .SetProperty(j => j.CompletedAt, (DateTimeOffset?)now), ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "MarkFailed itself failed for {JobId}", jobId);
        }
    }

    private async Task ReleaseStaleClaimsAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();
            var staleCutoff = DateTimeOffset.UtcNow.AddSeconds(-60);
            await db.Database.ExecuteSqlRawAsync(@"
                UPDATE executive_jobs
                SET status = 'pending', claimed_by = NULL, claimed_at = NULL, started_at = NULL
                WHERE status = 'running' AND claimed_at < {0}",
                staleCutoff);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Stale claim recovery failed");
        }
    }
}
