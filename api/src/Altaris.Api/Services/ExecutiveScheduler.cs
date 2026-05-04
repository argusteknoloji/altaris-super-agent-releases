using Altaris.Domain.Entities;
using Altaris.Infrastructure.Persistence;
using Cronos;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Services;

/// <summary>
///   Cron-based scheduler — schedule_cron'lu enabled ajanlar için her dakika
///   "şimdi tetiklenmeli mi?" kontrol yapar, evet ise yeni job satırı atar
///   (worker queue'dan çekecek).
///
///   Çalışma:
///     - Her dakika tüm tenant'lardaki schedule_cron != NULL ajanları tara
///     - Cron'un son fire time'ı next minute window içine düşüyor mu? Evet
///       ise schedule_prompt ile job submit et
///     - Aynı dakika için tekrar fire engeli: o dakika içinde aynı agent'a
///       'pending' veya 'running' job varsa atla
///
///   Cronos lib 6-field standart desteği: "0 0 6 * * *" (sec min hour day mon dow)
/// </summary>
public class ExecutiveScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ExecutiveScheduler> _log;

    public ExecutiveScheduler(IServiceScopeFactory scopes, ILogger<ExecutiveScheduler> log)
    {
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("ExecutiveScheduler started");
        // İlk dakikayı bekle, sonra her tam dakikada bir tetik
        var now = DateTimeOffset.UtcNow;
        var nextMinute = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0, now.Offset).AddMinutes(1);
        await Task.Delay(nextMinute - now, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await CheckAndScheduleAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _log.LogError(ex, "Scheduler tick failed"); }

            // Sonraki dakikaya kadar bekle
            now = DateTimeOffset.UtcNow;
            nextMinute = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0, now.Offset).AddMinutes(1);
            await Task.Delay(nextMinute - now, stoppingToken);
        }
    }

    private async Task CheckAndScheduleAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AltarisDbContext>();

        // RLS bypass — scheduler tüm tenant'ları görür (worker gibi).
        // Schedule_cron NULL/empty olmayan ve enabled ajanları çek.
        var agents = await db.ExecutiveAgents.AsNoTracking()
            .Where(a => a.Enabled && a.ScheduleCron != null && a.ScheduleCron != "" && a.SchedulePrompt != null)
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        // Bu dakika içinde fire time'ı düşüyor mu (UTC bazlı)
        var minuteStart = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, now.Minute, 0, TimeSpan.Zero);
        var minuteEnd   = minuteStart.AddMinutes(1);

        foreach (var agent in agents)
        {
            if (!ShouldFire(agent.ScheduleCron!, minuteStart, minuteEnd, out var fireTime))
                continue;

            // Aynı dakikada aynı agent için zaten pending/running job var mı?
            var dup = await db.ExecutiveJobs.AnyAsync(j =>
                j.AgentId == agent.Id
                && (j.Status == "pending" || j.Status == "running")
                && j.CreatedAt >= minuteStart.AddMinutes(-2),
                ct);
            if (dup)
            {
                _log.LogDebug("Skip duplicate schedule for agent {Slug}", agent.Slug);
                continue;
            }

            // Job yarat — worker normal akışta çekecek.
            db.ExecutiveJobs.Add(new ExecutiveJob
            {
                Id = Guid.NewGuid(),
                TenantId = agent.TenantId,
                UserId = null,            // sistem tarafından scheduled
                AgentId = agent.Id,
                ThreadId = Guid.NewGuid(), // her schedule yeni thread
                Question = agent.SchedulePrompt!,
                Status = "pending",
                ScheduledFor = fireTime,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            _log.LogInformation("Scheduled job for agent {Slug} (cron {Cron})", agent.Slug, agent.ScheduleCron);
        }
        // Job schedules — kullanıcının "İşler" sayfasından oluşturduğu recurring şablonlar
        var schedules = await db.JobSchedules.AsNoTracking()
            .Where(s => s.Enabled)
            .ToListAsync(ct);
        foreach (var s in schedules)
        {
            if (!ShouldFire(s.ScheduleCron, minuteStart, minuteEnd, out var fireTime))
                continue;
            // Aynı schedule için son 2 dk pending/running iş varsa atla
            var dup = await db.ExecutiveJobs.AnyAsync(j =>
                j.ScheduleId == s.Id
                && (j.Status == "pending" || j.Status == "running")
                && j.CreatedAt >= minuteStart.AddMinutes(-2),
                ct);
            if (dup) continue;

            db.ExecutiveJobs.Add(new ExecutiveJob
            {
                Id = Guid.NewGuid(),
                TenantId = s.TenantId,
                UserId = s.CreatedBy,
                AgentId = s.AgentId,
                ProviderConfigId = s.ProviderConfigId,
                ThreadId = Guid.NewGuid(),
                Question = s.Instructions,
                VaultSlugs = s.VaultSlugs,
                ScheduleId = s.Id,
                Status = "pending",
                ScheduledFor = fireTime,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            // Touch last_fired_at — UI 'son tetiklenme' kolonunda göstersin
            await db.JobSchedules.Where(x => x.Id == s.Id)
                .ExecuteUpdateAsync(u => u.SetProperty(x => x.LastFiredAt, (DateTimeOffset?)fireTime), ct);
            _log.LogInformation("Scheduled job from JobSchedule {Name} ({Cron})", s.Name, s.ScheduleCron);
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(ct);
    }

    /// <summary>
    ///   Cronos: 6-alan (sec min hour dom mon dow) veya 5-alan
    ///   (min hour dom mon dow) destekler — auto-detect.
    /// </summary>
    private bool ShouldFire(string cron, DateTimeOffset windowStart, DateTimeOffset windowEnd, out DateTimeOffset fireTime)
    {
        fireTime = default;
        try
        {
            var fields = cron.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            var format = fields >= 6 ? CronFormat.IncludeSeconds : CronFormat.Standard;
            var expr = CronExpression.Parse(cron, format);
            var next = expr.GetNextOccurrence(windowStart.AddMilliseconds(-1).UtcDateTime, TimeZoneInfo.Utc);
            if (next is null) return false;
            if (next.Value < windowEnd.UtcDateTime)
            {
                fireTime = new DateTimeOffset(next.Value, TimeSpan.Zero);
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Invalid cron '{Cron}'", cron);
            return false;
        }
    }
}
