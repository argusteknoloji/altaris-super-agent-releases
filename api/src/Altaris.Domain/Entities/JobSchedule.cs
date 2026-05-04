namespace Altaris.Domain.Entities;

/// <summary>
///   Tekrarlayan iş şablonu — kullanıcının "/işler" ekranından oluşturduğu
///   "her gün 09:00", "haftaiçi", "saatte bir" gibi cron-bazlı job tanımı.
///   ExecutiveScheduler her dakika bu tabloyu da iterate eder ve fire time
///   gelmiş enabled satırlardan ExecutiveJob satırı yaratır.
///
///   Manual schedule_kind = "manual" ise hiç burada saklanmaz; doğrudan
///   tek-seferlik ExecutiveJob olarak submit edilir.
/// </summary>
public class JobSchedule
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    /// <summary>CLI'ya gönderilecek prompt (form'daki Instructions alanı).</summary>
    public string Instructions { get; set; } = default!;
    public Guid? AgentId { get; set; }
    public Guid? ProviderConfigId { get; set; }
    /// <summary>JSON array of vault slugs — kullanıcının form'da seçtiği vault'lar.</summary>
    public string? VaultSlugs { get; set; }
    /// <summary>6-alan (sec min hour dom mon dow) veya 5-alan standart cron.</summary>
    public string ScheduleCron { get; set; } = default!;
    /// <summary>"hourly" | "daily" | "weekdays" | "weekly" — UI'da insanca göstermek için.</summary>
    public string ScheduleKind { get; set; } = "daily";
    public bool Enabled { get; set; } = true;
    public DateTimeOffset? LastFiredAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
