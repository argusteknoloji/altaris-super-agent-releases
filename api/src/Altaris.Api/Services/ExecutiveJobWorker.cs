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
        // FromSqlRaw + UPDATE...RETURNING non-composable. EF Core'un
        // FirstOrDefaultAsync/AsNoTracking gibi LINQ operatörleri compose
        // saydığı için patlıyordu. ToListAsync terminal op olarak izinli;
        // sonra in-memory FirstOrDefault.
        var jobs = await db.ExecutiveJobs
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
            .ToListAsync(ct);
        var job = jobs.FirstOrDefault();

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
        // 1. Agent + provider çöz
        ExecutiveAgent? agent = null;
        if (job.AgentId is { } aid)
            agent = await db.ExecutiveAgents.AsNoTracking().FirstOrDefaultAsync(a => a.Id == aid, ct);

        // Provider seçimi (öncelik sırası):
        //   1) Job'a yapıştırılmış ProviderConfigId (web landing ad-hoc override)
        //   2) Agent'a yapıştırılmış ProviderConfigId (per-agent default)
        //   3) Tenant'ın IsDefault=true enabled provider'ı (eski davranış)
        Domain.Entities.ProviderConfig? prov = null;
        var pickId = job.ProviderConfigId ?? agent?.ProviderConfigId;
        if (pickId is { } pid)
        {
            prov = await db.ProviderConfigs.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == job.TenantId && p.Enabled, ct);
        }
        prov ??= await db.ProviderConfigs.AsNoTracking()
            .Where(p => p.TenantId == job.TenantId && p.Enabled)
            .OrderByDescending(p => p.IsDefault).ThenBy(p => p.Provider)
            .FirstOrDefaultAsync(ct);
        if (prov is null) throw new InvalidOperationException("no_provider_configured");

        var llmModel = agent?.Model ?? prov.DefaultModel ?? "claude-opus-4-7";
        trace.Add(new { step = "resolve_agent_provider", ms = 0, agent = agent?.Slug, model = llmModel });

        // 2. Tenant + Vault path resolve. CLI vault'a `cd` edip oradan çalışır;
        //    her vault projedir (ALTARIS.md, .altaris/agents, skills, MCP, vault dosyaları).
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var tenant = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == job.TenantId)
            .Select(t => new { t.Slug }).FirstOrDefaultAsync(ct);
        if (tenant is null) throw new InvalidOperationException("tenant_not_found");

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
                "Bu ajana erişimli vault bulunamadı. Web admin'den vault yarat veya agent'ın vault_filter'ını güncelle.",
                Array.Empty<object>(), trace, ct);
            return;
        }

        // İlk vault'u proje root olarak seç (CLI burada çalışır). Birden fazla
        // vault gerekirse CLI Read tool ile diğer path'lerden de okuyabilir.
        var vaultsRoot = Environment.GetEnvironmentVariable("ALTARIS_VAULTS_ROOT") ?? "/srv/altaris/vaults";
        var vaultPath  = Path.Combine(vaultsRoot, tenant.Slug, vaults[0].Slug);
        var altarisHome = Environment.GetEnvironmentVariable("ALTARIS_HOME") ?? "/srv/altaris/.altaris";
        trace.Add(new { step = "vault_path", path = vaultPath, home = altarisHome });

        // 3. Follow-up resume: parent job set ise CLI session uzatma kullan,
        //    aksi halde önceki turn özetini prompt'a inject et (legacy memory).
        string? resumeSessionId = null;
        if (job.ParentJobId is { } parentId)
        {
            resumeSessionId = await db.ExecutiveJobs.AsNoTracking()
                .Where(p => p.Id == parentId && p.TenantId == job.TenantId)
                .Select(p => p.CliSessionId)
                .FirstOrDefaultAsync(ct);
            trace.Add(new { step = "resume_lookup", parentJobId = parentId, hasSession = resumeSessionId is not null });
        }

        string fullPrompt;
        if (!string.IsNullOrEmpty(resumeSessionId))
        {
            // CLI'nin kendi transcript'i context'i tutar — sadece yeni turn'i gönder
            fullPrompt = job.Question;
        }
        else
        {
            var prior = await db.ExecutiveJobs.AsNoTracking()
                .Where(p => p.ThreadId == job.ThreadId && p.Id != job.Id && p.Status == "completed")
                .OrderByDescending(p => p.CreatedAt).Take(3)
                .Select(p => new { p.Question, p.Answer })
                .ToListAsync(ct);

            var systemPrompt = agent?.SystemPrompt ?? "Sen yardımcı bir ajansın. Türkçe, kısa, doğrudan cevap ver. Vault'taki belgelerden faydalan.";
            var promptParts = new List<string> { "[Sistem talimatı]\n" + systemPrompt };
            if (prior.Count > 0)
            {
                var memory = string.Join("\n", prior.AsEnumerable().Reverse().Select((p, i) =>
                    $"Tur {i + 1}: Soru → {p.Question}\nCevap → {(p.Answer ?? "").Substring(0, Math.Min((p.Answer ?? "").Length, 600))}"));
                promptParts.Add("[Önceki konuşma]\n" + memory);
            }
            promptParts.Add("[Yeni soru]\n" + job.Question);
            fullPrompt = string.Join("\n\n", promptParts);
        }

        // 4. Live PTY preview için AgentSession kaydı yarat — frontend bu ID'yle
        //    /ws/pty/watch?session=... kanalına xterm.js ile bağlanır.
        var ptyMgr = scope.ServiceProvider.GetService<Altaris.Infrastructure.Pty.PtySessionManager>();
        var sessionId = Guid.NewGuid();
        try
        {
            db.Sessions.Add(new AgentSession
            {
                Id = sessionId,
                TenantId = job.TenantId,
                UserId = job.UserId ?? Guid.Empty,
                Source = "executive-brain-job",   // CHECK constraint relaxed in startup migration
                Provider = prov.Provider,
                Model = llmModel,
                Title = $"Job {job.Id.ToString()[..8]} · {job.Question[..Math.Min(40, job.Question.Length)]}",
                Status = "active",
                StartedAt = DateTimeOffset.UtcNow,
                Metadata = "{\"jobId\":\"" + job.Id + "\"}",
            });
            // RemoteSessionId'yi job'a yaz ki frontend hemen yakalayabilsin
            await db.ExecutiveJobs.Where(j => j.Id == job.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(j => j.RemoteSessionId, sessionId), ct);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) { _log.LogWarning(ex, "Failed to create live preview session for job {JobId}", job.Id); }

        // 5. CLI subprocess (asıl iş — runner içinde PtySession aç + broadcast)
        sw.Restart();
        var run = await Altaris.Api.Services.CliJobRunner.RunAsync(
            vaultPath:     vaultPath,
            altarisHome:   altarisHome,
            prompt:        fullPrompt,
            provider:      prov,
            llmModel:      llmModel,
            timeout:       TimeSpan.FromMinutes(5),
            ct:            ct,
            ptyMgr:        ptyMgr,
            liveSessionId: sessionId,
            liveTenantId:  job.TenantId,
            liveUserId:    job.UserId ?? Guid.Empty,
            resumeSessionId: resumeSessionId);
        trace.Add(new { step = "cli_run", ms = sw.ElapsedMilliseconds, success = run.Success, durationMs = run.DurationMs });

        // Session'i completed olarak işaretle (live preview'i kapat)
        try
        {
            await db.Sessions.Where(s => s.Id == sessionId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Status, "completed")
                    .SetProperty(x => x.EndedAt, (DateTimeOffset?)DateTimeOffset.UtcNow), ct);
        }
        catch { /* cleanup failure ok */ }

        // CLI session id'yi sakla (success/fail fark etmez — follow-up için lazım)
        if (!string.IsNullOrEmpty(run.CliSessionId))
        {
            try
            {
                var sid = run.CliSessionId;
                await db.ExecutiveJobs.Where(j => j.Id == job.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.CliSessionId, sid), ct);
            }
            catch { /* best effort */ }
        }

        if (!run.Success)
        {
            throw new InvalidOperationException(run.Error ?? "cli execution failed");
        }

        await SaveAnswerAsync(db, job.Id, run.Answer, Array.Empty<object>(), trace, ct);
    }

    // ─── LEGACY: Eski inline LLM loop kaldırıldı (CliJobRunner'a devredildi).
    //     Vault embedding + cross-vault cosine search + multi-step tool loop
    //     hepsi CLI'da `altaris -p` subprocess'i içinde — MCP/plugin/skill/
    //     subagent ekosistemiyle birlikte. Eski kodu git history'den geri
    //     getirebilirsin (commit: önceki ExecutiveJobWorker.cs).

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
