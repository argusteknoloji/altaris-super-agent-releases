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
    string? SystemPrompt = null,
    Guid? ProviderConfigId = null);

// Content is intentionally JsonElement so the same shape covers both
//   • plain text:    "merhaba"
//   • multimodal:    [{type:"text",text:"bu nedir"}, {type:"image_url", image_url:{url:"data:image/png;base64,..."}}]
// Forwarded as-is to OpenAI-compatible providers (LM Studio, OpenAI).
// Anthropic / Ollama need a per-message shape transform — TODO.
public record ChatMessage(string Role, System.Text.Json.JsonElement Content);

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
                Title = ExtractTitle(req.Messages.FirstOrDefault()?.Content),
                StartedAt = DateTimeOffset.UtcNow
            };
            db.Sessions.Add(session);
            await db.SaveChangesAsync(cancel);
        }

        // Persist incoming user message (last in array). content is forwarded
        // as-is so multimodal parts (image_url, etc.) survive replay.
        var lastUser = req.Messages.LastOrDefault(m => m.Role == "user");
        if (lastUser != null)
        {
            db.SessionMessages.Add(new SessionMessage
            {
                TenantId = tenant.TenantId.Value,
                SessionId = session.Id,
                Role = "user",
                Content = lastUser.Content.GetRawText(),
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

        // Resolve tenant provider config (gives us the real baseUrl + apiKey)
        Domain.Entities.ProviderConfig? cfg = null;
        if (req.ProviderConfigId is { } cfgId)
        {
            cfg = await db.ProviderConfigs.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == cfgId && p.TenantId == tenant.TenantId, cancel);
        }
        cfg ??= await db.ProviderConfigs.AsNoTracking()
            .Where(p => p.TenantId == tenant.TenantId && p.Provider == req.Provider && p.Enabled)
            .OrderByDescending(p => p.IsDefault)
            .FirstOrDefaultAsync(cancel);

        // JIT OAuth refresh — eğer token expire olmuş veya 5 dakika içinde
        // expire ediyorsa, request'ten ÖNCE refresh et. Worker 5dk'da bir
        // çalışır; kullanıcı arada chat atarsa expired token ile gitmesin.
        if (cfg is not null && cfg.AuthKind == "oauth"
            && cfg.AccessTokenExpiresAt is not null
            && cfg.AccessTokenExpiresAt < DateTimeOffset.UtcNow.AddMinutes(5))
        {
            // Tracked entity ile çalışmamız lazım — refresher SaveChangesAsync çağırıyor
            var tracked = await db.ProviderConfigs.FirstOrDefaultAsync(p => p.Id == cfg.Id, cancel);
            if (tracked is not null)
            {
                var refreshed = cfg.Provider.ToLowerInvariant() switch
                {
                    "anthropic" => await AnthropicTokenRefresher.RefreshOneAsync(tracked, db, httpFactory),
                    "codex"     => await CodexTokenRefresher.RefreshOneAsync(tracked, db, httpFactory),
                    _           => false,
                };
                if (refreshed) cfg = tracked; // tazelenmiş token chat'te kullanılacak
            }
        }

        try
        {
            switch (req.Provider.ToLowerInvariant())
            {
                case "anthropic":
                    await StreamAnthropic(req, cfg, config, httpFactory, ctx, collected, cancel);
                    break;
                case "ollama":
                    await StreamOllama(req, cfg, config, httpFactory, ctx, collected, cancel);
                    break;
                case "codex":
                    await StreamCodex(req, cfg, httpFactory, ctx, collected, cancel);
                    break;
                case "lmstudio":
                case "openai":
                    await StreamOpenAiCompatible(req, cfg, config, httpFactory, ctx, collected, cancel);
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
        ChatRequest req, Domain.Entities.ProviderConfig? pc, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var apiKey = pc?.ApiKeyEnc
                     ?? cfg["Providers:Anthropic:ApiKey"]
                     ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        var endpoint = !string.IsNullOrEmpty(pc?.BaseUrl) ? pc!.BaseUrl!.TrimEnd('/') : "https://api.anthropic.com";
        if (string.IsNullOrEmpty(apiKey))
        {
            await Sse(ctx, "error", "{\"message\":\"ANTHROPIC_API_KEY not configured\"}", cancel);
            return;
        }

        var client = hf.CreateClient();

        // OAuth-backed Anthropic tokens (claude_code scope) ZORUNLU olarak
        // system prompt'unun ilk satırı "You are Claude Code, Anthropic's official
        // CLI for Claude." olmalı — yoksa Anthropic isteği reddediyor (yanıltıcı
        // 'rate_limit_error' mesajıyla). User'ın system prompt'una ön ek ekliyoruz.
        const string CLAUDE_CODE_PRELUDE = "You are Claude Code, Anthropic's official CLI for Claude.";
        string? effectiveSystem = pc?.AuthKind == "oauth"
            ? string.IsNullOrWhiteSpace(req.SystemPrompt)
                ? CLAUDE_CODE_PRELUDE
                : $"{CLAUDE_CODE_PRELUDE}\n\n{req.SystemPrompt}"
            : req.SystemPrompt;

        var payload = new
        {
            model = req.Model,
            max_tokens = req.MaxTokens,
            stream = true,
            system = effectiveSystem,
            messages = req.Messages.Select(m => new { role = m.Role, content = (object)m.Content }).ToArray()
        };

        var hreq = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/v1/messages")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        // OAuth bağlı provider'da access_token Bearer'la, x-api-key değil.
        // Claude Code beta scope'una claim erişimi için anthropic-beta header zorunlu.
        if (pc?.AuthKind == "oauth")
        {
            hreq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            hreq.Headers.Add("anthropic-beta", "oauth-2025-04-20");
            // CLI ile birebir UA — Anthropic OAuth token check'i UA'ya da bakabiliyor
            hreq.Headers.UserAgent.ParseAdd("altaris/0.1.0-alpha");
        }
        else
        {
            hreq.Headers.Add("x-api-key", apiKey);
        }
        hreq.Headers.Add("anthropic-version", "2023-06-01");

        using var resp = await client.SendAsync(hreq, HttpCompletionOption.ResponseHeadersRead, cancel);
        if (!resp.IsSuccessStatusCode)
        {
            var errBody = await resp.Content.ReadAsStringAsync(cancel);
            // Anthropic 'rate_limit_error' OAuth scope/policy hatasını maskeliyor;
            // kullanıcıya gerçek body'i göster ki diagnose edilebilsin.
            await Sse(ctx, "error",
                JsonSerializer.Serialize(new { message = $"Anthropic HTTP {(int)resp.StatusCode}: {errBody[..Math.Min(400, errBody.Length)]}" }),
                cancel);
            return;
        }

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
        ChatRequest req, Domain.Entities.ProviderConfig? pc, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var baseUrl = pc?.BaseUrl?.TrimEnd('/') ?? cfg["Providers:Ollama:BaseUrl"] ?? "http://localhost:11434";
        var client = hf.CreateClient();
        var payload = new
        {
            model = req.Model,
            stream = true,
            messages = req.Messages.Select(m => new { role = m.Role, content = (object)m.Content }).ToArray()
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
        ChatRequest req, Domain.Entities.ProviderConfig? pc, IConfiguration cfg, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var baseUrl = pc?.BaseUrl?.TrimEnd('/')
                      ?? (req.Provider == "lmstudio"
                          ? cfg["Providers:LMStudio:BaseUrl"] ?? "http://localhost:1234/v1"
                          : cfg["Providers:OpenAI:BaseUrl"] ?? "https://api.openai.com/v1");
        var apiKey = pc?.ApiKeyEnc
                     ?? (req.Provider == "lmstudio"
                         ? cfg["Providers:LMStudio:ApiKey"] ?? "lm-studio"
                         : cfg["Providers:OpenAI:ApiKey"] ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "");

        var client = hf.CreateClient();
        var payload = new
        {
            model = req.Model,
            stream = true,
            max_tokens = req.MaxTokens,
            messages = req.Messages.Select(m => new { role = m.Role, content = (object)m.Content }).ToArray()
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

    /// <summary>
    ///   ChatGPT/Codex backend (https://chatgpt.com/backend-api/codex). OpenAI uyumlu
    ///   chat/completions formatı kullanır + chatgpt-account-id header zorunlu.
    ///   Auth: pc.ApiKeyEnc (CodexTokenRefresher worker tarafından tazelenen access_token).
    /// </summary>
    private static async Task StreamCodex(
        ChatRequest req, Domain.Entities.ProviderConfig? pc, IHttpClientFactory hf,
        HttpContext ctx, StringBuilder collected, CancellationToken cancel)
    {
        var baseUrl = pc?.BaseUrl?.TrimEnd('/') ?? "https://chatgpt.com/backend-api/codex";
        var accessToken = pc?.ApiKeyEnc;
        var accountId = pc?.AccountId;
        if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(accountId))
        {
            await Sse(ctx, "error",
                JsonSerializer.Serialize(new { message = "Codex provider eksik (access_token / account_id). `altaris provider connect codex` ile yeniden bağla." }),
                cancel);
            return;
        }

        // Codex /responses (OpenAI Responses API) — chat/completions değil!
        // Body: { model, input: [{type:"message", role, content:[{type:"input_text", text}]}], stream }
        // System prompt → "instructions" field
        // Model alias: codexplan → gpt-5.5, codexspark → gpt-5.3-codex-spark (CLI providerConfig.ts)
        var resolvedModel = req.Model.ToLowerInvariant() switch
        {
            "codexplan"  => "gpt-5.5",
            "codexspark" => "gpt-5.3-codex-spark",
            _            => req.Model,
        };
        var input = req.Messages.Select(m => new
        {
            type = "message",
            role = m.Role,
            content = new[] { new { type = m.Role == "assistant" ? "output_text" : "input_text", text = ContentToText(m.Content) } }
        }).ToArray();
        var payload = new Dictionary<string, object?>
        {
            ["model"]  = resolvedModel,
            ["input"]  = input.Length > 0 ? (object)input : new[] {
                new { type = "message", role = "user", content = new[] { new { type = "input_text", text = "" } } }
            },
            ["stream"] = true,
            ["store"]  = false,
        };
        // GPT-5 codex serisi reasoning destekli — codexplan default high
        if (req.Model.Equals("codexplan", StringComparison.OrdinalIgnoreCase))
            payload["reasoning"] = new { effort = "high" };
        // Codex /responses endpoint'i instructions field'ını zorunlu kılıyor (boş bile olamaz)
        payload["instructions"] = string.IsNullOrWhiteSpace(req.SystemPrompt)
            ? "You are a helpful assistant."
            : req.SystemPrompt;

        var client = hf.CreateClient();
        var hreq = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/responses")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        hreq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        hreq.Headers.Add("chatgpt-account-id", accountId);
        hreq.Headers.Add("session_id", Guid.NewGuid().ToString());
        hreq.Headers.Add("originator", "altaris");

        using var resp = await client.SendAsync(hreq, HttpCompletionOption.ResponseHeadersRead, cancel);
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(cancel);
            await Sse(ctx, "error",
                JsonSerializer.Serialize(new { message = $"Codex HTTP {(int)resp.StatusCode}: {body[..Math.Min(300, body.Length)]}" }),
                cancel);
            return;
        }

        // Responses API SSE format — events: response.output_text.delta + response.completed
        using var stream = await resp.Content.ReadAsStreamAsync(cancel);
        using var reader = new StreamReader(stream);
        string? currentEvent = null;
        string? line;
        while ((line = await reader.ReadLineAsync(cancel)) != null)
        {
            if (line.StartsWith("event: "))
            {
                currentEvent = line[7..].Trim();
                continue;
            }
            if (!line.StartsWith("data: ")) continue;
            var data = line[6..];
            if (currentEvent == "response.output_text.delta")
            {
                try
                {
                    using var doc = JsonDocument.Parse(data);
                    if (doc.RootElement.TryGetProperty("delta", out var d))
                    {
                        var text = d.GetString() ?? "";
                        if (text.Length > 0)
                        {
                            collected.Append(text);
                            await Sse(ctx, "delta", JsonSerializer.Serialize(new { text }), cancel);
                        }
                    }
                }
                catch (JsonException) { /* skip */ }
            }
            else if (currentEvent == "response.completed" || currentEvent == "response.failed")
            {
                break;
            }
        }
    }

    private static string ContentToText(object content)
    {
        if (content is string s) return s;
        // ChatRequest.Message.Content JsonElement olabilir (resim/dosya parts) — text'leri birleştir
        if (content is JsonElement el)
        {
            if (el.ValueKind == JsonValueKind.String) return el.GetString() ?? "";
            if (el.ValueKind == JsonValueKind.Array)
            {
                var sb = new StringBuilder();
                foreach (var p in el.EnumerateArray())
                {
                    if (p.ValueKind == JsonValueKind.Object && p.TryGetProperty("type", out var t)
                        && t.GetString() == "text" && p.TryGetProperty("text", out var txt))
                        sb.Append(txt.GetString());
                }
                return sb.ToString();
            }
        }
        return content?.ToString() ?? "";
    }

    /// <summary>Pull a short title out of a content JsonElement (string or array of parts).</summary>
    private static string? ExtractTitle(JsonElement? raw)
    {
        if (raw is not { } el) return null;
        string? text = el.ValueKind switch
        {
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Array  => el.EnumerateArray()
                .Where(p => p.ValueKind == JsonValueKind.Object &&
                            p.TryGetProperty("type", out var t) && t.GetString() == "text")
                .Select(p => p.TryGetProperty("text", out var x) ? x.GetString() : null)
                .FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)),
            _ => null
        };
        if (string.IsNullOrWhiteSpace(text)) return null;
        return text.Length <= 80 ? text : text[..80];
    }

    private static async Task Sse(HttpContext ctx, string evt, string json, CancellationToken cancel)
    {
        var bytes = Encoding.UTF8.GetBytes($"event: {evt}\ndata: {json}\n\n");
        await ctx.Response.Body.WriteAsync(bytes, cancel);
        await ctx.Response.Body.FlushAsync(cancel);
    }
}
