namespace Altaris.Domain.Entities;

/// <summary>
///   Inbound webhook — dış sistem (n8n, Zapier, custom) bizim endpoint'imize POST eder.
///   HMAC-SHA256 X-Signature header'ı ile authenticate edilir; payload'a göre bir
///   ExecutiveAgent'ı tetikler (job yarat) veya remote terminal'a komut gönderir.
/// </summary>
public class Webhook
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    /// <summary>Plain shared secret. UI bir kez gösterir; HMAC verify için saklanır.</summary>
    public string Secret { get; set; } = default!;
    /// <summary>'agent' | 'terminal'</summary>
    public string TargetKind { get; set; } = "agent";
    /// <summary>agent → ExecutiveAgent.Id, terminal → AgentSession.Id</summary>
    public Guid? TargetId { get; set; }
    public bool Enabled { get; set; } = true;
    public DateTimeOffset? LastFiredAt { get; set; }
    public int FireCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class WebhookInvocation
{
    public Guid Id { get; set; }
    public Guid WebhookId { get; set; }
    public Guid TenantId { get; set; }
    public string? Payload { get; set; }
    /// <summary>'ok' | 'invalid_signature' | 'disabled' | 'target_not_found' | 'error'</summary>
    public string Status { get; set; } = default!;
    public string? ErrorText { get; set; }
    public Guid? JobId { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
}
