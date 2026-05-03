namespace Altaris.Domain.Entities;

/// <summary>
///   Async iş kuyruğu — her yönetici sorusu bir job satırı.
///   BackgroundService worker queue'dan claim eder, embed → search → LLM
///   → answer/citations/trace yazar. UI status polling yapar.
///   Multi-turn konuşma: aynı thread_id altında ardışık job'lar.
/// </summary>
public class ExecutiveJob
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? AgentId { get; set; }
    /// <summary>
    ///   İsteğe bağlı per-job provider override. Set ise agent.ProviderConfigId
    ///   ve tenant default'ı geçer. Web landing'den ad-hoc soru için kullanılır.
    /// </summary>
    public Guid? ProviderConfigId { get; set; }
    public Guid? ThreadId { get; set; }
    public string Question { get; set; } = default!;
    /// <summary>pending | running | completed | failed | cancelled</summary>
    public string Status { get; set; } = "pending";
    public string? Answer { get; set; }
    /// <summary>JSONB array of {vault, path, chunkIndex, snippet, distance}.</summary>
    public string? Citations { get; set; }
    public string? ErrorText { get; set; }
    /// <summary>JSONB array of {step, ms, meta}; debug + transparency.</summary>
    public string? Trace { get; set; }
    public DateTimeOffset? ScheduledFor { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? ClaimedBy { get; set; }
    public DateTimeOffset? ClaimedAt { get; set; }
}
