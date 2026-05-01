using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;
using Altaris.Infrastructure.MultiTenancy;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /api/v1/chat — Server-Sent Events streaming endpoint that forwards prompts
///   to the configured upstream model provider (Anthropic, LM Studio, Ollama)
///   and streams response chunks back to the browser.
///   Persists the conversation under the caller's tenant for replay in the dashboard.
/// </summary>
public record ChatRequest(
    string Provider,
    string Model,
    Guid? SessionId,
    List<ChatMessage> Messages,
    int MaxTokens = 1024,
    string? SystemPrompt = null);

public record ChatMessage(string Role, string Content);

public static class ChatEndpoints
{
    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/chat", HandleChat).RequireAuthorization();
        return app;
    }

    private static async Task HandleChat(
        HttpContext ctx,
        ChatRequest req,
        AltarisDbContext db,
        ITenantContext tenant,
        IConfiguration config,
        IHttpClientFactory httpFactory,
        CancellationToken cancel)
    {
        if (tenant.TenantId is null || tenant.UserId is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        // Open or resume session
        AgentSession session;
        if (req.SessionId is { } sid)
        {
            session = await db.Sessions.FirstAsync(s => s.Id == sid, cancel);
        }
        else
        {
            session = new AgentSession
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.TenantId.Value,
                UserId = tenant.UserId.Value,
                Source = "web",
                Provider = req.Provider,
                Model = req.Model,
                Title = req.Messages.FirstOrDefault()?.Content[..Math.Min(80, req.Messages.FirstOrDefault()?.Content.Length ?? 0)],
                StartedAt = DateTimeOffset.UtcNow
            };
            db.Sessions.Add(session);
            await db.SaveChangesAsync(cancel);
        }

        // Persist incoming user message (last in array)
        var lastUser = req.Messages.LastOrDefault(m => m.Role == "user");
        if (lastUser != null)
        {
            db.SessionMessages.Add(new SessionMessage
            {
                TenantId = tenant.TenantId.Value,
                SessionId = session.Id,
                Role = "user",
                Content = JsonSerializer.Serialize(new { text = lastUser.Content }),
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(cancel);
        }

        // SSE response headers
        ctx.Response.Headers.ContentType = "text/event-stream";
        ctx.Response.Headers.CacheControl = "no-cache";
        ctx.Response.Headers["X-Accel-Buffering"] = "no";

        // Send session id first
        await Sse(ctx, "session", JsonSerializer.Serialize(new { id = session.Id }), cancel);

        var collected = new StringBuilder();

        try
        {
            switch (req.Provider.ToLowerInvariant())
            {
                case "anthropic":
                    await StreamAnthropic(req, config, httpFactory, ctx, collected, cancel);
                    break;
                case "ollama":
                    await StreamOllama(req, config, httpFactory, ctx, collected, cancel);
                    break;
                case "lmstudio":
                case "openai":
                    await StreamOpenAiCompatible(req, config, httpFactory, ctx, collected, cancel);
                    break;
                default:
                    await Sse(ctx, "error", JsonSerializer.Serialize(new { message = $"Unknown provider: {req.Provider}" }), cancel);
                    return;
            }

            // Persist assistant turn
            db.SessionMessages.Add(new SessionMessage
            {
                TenantId = tenant.TenantId.Value,
                SessionId = session.Id,
                Role = "assistant",
                Content = JsonSerializer.Serialize(new { text = collected.ToString() }),
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(CancellationToken.None);

            await Sse(ctx, "done", "{}", cancel);
        }
        catch (OperationCanceledException) { /* client disconnect */ }
        catch (Exception e)
        {
            await Sse(ctx, "error", JsonSerializer.Serialize(new { message = e.Message }), CancellationToken.None);
        }
    }

    private static async Task StreamAnthropic(
        ChatRequest req, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var apiKey = cfg["Providers:Anthropic:ApiKey"] ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            await Sse(ctx, "error", "{\"message\":\"ANTHROPIC_API_KEY not configured\"}", cancel);
            return;
        }

        var client = hf.CreateClient();
        var payload = new
        {
            model = req.Model,
            max_tokens = req.MaxTokens,
            stream = true,
            system = req.SystemPrompt,
            messages = req.Messages.Select(m => new { role = m.Role, content = m.Content }).ToArray()
        };

        var hreq = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        hreq.Headers.Add("x-api-key", apiKey);
        hreq.Headers.Add("anthropic-version", "2023-06-01");

        using var resp = await client.SendAsync(hreq, HttpCompletionOption.ResponseHeadersRead, cancel);
        resp.EnsureSuccessStatusCode();

        using var stream = await resp.Content.ReadAsStreamAsync(cancel);
        using var reader = new StreamReader(stream);

        string? line;
        while ((line = await reader.ReadLineAsync(cancel)) != null)
        {
            if (!line.StartsWith("data: ")) continue;
            var data = line[6..];
            if (data == "[DONE]") break;
            try
            {
                using var doc = JsonDocument.Parse(data);
                var root = doc.RootElement;
                if (root.TryGetProperty("type", out var typ) && typ.GetString() == "content_block_delta")
                {
                    var text = root.GetProperty("delta").GetProperty("text").GetString() ?? "";
                    collected.Append(text);
                    await Sse(ctx, "delta", JsonSerializer.Serialize(new { text }), cancel);
                }
            }
            catch (JsonException) { /* skip malformed */ }
        }
    }

    private static async Task StreamOllama(
        ChatRequest req, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var baseUrl = cfg["Providers:Ollama:BaseUrl"] ?? "http://localhost:11434";
        var client = hf.CreateClient();
        var payload = new
        {
            model = req.Model,
            stream = true,
            messages = req.Messages.Select(m => new { role = m.Role, content = m.Content }).ToArray()
        };

        var hreq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/chat")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        using var resp = await client.SendAsync(hreq, HttpCompletionOption.ResponseHeadersRead, cancel);
        resp.EnsureSuccessStatusCode();

        using var stream = await resp.Content.ReadAsStreamAsync(cancel);
        using var reader = new StreamReader(stream);

        string? line;
        while ((line = await reader.ReadLineAsync(cancel)) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                using var doc = JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("message", out var msg)
                    && msg.TryGetProperty("content", out var content))
                {
                    var text = content.GetString() ?? "";
                    if (text.Length > 0)
                    {
                        collected.Append(text);
                        await Sse(ctx, "delta", JsonSerializer.Serialize(new { text }), cancel);
                    }
                }
                if (doc.RootElement.TryGetProperty("done", out var done) && done.GetBoolean()) break;
            }
            catch (JsonException) { }
        }
    }

    private static async Task StreamOpenAiCompatible(
        ChatRequest req, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var baseUrl = req.Provider == "lmstudio"
            ? cfg["Providers:LMStudio:BaseUrl"] ?? "http://localhost:1234/v1"
            : cfg["Providers:OpenAI:BaseUrl"] ?? "https://api.openai.com/v1";
        var apiKey = req.Provider == "lmstudio"
            ? cfg["Providers:LMStudio:ApiKey"] ?? "lm-studio"
            : cfg["Providers:OpenAI:ApiKey"] ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";

        var client = hf.CreateClient();
        var payload = new
        {
            model = req.Model,
            stream = true,
            max_tokens = req.MaxTokens,
            messages = req.Messages.Select(m => new { role = m.Role, content = m.Content }).ToArray()
        };

        var hreq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        if (!string.IsNullOrEmpty(apiKey))
            hreq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        using var resp = await client.SendAsync(hreq, HttpCompletionOption.ResponseHeadersRead, cancel);
        resp.EnsureSuccessStatusCode();

        using var stream = await resp.Content.ReadAsStreamAsync(cancel);
        using var reader = new StreamReader(stream);

        string? line;
        while ((line = await reader.ReadLineAsync(cancel)) != null)
        {
            if (!line.StartsWith("data: ")) continue;
            var data = line[6..];
            if (data == "[DONE]") break;
            try
            {
                using var doc = JsonDocument.Parse(data);
                if (doc.RootElement.TryGetProperty("choices", out var ch) && ch.GetArrayLength() > 0)
                {
                    var delta = ch[0].GetProperty("delta");
                    if (delta.TryGetProperty("content", out var c))
                    {
                        var text = c.GetString() ?? "";
                        collected.Append(text);
                        await Sse(ctx, "delta", JsonSerializer.Serialize(new { text }), cancel);
                    }
                }
            }
            catch (JsonException) { }
        }
    }

    private static async Task Sse(HttpContext ctx, string evt, string json, CancellationToken cancel)
    {
        var bytes = Encoding.UTF8.GetBytes($"event: {evt}\ndata: {json}\n\n");
        await ctx.Response.Body.WriteAsync(bytes, cancel);
        await ctx.Response.Body.FlushAsync(cancel);
    }
}
