using System.Net.Http.Json;
using System.Text.Json;

namespace Altaris.Infrastructure.Embeddings;

/// <summary>
///   Provider-agnostic embedding client. Tenant'ın aktif provider config'ine
///   göre OpenAI-uyumlu embeddings endpoint'ine POST eder.
///
///   Desteklenen şemalar:
///   - OpenAI:      POST {base}/v1/embeddings  body { input: [...], model }
///   - Ollama:      POST {base}/api/embeddings body { model, input }
///   - LM Studio:   OpenAI-compatible (aynı şema)
///   - sentence-tx: lokal HTTP wrapper (OpenAI-compatible önerilir)
///
///   Sınıf stateless; her çağrı için yeni HttpClient (HttpClientFactory
///   kullanılması önerilir, şimdilik basit).
/// </summary>
public class EmbeddingClient
{
    private readonly HttpClient _http;

    public EmbeddingClient(HttpClient http) => _http = http;

    public record EmbedRequest(string BaseUrl, string ApiKey, string Model, IReadOnlyList<string> Inputs);
    public record EmbedResult(IReadOnlyList<float[]> Vectors, string Model);

    public async Task<EmbedResult> EmbedAsync(EmbedRequest req, CancellationToken ct = default)
    {
        // Heuristic: Ollama API farklı (input string, output single embedding).
        // OpenAI/LM Studio batch destekler.
        var isOllama = req.BaseUrl.Contains("11434", StringComparison.Ordinal)
                    || req.BaseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase);

        return isOllama
            ? await EmbedOllamaAsync(req, ct)
            : await EmbedOpenAICompatAsync(req, ct);
    }

    private async Task<EmbedResult> EmbedOpenAICompatAsync(EmbedRequest req, CancellationToken ct)
    {
        var url = req.BaseUrl.TrimEnd('/') + "/v1/embeddings";
        using var msg = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new { input = req.Inputs, model = req.Model }),
        };
        if (!string.IsNullOrEmpty(req.ApiKey))
            msg.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", req.ApiKey);

        using var resp = await _http.SendAsync(msg, ct);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var arr = body.GetProperty("data");
        var vectors = new List<float[]>(arr.GetArrayLength());
        foreach (var item in arr.EnumerateArray())
        {
            var emb = item.GetProperty("embedding");
            var vec = new float[emb.GetArrayLength()];
            int i = 0;
            foreach (var v in emb.EnumerateArray()) vec[i++] = v.GetSingle();
            vectors.Add(vec);
        }
        return new EmbedResult(vectors, req.Model);
    }

    private async Task<EmbedResult> EmbedOllamaAsync(EmbedRequest req, CancellationToken ct)
    {
        // Ollama batch desteği yeni — fallback to per-input requests for compat.
        var url = req.BaseUrl.TrimEnd('/').TrimEnd('/', 'a', 'p', 'i') + "/api/embeddings";
        var vectors = new List<float[]>(req.Inputs.Count);
        foreach (var input in req.Inputs)
        {
            using var msg = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(new { model = req.Model, prompt = input }),
            };
            using var resp = await _http.SendAsync(msg, ct);
            resp.EnsureSuccessStatusCode();
            var body = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var emb = body.GetProperty("embedding");
            var vec = new float[emb.GetArrayLength()];
            int i = 0;
            foreach (var v in emb.EnumerateArray()) vec[i++] = v.GetSingle();
            vectors.Add(vec);
        }
        return new EmbedResult(vectors, req.Model);
    }
}
