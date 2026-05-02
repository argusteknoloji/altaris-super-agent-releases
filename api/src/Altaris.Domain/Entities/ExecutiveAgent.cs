namespace Altaris.Domain.Entities;

/// <summary>
///   Tenant-level Executive Brain agent. Yöneticinin kendi rollerine
///   özel ajanlar tanımlanır:
///     CFO Ajanı       → finansal ajan, vault filter: muhasebe + ERP
///     Risk Analisti  → risk vault'ı + e-posta sentiment tool'u
///     Müşteri Görünümü → CRM connector + sentiment + son N gün filter
///
///   Schedule_cron NULL ise sadece manuel tetiklenir; varsa background
///   worker otomatik schedule_prompt ile job yaratır (EB-3.6).
/// </summary>
public class ExecutiveAgent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string SystemPrompt { get; set; } = default!;
    public string? Model { get; set; }
    public string? EmbeddingModel { get; set; }
    /// <summary>JSON array of vault slugs; NULL = tüm executive/tenant vault.</summary>
    public string? VaultFilter { get; set; }
    /// <summary>JSON array of allowed tool names: 'calc','code_exec','sql','chart'.</summary>
    public string Tools { get; set; } = "[]";
    public string? ScheduleCron { get; set; }
    public string? SchedulePrompt { get; set; }
    public bool Enabled { get; set; } = true;
    public Guid? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
