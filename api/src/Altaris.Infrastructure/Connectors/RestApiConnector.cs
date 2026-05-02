using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Altaris.Infrastructure.Connectors;

/// <summary>
///   Generic REST API connector — Logo Tiger / Netsis / Salesforce / HubSpot
///   gibi sistemlerin REST API'larını ortak şablonla çekip vault'a markdown
///   olarak yazar.
///
///   Config formatı:
///   {
///     "baseUrl": "https://api.salesforce.com",
///     "endpoints": [
///       {
///         "path": "/services/data/v59.0/query?q=SELECT+Name,AccountId,Amount+FROM+Opportunity+LIMIT+200",
///         "vaultPath": "salesforce/opportunities.md",
///         "title": "Salesforce Fırsatları",
///         "rowsField": "records",          // JSON path to row array (default: response itself)
///         "groupByField": "AccountId",      // optional: per-group dosya
///         "displayFields": ["Name", "Amount", "StageName", "CloseDate"]
///       }
///     ],
///     "authType": "bearer" | "basic" | "header" | "none",
///     "headerName": "X-API-Key"            // authType=header için
///   }
///   secret:
///     authType=bearer  → access token
///     authType=basic   → "user:password"
///     authType=header  → header value
/// </summary>
public class RestApiConnector : IConnector
{
    private readonly string _kind;
    public string Kind => _kind;

    public RestApiConnector(string kind = "rest_api") => _kind = kind;

    public async Task<TestResult> TestAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        try
        {
            var (baseUrl, _, http, _) = await ParseConfigAsync(ctx);
            using var resp = await http.GetAsync(baseUrl, ct);
            return new TestResult(resp.IsSuccessStatusCode,
                $"GET {baseUrl} → HTTP {(int)resp.StatusCode}");
        }
        catch (Exception ex)
        {
            return new TestResult(false, ex.Message);
        }
    }

    public async Task<SyncResult> SyncAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        var (baseUrl, endpoints, http, label) = await ParseConfigAsync(ctx);
        var files = new List<SyncFile>();
        int totalRows = 0;

        foreach (var ep in endpoints)
        {
            var path = ep.GetProperty("path").GetString() ?? "";
            var vaultPath = ep.TryGetProperty("vaultPath", out var vp) ? vp.GetString() : null;
            var title = ep.TryGetProperty("title", out var t) ? t.GetString() ?? path : path;
            var rowsField = ep.TryGetProperty("rowsField", out var rf) ? rf.GetString() : null;
            var groupByField = ep.TryGetProperty("groupByField", out var gb) ? gb.GetString() : null;
            string[] displayFields = ep.TryGetProperty("displayFields", out var df) && df.ValueKind == JsonValueKind.Array
                ? df.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToArray()
                : Array.Empty<string>();

            var fullUrl = baseUrl.TrimEnd('/') + (path.StartsWith('/') ? path : "/" + path);
            using var resp = await http.GetAsync(fullUrl, ct);
            if (!resp.IsSuccessStatusCode)
            {
                files.Add(new SyncFile(
                    $"connector-imports/{label}/{SanitizeName(title)}-error.md",
                    $"# {title}\n\n## ERROR — HTTP {(int)resp.StatusCode}\n\nGET `{fullUrl}` başarısız.\n\n```\n" +
                    (await resp.Content.ReadAsStringAsync(ct)) + "\n```"));
                continue;
            }

            var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            var rowsEl = doc.RootElement;
            if (!string.IsNullOrEmpty(rowsField))
            {
                if (rowsEl.TryGetProperty(rowsField, out var nested))
                    rowsEl = nested;
                else
                {
                    files.Add(new SyncFile(
                        $"connector-imports/{label}/{SanitizeName(title)}-empty.md",
                        $"# {title}\n\n_rowsField '{rowsField}' bulunamadı; ham response:_\n\n```json\n" +
                        JsonSerializer.Serialize(doc.RootElement, new JsonSerializerOptions { WriteIndented = true }) +
                        "\n```"));
                    continue;
                }
            }
            if (rowsEl.ValueKind != JsonValueKind.Array)
            {
                files.Add(new SyncFile(
                    $"connector-imports/{label}/{SanitizeName(title)}.md",
                    $"# {title}\n\n```json\n" +
                    JsonSerializer.Serialize(rowsEl, new JsonSerializerOptions { WriteIndented = true }) +
                    "\n```"));
                continue;
            }

            var rows = rowsEl.EnumerateArray().ToList();
            totalRows += rows.Count;
            var keys = displayFields.Length > 0
                ? displayFields
                : (rows.Count > 0 && rows[0].ValueKind == JsonValueKind.Object
                    ? rows[0].EnumerateObject().Take(8).Select(p => p.Name).ToArray()
                    : Array.Empty<string>());

            if (!string.IsNullOrEmpty(groupByField))
            {
                var groups = rows
                    .Where(r => r.ValueKind == JsonValueKind.Object)
                    .GroupBy(r => r.TryGetProperty(groupByField, out var g) ? g.ToString() : "(boş)");
                foreach (var grp in groups)
                {
                    var safe = SanitizeName(grp.Key);
                    var basePath = vaultPath ?? $"connector-imports/{label}/{SanitizeName(title)}";
                    files.Add(new SyncFile(
                        basePath.Replace(".md", $"/{safe}.md"),
                        RenderRowsMarkdown($"{title} — {grp.Key}", keys, grp.ToList())
                    ));
                }
            }
            else
            {
                var path1 = vaultPath ?? $"connector-imports/{label}/{SanitizeName(title)}.md";
                files.Add(new SyncFile(path1, RenderRowsMarkdown(title, keys, rows)));
            }
        }

        return new SyncResult(files.Count, files, $"{totalRows} satır işlendi");
    }

    private static async Task<(string baseUrl, List<JsonElement> endpoints, HttpClient http, string label)>
        ParseConfigAsync(ConnectorContext ctx)
    {
        var cfg = JsonDocument.Parse(string.IsNullOrEmpty(ctx.ConfigJson) ? "{}" : ctx.ConfigJson).RootElement;
        var baseUrl = cfg.TryGetProperty("baseUrl", out var b) ? b.GetString() ?? "" : "";
        if (string.IsNullOrEmpty(baseUrl)) throw new InvalidOperationException("config.baseUrl required");

        var endpoints = cfg.TryGetProperty("endpoints", out var eps) && eps.ValueKind == JsonValueKind.Array
            ? eps.EnumerateArray().ToList()
            : new List<JsonElement>();

        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        var authType = cfg.TryGetProperty("authType", out var at) ? at.GetString() ?? "none" : "none";
        switch (authType)
        {
            case "bearer":
                if (!string.IsNullOrEmpty(ctx.Secret))
                    http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ctx.Secret);
                break;
            case "basic":
                if (!string.IsNullOrEmpty(ctx.Secret))
                    http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic",
                        Convert.ToBase64String(Encoding.UTF8.GetBytes(ctx.Secret)));
                break;
            case "header":
                var headerName = cfg.TryGetProperty("headerName", out var hn) ? hn.GetString() : "X-API-Key";
                if (!string.IsNullOrEmpty(ctx.Secret) && !string.IsNullOrEmpty(headerName))
                    http.DefaultRequestHeaders.Add(headerName, ctx.Secret);
                break;
        }
        await Task.CompletedTask;
        return (baseUrl, endpoints, http, SanitizeName(ctx.Name));
    }

    private static string RenderRowsMarkdown(string title, string[] keys, List<JsonElement> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"# {title}");
        sb.AppendLine();
        sb.AppendLine($"_Connector tarafından üretildi · {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC · {rows.Count} satır_");
        sb.AppendLine();
        if (keys.Length == 0 || rows.Count == 0)
        {
            sb.AppendLine("_Boş veya tablo türünde değil._");
            return sb.ToString();
        }
        sb.Append("| ");
        sb.Append(string.Join(" | ", keys.Select(k => k.Replace("|", "\\|"))));
        sb.AppendLine(" |");
        sb.Append("|");
        sb.Append(string.Join("|", keys.Select(_ => "---")));
        sb.AppendLine("|");
        foreach (var r in rows)
        {
            sb.Append("| ");
            for (int i = 0; i < keys.Length; i++)
            {
                string cell = "";
                if (r.ValueKind == JsonValueKind.Object && r.TryGetProperty(keys[i], out var v))
                    cell = v.ValueKind switch {
                        JsonValueKind.String => v.GetString() ?? "",
                        JsonValueKind.Number => v.ToString(),
                        JsonValueKind.True => "true",
                        JsonValueKind.False => "false",
                        JsonValueKind.Null => "",
                        _ => v.ToString()
                    };
                cell = cell.Replace("\n", " ").Replace("|", "\\|");
                if (cell.Length > 200) cell = cell[..200] + "…";
                sb.Append(cell);
                sb.Append(i == keys.Length - 1 ? " |" : " | ");
            }
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string SanitizeName(string s)
    {
        var clean = new string(s.ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c is '-' or '_' or ' ').ToArray())
            .Trim().Replace(' ', '-');
        if (clean.Length == 0) clean = "boş";
        if (clean.Length > 80) clean = clean[..80];
        return clean;
    }
}
