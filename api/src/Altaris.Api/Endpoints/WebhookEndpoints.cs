using System.Security.Cryptography;
using System.Text;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   Webhook altyapısı: dış sistemler bizim public endpoint'imize POST eder,
///   HMAC-SHA256 ile doğrulanır, agent job tetiklenir veya terminal'a komut gider.
///
///   Public URL formatı: POST /api/v1/hooks/{tenantSlug}/{webhookSlug}
///   Auth header: X-Altaris-Signature: hex(hmac_sha256(secret, body))
/// </summary>
public static class WebhookEndpoints
{
    public static IEndpointRouteBuilder MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        // Admin CRUD — tenant-scoped, RequireAuthorization
        app.MapGet   ("/api/v1/webhooks",                ListWebhooks).RequireAuthorization();
        app.MapPost  ("/api/v1/webhooks",                CreateWebhook).RequireAuthorization();
        app.MapPatch ("/api/v1/webhooks/{id:guid}",      UpdateWebhook).RequireAuthorization();
        app.MapDelete("/api/v1/webhooks/{id:guid}",      DeleteWebhook).RequireAuthorization();
        app.MapGet   ("/api/v1/webhooks/{id:guid}/invocations", ListInvocations).RequireAuthorization();

        // PUBLIC receiver — NO auth (HMAC verify ediyor)
        app.MapPost("/api/v1/hooks/{tenantSlug}/{webhookSlug}", Receive).AllowAnonymous();

        return app;
    }

    // ═══════════════════════ ADMIN CRUD ═══════════════════════════════

    private record CreateWebhookRequest(string Slug, string Name, string TargetKind, Guid? TargetId);

    private static async Task<IResult> ListWebhooks(AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var rows = await db.Webhooks
            .Where(w => w.TenantId == tc.TenantId)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new
            {
                w.Id, w.Slug, w.Name, w.TargetKind, w.TargetId, w.Enabled,
                w.LastFiredAt, w.FireCount, w.CreatedAt
                // NOTE: secret kasten dönmüyor — sadece create response'unda bir kez gösterilir
            })
            .ToListAsync();
        return Results.Ok(rows);
    }

    private static async Task<IResult> CreateWebhook(
        CreateWebhookRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(req.Slug) || string.IsNullOrWhiteSpace(req.Name))
            return Results.BadRequest(new { error = "slug + name required" });
        if (req.TargetKind is not ("agent" or "terminal"))
            return Results.BadRequest(new { error = "target_kind must be 'agent' or 'terminal'" });

        var slug = req.Slug.Trim().ToLowerInvariant();
        if (await db.Webhooks.AnyAsync(w => w.TenantId == tc.TenantId && w.Slug == slug))
            return Results.Conflict(new { error = "slug already exists" });

        // 32 byte random secret, base64url encoded
        var bytes = RandomNumberGenerator.GetBytes(32);
        var secret = Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');

        var hook = new Webhook
        {
            Id = Guid.NewGuid(),
            TenantId = tc.TenantId.Value,
            Slug = slug,
            Name = req.Name.Trim(),
            Secret = secret,
            TargetKind = req.TargetKind,
            TargetId = req.TargetId,
            Enabled = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Webhooks.Add(hook);
        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            hook.Id, hook.Slug, hook.Name, hook.TargetKind, hook.TargetId, hook.Enabled,
            secret = hook.Secret,  // sadece create'te dönüyor
            hint = "Save the secret now — it's only shown once. Sign requests with X-Altaris-Signature: hex(hmac_sha256(secret, body))."
        });
    }

    private record UpdateWebhookRequest(string? Name, bool? Enabled, Guid? TargetId);

    private static async Task<IResult> UpdateWebhook(
        Guid id, UpdateWebhookRequest req, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var hook = await db.Webhooks.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tc.TenantId);
        if (hook is null) return Results.NotFound();
        if (req.Name is not null) hook.Name = req.Name.Trim();
        if (req.Enabled is not null) hook.Enabled = req.Enabled.Value;
        if (req.TargetId is not null) hook.TargetId = req.TargetId.Value;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteWebhook(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        var hook = await db.Webhooks.FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tc.TenantId);
        if (hook is null) return Results.NotFound();
        db.Webhooks.Remove(hook);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> ListInvocations(Guid id, AltarisDbContext db, ITenantContext tc)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (!await db.Webhooks.AnyAsync(w => w.Id == id && w.TenantId == tc.TenantId))
            return Results.NotFound();
        var rows = await db.WebhookInvocations
            .Where(i => i.WebhookId == id)
            .OrderByDescending(i => i.ReceivedAt)
            .Take(50)
            .Select(i => new { i.Id, i.Status, i.ErrorText, i.JobId, i.ReceivedAt, payload_preview = i.Payload!.Length > 200 ? i.Payload.Substring(0, 200) + "…" : i.Payload })
            .ToListAsync();
        return Results.Ok(rows);
    }

    // ═══════════════════════ PUBLIC RECEIVER ═══════════════════════════

    private static async Task<IResult> Receive(
        string tenantSlug, string webhookSlug,
        HttpRequest http, AltarisDbContext db)
    {
        // Body'yi ham olarak oku — HMAC verify için gerekli
        http.EnableBuffering();
        using var reader = new StreamReader(http.Body, leaveOpen: true);
        var bodyText = await reader.ReadToEndAsync();
        http.Body.Position = 0;

        // Tenant + webhook resolve (RLS bypass: ignore for public lookup)
        var tenant = await db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Slug == tenantSlug.ToLowerInvariant());
        if (tenant is null) return Results.NotFound(new { error = "tenant not found" });

        var hook = await db.Webhooks.IgnoreQueryFilters()
            .FirstOrDefaultAsync(w => w.TenantId == tenant.Id && w.Slug == webhookSlug.ToLowerInvariant());
        if (hook is null) return Results.NotFound(new { error = "webhook not found" });

        var inv = new WebhookInvocation
        {
            Id = Guid.NewGuid(),
            WebhookId = hook.Id,
            TenantId = hook.TenantId,
            Payload = bodyText.Length > 50_000 ? bodyText.Substring(0, 50_000) : bodyText,
            ReceivedAt = DateTimeOffset.UtcNow,
            Status = "ok"
        };

        if (!hook.Enabled)
        {
            inv.Status = "disabled";
            db.WebhookInvocations.Add(inv);
            await db.SaveChangesAsync();
            return Results.StatusCode(503);
        }

        // HMAC verify
        var signature = http.Headers["X-Altaris-Signature"].FirstOrDefault();
        if (string.IsNullOrEmpty(signature) || !VerifyHmac(hook.Secret, bodyText, signature))
        {
            inv.Status = "invalid_signature";
            inv.ErrorText = "X-Altaris-Signature header missing or mismatch";
            db.WebhookInvocations.Add(inv);
            await db.SaveChangesAsync();
            return Results.Unauthorized();
        }

        try
        {
            if (hook.TargetKind == "agent")
            {
                if (hook.TargetId is null) throw new InvalidOperationException("agent target_id not set");
                var agent = await db.ExecutiveAgents.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(a => a.Id == hook.TargetId.Value && a.TenantId == hook.TenantId);
                if (agent is null) throw new InvalidOperationException("target agent not found");

                // Webhook payload'ını agent prompt'una map et — body'i olduğu gibi soru olarak ver
                var question = string.IsNullOrWhiteSpace(bodyText)
                    ? $"Webhook '{hook.Name}' tetiklendi (boş payload)."
                    : $"Webhook '{hook.Name}' tetiklendi. Payload:\n\n{bodyText}";

                var job = new ExecutiveJob
                {
                    Id = Guid.NewGuid(),
                    TenantId = hook.TenantId,
                    AgentId = agent.Id,
                    Question = question.Length > 8000 ? question[..8000] : question,
                    Status = "pending",
                    CreatedAt = DateTimeOffset.UtcNow
                };
                db.ExecutiveJobs.Add(job);
                inv.JobId = job.Id;
            }
            else if (hook.TargetKind == "terminal")
            {
                // Terminal target için MVP: invocation'ı kaydet, asıl terminal injection
                // Sprint #82'de eklenecek (PtyEndpoints'e command queue lazım).
                inv.Status = "queued_terminal";
                inv.ErrorText = "terminal injection not yet implemented (queued)";
            }

            hook.LastFiredAt = DateTimeOffset.UtcNow;
            hook.FireCount += 1;
            db.WebhookInvocations.Add(inv);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true, jobId = inv.JobId });
        }
        catch (Exception ex)
        {
            inv.Status = "error";
            inv.ErrorText = ex.Message;
            db.WebhookInvocations.Add(inv);
            await db.SaveChangesAsync();
            return Results.Problem(detail: ex.Message);
        }
    }

    private static bool VerifyHmac(string secret, string body, string signatureHex)
    {
        var key = Encoding.UTF8.GetBytes(secret);
        using var hmac = new HMACSHA256(key);
        var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        var expectedHex = Convert.ToHexString(expected).ToLowerInvariant();
        var actualHex = signatureHex.Trim().ToLowerInvariant();
        // Constant-time compare
        if (expectedHex.Length != actualHex.Length) return false;
        var diff = 0;
        for (var i = 0; i < expectedHex.Length; i++) diff |= expectedHex[i] ^ actualHex[i];
        return diff == 0;
    }
}
