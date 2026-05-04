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
        // Synchronous ask (kısa sorular, instant cevap)
        app.MapPost("/api/v1/executive-brain/ask", Ask).RequireAuthorization();

        // Job queue — async pipeline (uzun sorular, agent + tool kullanımı)
        app.MapPost  ("/api/v1/executive-brain/jobs",                   SubmitJob).RequireAuthorization();
        app.MapGet   ("/api/v1/executive-brain/jobs",                   ListJobs).RequireAuthorization();
        app.MapGet   ("/api/v1/executive-brain/jobs/{id:guid}",         GetJob).RequireAuthorization();
        app.MapGet   ("/api/v1/executive-brain/jobs/{id:guid}/stream",  StreamJob).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/jobs/{id:guid}/cancel",  CancelJob).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/jobs/{id:guid}/retry",   RetryJob).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/jobs/{id:guid}/followup",FollowupJob).RequireAuthorization();

        // Job schedules — recurring iş şablonları (her gün/saat/haftaiçi)
        app.MapGet   ("/api/v1/executive-brain/job-schedules",            ListJobSchedules).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/job-schedules",            CreateJobSchedule).RequireAuthorization();
        app.MapPatch ("/api/v1/executive-brain/job-schedules/{id:guid}",  UpdateJobSchedule).RequireAuthorization();
        app.MapDelete("/api/v1/executive-brain/job-schedules/{id:guid}",  DeleteJobSchedule).RequireAuthorization();

        // Agent CRUD
        app.MapGet   ("/api/v1/executive-brain/agents",                 ListAgents).RequireAuthorization();
        app.MapGet   ("/api/v1/executive-brain/agents/{id:guid}",       GetAgent).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/agents",                 CreateAgent).RequireAuthorization();
        app.MapPatch ("/api/v1/executive-brain/agents/{id:guid}",       UpdateAgent).RequireAuthorization();
        app.MapDelete("/api/v1/executive-brain/agents/{id:guid}",       DeleteAgent).RequireAuthorization();

        // Built-in agent templates (CFO, Risk, Sales, Contract)
        app.MapGet   ("/api/v1/executive-brain/templates",                              ListTemplates).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/agents/from-template/{templateSlug}",    CreateFromTemplate).RequireAuthorization();

        // What-if simulasyonları (Sprint EB-6) — yapılandırılmış scenario → job
        app.MapGet   ("/api/v1/executive-brain/simulations/scenarios",  ListScenarios).RequireAuthorization();
        app.MapPost  ("/api/v1/executive-brain/simulations",            RunSimulation).RequireAuthorization();

        return app;
    }

    // ═════════════════════════ AGENT CRUD ═════════════════════════════

    public record AgentDto(Guid Id, string Slug, string Name, string? Description,
                          string SystemPrompt, string? Model, string? EmbeddingModel,
                          Guid? ProviderConfigId,
                          string[]? VaultFilter, string[] Tools,
                          string? ScheduleCron, string? SchedulePrompt,
                          bool Enabled, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

    private static AgentDto ToDto(Domain.Entities.ExecutiveAgent a) => new(
        a.Id, a.Slug, a.Name, a.Description, a.SystemPrompt, a.Model, a.EmbeddingModel,
        a.ProviderConfigId,
        a.VaultFilter is null ? null : System.Text.Json.JsonSerializer.Deserialize<string[]>(a.VaultFilter),
        System.Text.Json.JsonSerializer.Deserialize<string[]>(a.Tools) ?? Array.Empty<string>(),
        a.ScheduleCron, a.SchedulePrompt, a.Enabled, a.CreatedAt, a.UpdatedAt
    );

    private static async Task<IResult> ListAgents(
        AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        // Üye: sadece kendi yarattığı agent'lar; admin: hepsi.
        IQueryable<Domain.Entities.ExecutiveAgent> q = db.ExecutiveAgents.AsNoTracking()
            .Where(a => a.TenantId == tc.TenantId);
        if (!Altaris.Api.Permissions.OwnershipAuth.IsAdmin(http))
        {
            if (tc.UserId is null) return Results.Ok(Array.Empty<AgentDto>());
            q = q.Where(a => a.CreatedBy == tc.UserId);
        }
        var rows = await q.OrderBy(a => a.Name).ToListAsync();
        return Results.Ok(rows.Select(ToDto));
    }

    private static async Task<IResult> GetAgent(
        Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        var a = await db.ExecutiveAgents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (a is null) return Results.NotFound();
        if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, a.CreatedBy)) return Results.NotFound();
        return Results.Ok(ToDto(a));
    }

    public record CreateAgentRequest(string Slug, string Name, string? Description, string SystemPrompt,
                                     string? Model, string? EmbeddingModel,
                                     Guid? ProviderConfigId,
                                     string[]? VaultFilter, string[]? Tools,
                                     string? ScheduleCron, string? SchedulePrompt,
                                     bool Enabled = true);

    private static async Task<IResult> CreateAgent(
        CreateAgentRequest req, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainManageAgents);
        if (deny is not null) return deny;
        if (string.IsNullOrWhiteSpace(req.Slug) || string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.SystemPrompt))
            return Results.BadRequest(new { error = "slug+name+system_prompt required" });

        var slug = new string(req.Slug.ToLowerInvariant().Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        if (slug.Length == 0 || slug.Length > 64)
            return Results.BadRequest(new { error = "invalid_slug" });

        if (await db.ExecutiveAgents.AnyAsync(x => x.TenantId == tc.TenantId && x.Slug == slug))
            return Results.Conflict(new { error = "slug_exists" });

        var a = new Domain.Entities.ExecutiveAgent
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            Slug = slug,
            Name = req.Name.Trim(),
            Description = req.Description,
            SystemPrompt = req.SystemPrompt,
            Model = req.Model,
            EmbeddingModel = req.EmbeddingModel,
            ProviderConfigId = req.ProviderConfigId,
            VaultFilter = req.VaultFilter is null ? null : System.Text.Json.JsonSerializer.Serialize(req.VaultFilter),
            Tools = System.Text.Json.JsonSerializer.Serialize(req.Tools ?? Array.Empty<string>()),
            ScheduleCron = req.ScheduleCron,
            SchedulePrompt = req.SchedulePrompt,
            Enabled = req.Enabled,
            CreatedBy = tc.UserId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.ExecutiveAgents.Add(a);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/executive-brain/agents/{a.Id}", ToDto(a));
    }

    public record UpdateAgentRequest(string? Name, string? Description, string? SystemPrompt,
                                     string? Model, string? EmbeddingModel,
                                     Guid? ProviderConfigId, bool? ClearProvider,
                                     string[]? VaultFilter, string[]? Tools,
                                     string? ScheduleCron, string? SchedulePrompt,
                                     bool? Enabled);

    private static async Task<IResult> UpdateAgent(
        Guid id, UpdateAgentRequest req, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainManageAgents);
        if (deny is not null) return deny;

        var a = await db.ExecutiveAgents.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (a is null) return Results.NotFound();
        if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, a.CreatedBy)) return Results.Forbid();

        if (!string.IsNullOrWhiteSpace(req.Name))         a.Name = req.Name.Trim();
        if (req.Description is not null)                  a.Description = req.Description;
        if (!string.IsNullOrWhiteSpace(req.SystemPrompt)) a.SystemPrompt = req.SystemPrompt;
        if (req.Model is not null)                        a.Model = string.IsNullOrEmpty(req.Model) ? null : req.Model;
        if (req.EmbeddingModel is not null)               a.EmbeddingModel = string.IsNullOrEmpty(req.EmbeddingModel) ? null : req.EmbeddingModel;
        if (req.ClearProvider == true)                    a.ProviderConfigId = null;
        else if (req.ProviderConfigId is not null)        a.ProviderConfigId = req.ProviderConfigId;
        if (req.VaultFilter is not null)                  a.VaultFilter = req.VaultFilter.Length == 0 ? null : System.Text.Json.JsonSerializer.Serialize(req.VaultFilter);
        if (req.Tools is not null)                        a.Tools = System.Text.Json.JsonSerializer.Serialize(req.Tools);
        if (req.ScheduleCron is not null)                 a.ScheduleCron = string.IsNullOrEmpty(req.ScheduleCron) ? null : req.ScheduleCron;
        if (req.SchedulePrompt is not null)               a.SchedulePrompt = string.IsNullOrEmpty(req.SchedulePrompt) ? null : req.SchedulePrompt;
        if (req.Enabled is not null)                      a.Enabled = req.Enabled.Value;
        a.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync();
        return Results.Ok(ToDto(a));
    }

    private static async Task<IResult> DeleteAgent(
        Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainManageAgents);
        if (deny is not null) return deny;

        var a = await db.ExecutiveAgents.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (a is null) return Results.NotFound();
        if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, a.CreatedBy)) return Results.Forbid();
        db.ExecutiveAgents.Remove(a);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // ═════════════════════════ TEMPLATES ════════════════════════════════

    private record AgentTemplate(string Slug, string Name, string Description, string SystemPrompt, string[] Tools, string? Cron, string? CronPrompt);

    private static readonly AgentTemplate[] Templates =
    {
        new("cfo", "CFO Asistanı",
            "Finansal sorulara cevap verir; nakit akışı, alacaklar, marjlar.",
            """
            Sen bir CFO Asistanı'sın. Şirket finansal verilerinden (vault'taki muhasebe + ERP belgeleri)
            cevap üretirsin. Kurallar:
            - Sayısal değerleri kaynaktan birebir alıntıla. Hesaplama gerekiyorsa adım adım göster.
            - Para birimi ve dönem (ay/çeyrek) her zaman belirt.
            - Eğer veri yoksa "Bu soruya cevap verecek finansal belge bulamadım" de.
            - Türkçe, kısa, doğrudan cevap ver — yönetici zamanı kıymetli.
            """,
            new[] { "calc" }, "0 0 6 * * *", "Bugün için kritik finansal alarmları özetle"),

        new("risk", "Risk Analisti",
            "Müşteri risk sinyallerini izler — ödeme gecikmesi, sentiment, iletişim sıklığı.",
            """
            Sen bir Risk Analisti'sin. CRM görüşme notları + e-posta + ödeme verileri kullanarak
            risk sinyallerini tespit edersin. Kurallar:
            - Her risk için: müşteri adı + sinyal türü + son 30 gün eylem + öneri.
            - Üç sinyal kombinasyonu = yüksek risk.
            - Mutlaka kaynaklı yaz.
            """,
            Array.Empty<string>(), "0 0 8 * * MON", "Geçen hafta risk profili değişen müşterileri listele"),

        new("sales", "Satış Görünümü",
            "Satış pipeline, müşteri durumları, fırsatları takip eder.",
            """
            Sen bir Satış Görünümü ajanısın. CRM + e-posta verisinden satış sürecini özetlersin.
            Pipeline, kapanan/kapanmayan deal'ler, ekibin takıldığı yerler. Hedef vs. gerçekleşen.
            """,
            new[] { "calc", "chart" }, null, null),

        new("contract", "Sözleşme Analisti",
            "Sözleşme PDF'lerinden risk + yenileme + önemli madde çıkarır.",
            """
            Sen bir Sözleşme Analisti'sin. Vault'taki PDF/Word sözleşmelerden:
            - Yenileme tarihleri (90 gün içinde dolanlar uyarı)
            - Olağandışı şartlar (ceza, exclusivity, IP devri)
            - Karşı taraf yükümlülükleri
            çıkarır, listelersin.
            """,
            Array.Empty<string>(), "0 0 9 * * *", "Sözleşmelerimde 90 gün içinde yenilenecek olanları listele"),
    };

    private static IResult ListTemplates() => Results.Ok(Templates.Select(t =>
        new { t.Slug, t.Name, t.Description, tools = t.Tools, cron = t.Cron, cronPrompt = t.CronPrompt }));

    private static async Task<IResult> CreateFromTemplate(
        string templateSlug, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainManageAgents);
        if (deny is not null) return deny;
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var t = Templates.FirstOrDefault(x => x.Slug == templateSlug);
        if (t is null) return Results.NotFound(new { error = "template_not_found" });

        var slug = t.Slug;
        int n = 1;
        while (await db.ExecutiveAgents.AnyAsync(x => x.TenantId == tc.TenantId && x.Slug == slug))
            slug = $"{t.Slug}-{++n}";

        var a = new Domain.Entities.ExecutiveAgent
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            Slug = slug,
            Name = t.Name,
            Description = t.Description,
            SystemPrompt = t.SystemPrompt,
            Tools = System.Text.Json.JsonSerializer.Serialize(t.Tools),
            ScheduleCron = t.Cron,
            SchedulePrompt = t.CronPrompt,
            Enabled = true,
            CreatedBy = tc.UserId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.ExecutiveAgents.Add(a);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/executive-brain/agents/{a.Id}", ToDto(a));
    }

    // ═════════════════════════ JOBS ═════════════════════════════════════

    public record SubmitJobRequest(string Question, Guid? AgentId, Guid? ProviderConfigId, Guid? ThreadId,
                                   DateTimeOffset? ScheduledFor, string[]? VaultSlugs);

    private static async Task<IResult> SubmitJob(
        SubmitJobRequest req, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        if (string.IsNullOrWhiteSpace(req.Question))
            return Results.BadRequest(new { error = "question_required" });

        // Agent verildiyse: kullanıcının ona erişimi var mı? (kendisi yarattıysa veya admin ise)
        if (req.AgentId is { } aid)
        {
            var agentOwner = await db.ExecutiveAgents.AsNoTracking()
                .Where(a => a.Id == aid && a.TenantId == tc.TenantId)
                .Select(a => (Guid?)a.CreatedBy)
                .FirstOrDefaultAsync();
            if (agentOwner is null && !await db.ExecutiveAgents.AnyAsync(a => a.Id == aid && a.TenantId == tc.TenantId))
                return Results.NotFound(new { error = "agent_not_found" });
            if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, agentOwner))
                return Results.Forbid();
        }

        var job = new Domain.Entities.ExecutiveJob
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId,
            AgentId = req.AgentId,
            ProviderConfigId = req.ProviderConfigId,
            ThreadId = req.ThreadId ?? Guid.NewGuid(),
            Question = req.Question,
            VaultSlugs = (req.VaultSlugs is { Length: > 0 })
                ? System.Text.Json.JsonSerializer.Serialize(req.VaultSlugs)
                : null,
            Status = "pending",
            ScheduledFor = req.ScheduledFor,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ExecutiveJobs.Add(job);
        await db.SaveChangesAsync();

        return Results.Accepted($"/api/v1/executive-brain/jobs/{job.Id}",
            new { id = job.Id, status = job.Status, threadId = job.ThreadId });
    }

    // ═════════════════════════ JOB SCHEDULES ════════════════════════════════

    public record JobScheduleDto(
        Guid Id, string Name, string? Description, string Instructions,
        Guid? AgentId, Guid? ProviderConfigId, string[]? VaultSlugs,
        string ScheduleCron, string ScheduleKind, bool Enabled,
        DateTimeOffset? LastFiredAt, DateTimeOffset CreatedAt);

    private static JobScheduleDto ToScheduleDto(Domain.Entities.JobSchedule s) => new(
        s.Id, s.Name, s.Description, s.Instructions, s.AgentId, s.ProviderConfigId,
        s.VaultSlugs is null ? null : System.Text.Json.JsonSerializer.Deserialize<string[]>(s.VaultSlugs),
        s.ScheduleCron, s.ScheduleKind, s.Enabled, s.LastFiredAt, s.CreatedAt);

    public record CreateJobScheduleRequest(
        string Name, string? Description, string Instructions,
        Guid? AgentId, Guid? ProviderConfigId, string[]? VaultSlugs,
        string ScheduleKind, string? AtTime);

    /// <summary>
    ///   ScheduleKind ("hourly"|"daily"|"weekdays"|"weekly") + opsiyonel HH:mm
    ///   → 5-field cron expression. UTC bazlı; client istemce TZ shift'i için
    ///   AtTime'i kendi TZ'sinden UTC'ye çevirip yollar.
    /// </summary>
    private static string KindToCron(string kind, string? atTime)
    {
        var (hh, mm) = ParseHHmm(atTime ?? "09:00");
        return kind.ToLowerInvariant() switch
        {
            "hourly"   => "0 * * * *",                  // her saat başı
            "weekdays" => $"{mm} {hh} * * 1-5",         // pazartesi-cuma
            "weekly"   => $"{mm} {hh} * * 1",           // pazartesi
            _          => $"{mm} {hh} * * *",           // daily — default
        };
    }
    private static (int hh, int mm) ParseHHmm(string s)
    {
        var parts = s.Split(':');
        int.TryParse(parts.ElementAtOrDefault(0), out var h);
        int.TryParse(parts.ElementAtOrDefault(1), out var m);
        return (Math.Clamp(h, 0, 23), Math.Clamp(m, 0, 59));
    }

    private static async Task<IResult> ListJobSchedules(
        AltarisDbContext db, ITenantContext tc, HttpContext http,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        IQueryable<Domain.Entities.JobSchedule> q = db.JobSchedules.AsNoTracking()
            .Where(s => s.TenantId == tc.TenantId);
        if (!Altaris.Api.Permissions.OwnershipAuth.IsAdmin(http))
        {
            if (tc.UserId is null) return Results.Ok(Array.Empty<JobScheduleDto>());
            q = q.Where(s => s.CreatedBy == tc.UserId);
        }
        var rows = await q.OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Results.Ok(rows.Select(ToScheduleDto));
    }

    private static async Task<IResult> CreateJobSchedule(
        CreateJobScheduleRequest req, AltarisDbContext db, ITenantContext tc, HttpContext http,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps)
    {
        if (tc.TenantId is null || tc.UserId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Instructions))
            return Results.BadRequest(new { error = "name + instructions required" });

        var s = new Domain.Entities.JobSchedule
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            CreatedBy = tc.UserId.Value,
            Name = req.Name.Trim(),
            Description = req.Description,
            Instructions = req.Instructions,
            AgentId = req.AgentId,
            ProviderConfigId = req.ProviderConfigId,
            VaultSlugs = (req.VaultSlugs is { Length: > 0 })
                ? System.Text.Json.JsonSerializer.Serialize(req.VaultSlugs) : null,
            ScheduleCron = KindToCron(req.ScheduleKind, req.AtTime),
            ScheduleKind = req.ScheduleKind,
            Enabled = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.JobSchedules.Add(s);
        await db.SaveChangesAsync();
        return Results.Created($"/api/v1/executive-brain/job-schedules/{s.Id}", ToScheduleDto(s));
    }

    public record UpdateJobScheduleRequest(string? Name, string? Description, string? Instructions,
                                           Guid? AgentId, Guid? ProviderConfigId, string[]? VaultSlugs,
                                           string? ScheduleKind, string? AtTime, bool? Enabled);

    private static async Task<IResult> UpdateJobSchedule(
        Guid id, UpdateJobScheduleRequest req, AltarisDbContext db, ITenantContext tc, HttpContext http,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var s = await db.JobSchedules.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (s is null) return Results.NotFound();
        if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, s.CreatedBy)) return Results.Forbid();

        if (!string.IsNullOrWhiteSpace(req.Name)) s.Name = req.Name.Trim();
        if (req.Description is not null) s.Description = req.Description;
        if (!string.IsNullOrWhiteSpace(req.Instructions)) s.Instructions = req.Instructions;
        if (req.AgentId is not null) s.AgentId = req.AgentId;
        if (req.ProviderConfigId is not null) s.ProviderConfigId = req.ProviderConfigId;
        if (req.VaultSlugs is not null)
            s.VaultSlugs = req.VaultSlugs.Length == 0 ? null : System.Text.Json.JsonSerializer.Serialize(req.VaultSlugs);
        if (!string.IsNullOrWhiteSpace(req.ScheduleKind))
        {
            s.ScheduleKind = req.ScheduleKind;
            s.ScheduleCron = KindToCron(req.ScheduleKind, req.AtTime);
        }
        if (req.Enabled is not null) s.Enabled = req.Enabled.Value;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(ToScheduleDto(s));
    }

    private static async Task<IResult> DeleteJobSchedule(
        Guid id, AltarisDbContext db, ITenantContext tc, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var s = await db.JobSchedules.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (s is null) return Results.NotFound();
        if (!Altaris.Api.Permissions.OwnershipAuth.OwnsOrAdmin(http, tc, s.CreatedBy)) return Results.Forbid();
        db.JobSchedules.Remove(s);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    // ═════════════════════════ WHAT-IF SIMULATIONS ══════════════════════════
    // Stratejik soruları (cash-flow, sözleşme yenileme, müşteri kaybı) yapılandırılmış
    // formdan alıp standart job pipeline'ına yönlendiriyoruz — LLM + calc tool +
    // RAG kaynaklarıyla senaryoyu projekte ediyor.

    public record ScenarioParam(string Key, string Label, string Type, string? Placeholder, string? Default);
    public record Scenario(string Slug, string Name, string Description, string Icon, ScenarioParam[] Params, string PromptTemplate);

    private static readonly Scenario[] Scenarios =
    {
        new("cash_flow_delay", "Geç ödeme etkisi", "Belirli müşteri/ler 30+ gün geç öderse nakit akışına etkisi.", "💸",
            new[] {
                new ScenarioParam("customer", "Müşteri (boş = tümü)", "text", "ACME Ltd", null),
                new ScenarioParam("delay_days", "Gecikme (gün)", "number", "30", "30"),
                new ScenarioParam("amount", "Etkilenen tutar (TL, opsiyonel)", "number", "0", null),
            },
            """
            What-if senaryosu — geç ödeme:
            Müşteri: {customer}
            Gecikme: {delay_days} gün
            Etkilenen tutar (varsa): {amount} TL

            Vault'taki finansal verilerden + alacak yaşlandırma raporlarından bu senaryonun
            etkisini hesapla:
            - Etkilenen alacakların toplamı
            - Bu gecikmenin önümüzdeki 60/90 günlük nakit akışına etkisi
            - Hangi gider kalemleri risk altına girer (maaş/kira/vergi)
            - Önerilen aksiyonlar (tahsilat, kredi limiti, faktoring)

            Sayısal değerler için calc aracını kullan. Kaynaklı yaz.
            """),

        new("contract_renewal", "Sözleşme yenilenmezse", "Bir sözleşmenin yenilenmemesi gelir/maliyet açısından nasıl etkiler.", "📄",
            new[] {
                new ScenarioParam("counterparty", "Karşı taraf", "text", "Müşteri / tedarikçi adı", null),
                new ScenarioParam("annual_value", "Yıllık değer (TL)", "number", "100000", null),
                new ScenarioParam("end_date", "Sözleşme bitiş tarihi", "date", "", null),
            },
            """
            What-if senaryosu — sözleşme yenilenmezse:
            Karşı taraf: {counterparty}
            Yıllık değer: {annual_value} TL
            Bitiş tarihi: {end_date}

            Vault'taki sözleşme dosyalarından + müşteri etkileşim notlarından:
            - Bu sözleşmenin yenilenmemesi durumunda yıllık gelir/maliyet etkisi
            - Bağımlı diğer sözleşmeler veya operasyonel zincirler
            - Yenileme olasılığı için sinyal güçleri (etkileşim, ödeme, NPS)
            - Yenilemek için 30/60/90 gün önce yapılması gereken aksiyonlar

            Kaynaklı, sayısal cevap ver.
            """),

        new("customer_churn", "Müşteri kaybı etkisi", "Belirli bir müşteri segmentinin %X kaybı toplam tabloya nasıl yansır.", "📉",
            new[] {
                new ScenarioParam("segment", "Segment (boş = tümü)", "text", "SaaS / KOBİ / Kurumsal", null),
                new ScenarioParam("churn_pct", "Churn oranı (%)", "number", "10", "10"),
                new ScenarioParam("horizon_months", "Zaman ufku (ay)", "number", "6", "6"),
            },
            """
            What-if senaryosu — müşteri churn'u:
            Segment: {segment}
            Churn oranı: %{churn_pct}
            Ufuk: {horizon_months} ay

            Vault'taki CRM + faturalama + iletişim verilerinden:
            - Bu segmentin toplam ciroya katkısı (mevcut)
            - %{churn_pct} kayıpta önümüzdeki {horizon_months} ay için cari ciro etkisi
            - Hangi müşteriler en yüksek churn riskinde (veriden çıkar)
            - Retention için öncelikli aksiyonlar (kişi/segment bazlı)

            calc aracını kullan, kaynak göster.
            """),
    };

    private static IResult ListScenarios() => Results.Ok(Scenarios.Select(s =>
        new { s.Slug, s.Name, s.Description, s.Icon, s.Params }));

    public record RunSimulationRequest(string ScenarioSlug, Dictionary<string, string> Params);

    private static async Task<IResult> RunSimulation(
        RunSimulationRequest req, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;

        var sc = Scenarios.FirstOrDefault(x => x.Slug == req.ScenarioSlug);
        if (sc is null) return Results.NotFound(new { error = "scenario_not_found" });

        // Template placeholder'larını user param'larıyla değiştir; eksik anahtarlar boş.
        var question = sc.PromptTemplate;
        foreach (var p in sc.Params)
        {
            var v = req.Params != null && req.Params.TryGetValue(p.Key, out var vv) ? vv : (p.Default ?? "—");
            if (string.IsNullOrWhiteSpace(v)) v = "—";
            question = question.Replace("{" + p.Key + "}", v);
        }

        // CFO veya Risk gibi calc-yetenekli built-in agent varsa onu seç (opsiyonel
        // — yoksa default agent ile çalışır, system prompt template içinden geliyor).
        var agentId = await db.ExecutiveAgents.AsNoTracking()
            .Where(a => a.TenantId == tc.TenantId && a.Enabled
                     && (a.Slug.StartsWith("cfo") || a.Slug.StartsWith("risk")))
            .OrderBy(a => a.Slug)
            .Select(a => (Guid?)a.Id)
            .FirstOrDefaultAsync();

        var job = new Domain.Entities.ExecutiveJob
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId,
            AgentId = agentId,
            ThreadId = Guid.NewGuid(),
            Question = question,
            Status = "pending",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ExecutiveJobs.Add(job);
        await db.SaveChangesAsync();

        return Results.Accepted($"/api/v1/executive-brain/jobs/{job.Id}",
            new { id = job.Id, status = job.Status, threadId = job.ThreadId, scenario = sc.Slug });
    }

    private static async Task<IResult> ListJobs(
        AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http,
        Guid? threadId, Guid? agentId, string? status, int take = 50, int skip = 0)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        var canViewAll = await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainViewAllJobs);
        var q = db.ExecutiveJobs.AsNoTracking().Where(j => j.TenantId == tc.TenantId);
        if (!canViewAll) q = q.Where(j => j.UserId == tc.UserId);
        if (threadId is not null) q = q.Where(j => j.ThreadId == threadId);
        if (agentId  is not null) q = q.Where(j => j.AgentId  == agentId);
        if (!string.IsNullOrEmpty(status)) q = q.Where(j => j.Status == status);

        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(j => j.CreatedAt)
            .Skip(Math.Max(skip, 0))
            .Take(Math.Clamp(take, 1, 200))
            .Select(j => new {
                j.Id, j.UserId, j.AgentId, j.ThreadId, j.ParentJobId, j.Question, j.Status,
                j.ScheduledFor, j.StartedAt, j.CompletedAt, j.CreatedAt,
                hasError = j.ErrorText != null
            })
            .ToListAsync();
        return Results.Ok(new { items = rows, total });
    }

    private static async Task<IResult> GetJob(
        Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        var j = await db.ExecutiveJobs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (j is null) return Results.NotFound();
        // ViewAllJobs yoksa sadece kendi job'ını görebilir
        if (j.UserId != tc.UserId &&
            !await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainViewAllJobs))
            return Results.Forbid();
        return Results.Ok(j);
    }

    /// <summary>
    ///   SSE stream — UI bir job'u WebSocket-light şekilde takip eder.
    ///   Her 1 saniyede bir DB poll: status / answer (artımlı) / error / trace.
    ///   completed/failed/cancelled olduğunda 'done' event yollar ve bağlantıyı kapatır.
    ///
    ///   Worker LLM-streaming değil (full response geliyor) ama answer kolonu
    ///   chunk-chunk yazılırsa (EB-3.5 tool framework'te plan), UI typewriter
    ///   etkisi görür. MVP polling-based; ileride NOTIFY/LISTEN ile push.
    /// </summary>
    private static async Task StreamJob(
        HttpContext ctx, Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, CancellationToken ct)
    {
        if (!await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse, ct))
        {
            ctx.Response.StatusCode = 403; return;
        }
        ctx.Response.Headers["Content-Type"] = "text/event-stream";
        ctx.Response.Headers["Cache-Control"] = "no-cache, no-transform";
        ctx.Response.Headers["X-Accel-Buffering"] = "no";   // nginx/Caddy buffer kapat
        ctx.Response.StatusCode = 200;

        async Task Send(string evt, object payload)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(payload);
            await ctx.Response.WriteAsync($"event: {evt}\ndata: {json}\n\n", ct);
            await ctx.Response.Body.FlushAsync(ct);
        }

        string? lastStatus = null;
        int lastAnswerLen = 0;
        var deadline = DateTime.UtcNow.AddMinutes(5);   // safety: 5 dk üst sınır

        while (!ct.IsCancellationRequested && DateTime.UtcNow < deadline)
        {
            var j = await db.ExecutiveJobs.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId, ct);
            if (j is null)
            {
                await Send("error", new { message = "job_not_found" });
                return;
            }

            if (j.Status != lastStatus)
            {
                await Send("status", new { status = j.Status });
                lastStatus = j.Status;
            }

            // Answer artımı — yeni karakterleri delta olarak yolla
            var ans = j.Answer ?? "";
            if (ans.Length > lastAnswerLen)
            {
                var delta = ans.Substring(lastAnswerLen);
                await Send("delta", new { text = delta });
                lastAnswerLen = ans.Length;
            }

            if (j.Status is "completed" or "failed" or "cancelled")
            {
                var citations = j.Citations is null ? null
                    : System.Text.Json.JsonSerializer.Deserialize<object>(j.Citations);
                await Send("done", new
                {
                    status = j.Status,
                    answer = j.Answer,
                    citations,
                    error = j.ErrorText,
                });
                return;
            }

            await Task.Delay(800, ct);
        }
    }

    private static async Task<IResult> CancelJob(
        Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        var j = await db.ExecutiveJobs.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (j is null) return Results.NotFound();
        // Başkasının job'ını cancel etmek için ViewAllJobs gerek
        if (j.UserId != tc.UserId &&
            !await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainViewAllJobs))
            return Results.Forbid();
        if (j.Status is not ("pending" or "running")) return Results.BadRequest(new { error = "cannot_cancel" });
        j.Status = "cancelled";
        j.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> RetryJob(
        Guid id, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        var j = await db.ExecutiveJobs.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (j is null) return Results.NotFound();
        if (j.UserId != tc.UserId &&
            !await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainViewAllJobs))
            return Results.Forbid();
        if (j.Status != "failed") return Results.BadRequest(new { error = "only_failed_jobs_can_retry" });
        j.Status = "pending";
        j.ErrorText = null;
        j.ClaimedAt = null;
        j.ClaimedBy = null;
        j.StartedAt = null;
        j.CompletedAt = null;
        await db.SaveChangesAsync();
        return Results.Ok(new { id = j.Id, status = j.Status });
    }

    public record FollowupRequest(string Question);

    /// <summary>
    ///   Tamamlanmış bir job'a follow-up soru ekler. Yeni job aynı thread_id altında,
    ///   parent_job_id = orijinal job; worker `--resume &lt;cli_session_id&gt;` ile
    ///   CLI konuşma context'ini uzatır. Provider/agent/vault kararları parent'tan miras.
    /// </summary>
    private static async Task<IResult> FollowupJob(
        Guid id, FollowupRequest req, AltarisDbContext db, ITenantContext tc,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse);
        if (deny is not null) return deny;
        if (string.IsNullOrWhiteSpace(req.Question))
            return Results.BadRequest(new { error = "question_required" });

        var parent = await db.ExecutiveJobs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tc.TenantId);
        if (parent is null) return Results.NotFound();
        if (parent.UserId != tc.UserId &&
            !await caps.HasAsync(Altaris.Domain.Permissions.Capabilities.ExecutiveBrainViewAllJobs))
            return Results.Forbid();
        // Sadece tamamlanmış job'a follow-up — running iken yeni turn ekleyemeyiz
        if (parent.Status is not ("completed" or "failed"))
            return Results.BadRequest(new { error = "parent_not_finished" });

        var job = new Domain.Entities.ExecutiveJob
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            UserId = tc.UserId,
            AgentId = parent.AgentId,
            ProviderConfigId = parent.ProviderConfigId,
            ThreadId = parent.ThreadId ?? parent.Id,
            ParentJobId = parent.Id,
            Question = req.Question,
            Status = "pending",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.ExecutiveJobs.Add(job);
        await db.SaveChangesAsync();

        return Results.Accepted($"/api/v1/executive-brain/jobs/{job.Id}",
            new { id = job.Id, status = job.Status, threadId = job.ThreadId, parentJobId = job.ParentJobId });
    }

    public record AskRequest(string Question, int? TopK, bool? IncludeAllVaults);
    public record Citation(string Vault, string Path, int ChunkIndex, string Snippet, float Distance);
    public record AskResponse(string Question, string Answer, IReadOnlyList<Citation> Sources, string Model, int VaultCount);

    private static async Task<IResult> Ask(
        AskRequest req,
        AltarisDbContext db, ITenantContext tc,
        EmbeddingClient embed, EmbeddingIndexer indexer,
        IHttpClientFactory httpFactory,
        Altaris.Infrastructure.Permissions.CapabilityResolver caps, HttpContext http,
        CancellationToken ct)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var deny = await Altaris.Api.Permissions.CapabilityHttpExtensions.RequireCapabilityAsync(
            http, caps, Altaris.Domain.Permissions.Capabilities.ExecutiveBrainUse, ct);
        if (deny is not null) return deny;
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
