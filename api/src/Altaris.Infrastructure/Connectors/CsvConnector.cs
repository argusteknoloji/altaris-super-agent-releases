using System.Text;
using System.Text.Json;

namespace Altaris.Infrastructure.Connectors;

/// <summary>
///   CSV/Excel-as-CSV connector. Config formatı:
///   {
///     "csvBase64": "...",       // veya "csvText" / "url"
///     "delimiter": ",",
///     "groupByColumn": "müşteri" // her unique değer için ayrı dosya
///   }
///
///   Excel için (xlsx): config'de excelBase64 → ClosedXML ile sheet'leri
///   CSV'ye dönüştür, sonra aynı pipeline. (Sprint EB-2.1'de eklenecek;
///   şimdilik kullanıcı Excel'i CSV'ye export etsin.)
/// </summary>
public class CsvConnector : IConnector
{
    public string Kind => "csv";

    public Task<TestResult> TestAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        try
        {
            var (rows, _) = ParseCsv(ctx);
            return Task.FromResult(new TestResult(true, $"{rows.Count} satır okundu"));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new TestResult(false, ex.Message));
        }
    }

    public Task<SyncResult> SyncAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        var (rows, headers) = ParseCsv(ctx);
        var cfg = JsonDocument.Parse(string.IsNullOrEmpty(ctx.ConfigJson) ? "{}" : ctx.ConfigJson).RootElement;
        var groupBy = cfg.TryGetProperty("groupByColumn", out var gb) ? gb.GetString() : null;
        var sheetName = cfg.TryGetProperty("sheetName", out var sn) ? sn.GetString() ?? "veri" : "veri";

        var files = new List<SyncFile>();
        if (!string.IsNullOrEmpty(groupBy) && headers.Contains(groupBy, StringComparer.OrdinalIgnoreCase))
        {
            // Her unique grup değeri için ayrı markdown dosya
            var colIdx = headers.FindIndex(h => h.Equals(groupBy, StringComparison.OrdinalIgnoreCase));
            var groups = rows.GroupBy(r => colIdx < r.Length ? r[colIdx] : "(boş)");
            foreach (var g in groups)
            {
                var safeKey = SanitizeFileName(g.Key);
                files.Add(new SyncFile(
                    $"connector-imports/{ctx.Name}/{safeKey}.md",
                    RenderMarkdown(headers, g.ToList(), $"{sheetName} — {g.Key}")
                ));
            }
        }
        else
        {
            // Tek dosya
            files.Add(new SyncFile(
                $"connector-imports/{ctx.Name}/{sheetName}.md",
                RenderMarkdown(headers, rows, sheetName)
            ));
        }
        return Task.FromResult(new SyncResult(files.Count, files, $"{rows.Count} satır işlendi"));
    }

    private static (List<string[]> rows, List<string> headers) ParseCsv(ConnectorContext ctx)
    {
        var cfg = JsonDocument.Parse(string.IsNullOrEmpty(ctx.ConfigJson) ? "{}" : ctx.ConfigJson).RootElement;
        var delimiter = cfg.TryGetProperty("delimiter", out var d) ? (d.GetString() ?? ",")[0] : ',';

        string text;
        if (cfg.TryGetProperty("csvText", out var txt))
            text = txt.GetString() ?? "";
        else if (cfg.TryGetProperty("csvBase64", out var b64))
            text = Encoding.UTF8.GetString(Convert.FromBase64String(b64.GetString() ?? ""));
        else
            throw new InvalidOperationException("config.csvText veya config.csvBase64 zorunlu");

        var lines = text.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0) throw new InvalidOperationException("CSV boş");

        var headers = ParseCsvLine(lines[0], delimiter).ToList();
        var rows = lines.Skip(1).Select(l => ParseCsvLine(l, delimiter)).ToList();
        return (rows, headers);
    }

    /// <summary>Quote-aware CSV satır parse'ı (RFC 4180 simplified).</summary>
    private static string[] ParseCsvLine(string line, char delim)
    {
        var fields = new List<string>();
        var sb = new StringBuilder();
        bool inQuote = false;
        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuote)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                    else inQuote = false;
                }
                else sb.Append(c);
            }
            else
            {
                if (c == '"') inQuote = true;
                else if (c == delim) { fields.Add(sb.ToString()); sb.Clear(); }
                else sb.Append(c);
            }
        }
        fields.Add(sb.ToString());
        return fields.ToArray();
    }

    private static string RenderMarkdown(List<string> headers, List<string[]> rows, string title)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"# {title}");
        sb.AppendLine();
        sb.AppendLine($"_Connector tarafından üretildi · {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC · {rows.Count} satır_");
        sb.AppendLine();
        sb.Append("| ");
        sb.Append(string.Join(" | ", headers.Select(h => h.Replace("|", "\\|"))));
        sb.AppendLine(" |");
        sb.Append("|");
        sb.Append(string.Join("|", headers.Select(_ => "---")));
        sb.AppendLine("|");
        foreach (var r in rows)
        {
            sb.Append("| ");
            for (int i = 0; i < headers.Count; i++)
            {
                var cell = i < r.Length ? r[i] : "";
                sb.Append(cell.Replace("\n", " ").Replace("|", "\\|"));
                sb.Append(i == headers.Count - 1 ? " |" : " | ");
            }
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string SanitizeFileName(string s)
    {
        var clean = new string(s.ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c is '-' or '_' or ' ').ToArray())
            .Trim().Replace(' ', '-');
        if (clean.Length == 0) clean = "boş";
        if (clean.Length > 64) clean = clean[..64];
        return clean;
    }
}
