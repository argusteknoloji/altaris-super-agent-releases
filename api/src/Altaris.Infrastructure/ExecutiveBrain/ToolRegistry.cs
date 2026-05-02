using System.Text.Json;
using Altaris.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Altaris.Infrastructure.ExecutiveBrain;

/// <summary>
///   Executive Brain agent'ları için tool framework.
///   LLM'den OpenAI-style tool_call dönerse worker bu registry'den çalıştırır.
///
///   Şu an built-in tools:
///   - calc            — güvenli aritmetik (+, -, *, /, parantez, % ).
///   - structured_query — vault_files içinde TR-TR ILIKE arama (gelecekte
///                        connector verisi için SQL).
///   - chart_spec      — vega-lite-uyumlu spec üretir, UI render eder.
///   - now             — şu anın TR datetime'ını döner (zaman tabanlı sorular).
///
///   Sandboxed code_exec sonraki sürümde (Python container ile).
/// </summary>
public static class ToolRegistry
{
    public record ToolSpec(string Name, string Description, object Parameters);

    /// <summary>OpenAI tool spec şeması. Agent'ın izinli tool'ları enabled.</summary>
    public static IReadOnlyList<ToolSpec> AllSpecs => new[]
    {
        new ToolSpec("calc",
            "Aritmetik ifade hesaplar (yalnız +, -, *, /, %, parantez). Para hesabı, yüzde, oran için kullan.",
            new {
                type = "object",
                properties = new {
                    expression = new { type = "string", description = "Hesaplanacak ifade, örn: '120000 * 0.18 / 12'" }
                },
                required = new[] { "expression" }
            }),
        new ToolSpec("structured_query",
            "Vault dosyaları içinde anahtar kelime + filtre ile arar. Tarih, müşteri adı, sözleşme tipi gibi yapılandırılmış aramalar için.",
            new {
                type = "object",
                properties = new {
                    keyword = new { type = "string", description = "Aranacak kelime/cümle (TR/EN)" },
                    vaultSlug = new { type = "string", description = "Tek vault ile sınırlamak için slug; boşsa hepsi" },
                    limit = new { type = "integer", description = "Maks sonuç (1-50)" }
                },
                required = new[] { "keyword" }
            }),
        new ToolSpec("chart_spec",
            "Vega-Lite chart spec üretir; UI bunu render eder. Bar, line, pie tipleri için.",
            new {
                type = "object",
                properties = new {
                    title = new { type = "string" },
                    chartType = new { type = "string", description = "bar | line | pie" },
                    xLabel = new { type = "string" },
                    yLabel = new { type = "string" },
                    data = new { type = "array", description = "[{ label, value }] formatında dizi" }
                },
                required = new[] { "chartType", "data" }
            }),
        new ToolSpec("now",
            "Şu anın Türkiye saatini ISO 8601 formatında döner.",
            new { type = "object", properties = new {} }),
    };

    /// <summary>Agent'ın izinli tool'larını filtrele.</summary>
    public static IReadOnlyList<ToolSpec> ForAgent(IEnumerable<string> allowedNames)
    {
        var allowed = new HashSet<string>(allowedNames, StringComparer.OrdinalIgnoreCase);
        return AllSpecs.Where(t => allowed.Contains(t.Name)).ToList();
    }

    /// <summary>
    ///   LLM tool_call'ını çalıştır. Hata durumunda string error mesaj döner —
    ///   LLM bunu sonraki turn'de görüp düzeltebilir.
    /// </summary>
    public static async Task<string> ExecuteAsync(
        string toolName, JsonElement argsJson, AltarisDbContext db, Guid tenantId, CancellationToken ct)
    {
        return toolName switch
        {
            "calc"             => Calc(argsJson),
            "now"              => Now(),
            "chart_spec"       => ChartSpec(argsJson),
            "structured_query" => await StructuredQuery(argsJson, db, tenantId, ct),
            _                  => JsonSerializer.Serialize(new { error = $"unknown_tool:{toolName}" }),
        };
    }

    // ─── Implementations ─────────────────────────────────────────────────

    private static string Calc(JsonElement args)
    {
        if (!args.TryGetProperty("expression", out var expr) || expr.ValueKind != JsonValueKind.String)
            return JsonSerializer.Serialize(new { error = "expression_required" });

        var s = expr.GetString() ?? "";
        // Güvenlik: yalnız sayı + operatör + parantez + boşluk + nokta + virgül
        // (TR sayı formatı: 1.234,56 — bunları normalize ediyoruz)
        s = s.Replace(".", "").Replace(",", ".");
        if (!System.Text.RegularExpressions.Regex.IsMatch(s, @"^[\d\s+\-*/().% ]+$"))
            return JsonSerializer.Serialize(new { error = "invalid_chars", note = "Sadece sayı + (+-*/%) + parantez izinli" });
        try
        {
            var dt = new System.Data.DataTable();
            // % işlemini "/100" olarak destekle
            s = System.Text.RegularExpressions.Regex.Replace(s, @"(\d+(\.\d+)?)\s*%", "($1/100)");
            var raw = dt.Compute(s, "")?.ToString();
            if (raw is null) return JsonSerializer.Serialize(new { error = "compute_null" });
            if (!double.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture, out var val))
                return JsonSerializer.Serialize(new { error = "non_numeric_result", raw });
            return JsonSerializer.Serialize(new { result = val, formatted = val.ToString("N2", new System.Globalization.CultureInfo("tr-TR")) });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { error = "compute_failed", message = ex.Message });
        }
    }

    private static string Now()
    {
        var trNow = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Europe/Istanbul");
        return JsonSerializer.Serialize(new
        {
            iso = trNow.ToString("yyyy-MM-ddTHH:mm:sszzz"),
            tr  = trNow.ToString("dd.MM.yyyy HH:mm", new System.Globalization.CultureInfo("tr-TR")),
            tz  = "Europe/Istanbul"
        });
    }

    private static string ChartSpec(JsonElement args)
    {
        var chartType = args.TryGetProperty("chartType", out var c) ? c.GetString() ?? "bar" : "bar";
        var title = args.TryGetProperty("title", out var t) ? t.GetString() : null;
        var xLabel = args.TryGetProperty("xLabel", out var x) ? x.GetString() : "Kategori";
        var yLabel = args.TryGetProperty("yLabel", out var y) ? y.GetString() : "Değer";
        if (!args.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            return JsonSerializer.Serialize(new { error = "data_required" });

        // Vega-Lite minimal spec — UI bunu chart olarak render eder.
        var mark = chartType switch { "line" => "line", "pie" => "arc", _ => "bar" };
        var encoding = chartType == "pie"
            ? new {
                theta = new { field = "value", type = "quantitative" },
                color = new { field = "label", type = "nominal" }
              }
            : (object)new {
                x = new { field = "label", type = "nominal", title = xLabel },
                y = new { field = "value", type = "quantitative", title = yLabel }
              };

        return JsonSerializer.Serialize(new
        {
            chart_spec = new
            {
                schema = "https://vega.github.io/schema/vega-lite/v5.json",
                title,
                data = new { values = data },
                mark,
                encoding,
            }
        });
    }

    private static async Task<string> StructuredQuery(JsonElement args, AltarisDbContext db, Guid tenantId, CancellationToken ct)
    {
        if (!args.TryGetProperty("keyword", out var kwEl) || kwEl.ValueKind != JsonValueKind.String)
            return JsonSerializer.Serialize(new { error = "keyword_required" });
        var keyword = kwEl.GetString() ?? "";
        var limit = args.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number
            ? Math.Clamp(l.GetInt32(), 1, 50) : 10;

        var q = db.VaultFiles.AsNoTracking()
            .Where(f => f.TenantId == tenantId)
            .Where(f => EF.Functions.ILike(f.Content, $"%{keyword}%"));
        if (args.TryGetProperty("vaultSlug", out var vs) && vs.ValueKind == JsonValueKind.String)
        {
            var vaultSlug = vs.GetString();
            if (!string.IsNullOrEmpty(vaultSlug))
            {
                var vid = await db.Vaults.AsNoTracking()
                    .Where(v => v.TenantId == tenantId && v.Slug == vaultSlug)
                    .Select(v => v.Id).FirstOrDefaultAsync(ct);
                if (vid != Guid.Empty) q = q.Where(f => f.VaultId == vid);
            }
        }
        var rows = await q.Take(limit)
            .Select(f => new {
                vaultId = f.VaultId,
                path = f.Path,
                bytes = f.Bytes,
                snippet = f.Content.Length > 300 ? f.Content.Substring(0, 300) : f.Content,
            })
            .ToListAsync(ct);
        return JsonSerializer.Serialize(new { count = rows.Count, results = rows });
    }
}
