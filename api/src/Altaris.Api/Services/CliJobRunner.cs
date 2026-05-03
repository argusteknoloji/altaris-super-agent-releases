using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Altaris.Domain.Entities;

namespace Altaris.Api.Services;

/// <summary>
///   Executive Brain job çalıştırma artık `altaris -p "<prompt>" --output-format=json`
///   subprocess'i ile yapılıyor. CLI'nin tam yetenekleri (MCP'ler, plugin'ler,
///   skill'ler, subagent spawn, web fetch, vb.) job execution context'inde
///   kullanılabilir hale geldi.
///
///   Mimarı:
///     - Vault path: /srv/altaris/vaults/{tenantSlug}/{vaultSlug} (cwd)
///     - ALTARIS_HOME: /srv/altaris/.altaris (global config + plugins + skills)
///     - Provider env: ALTARIS_USE_OPENAI / ANTHROPIC_API_KEY (provider'a göre)
///     - Output: JSON line "result" field → answer; "permission_denials" → citations stub
///
///   Backend Worker artık ince bir orchestrator — gerçek iş CLI'da.
/// </summary>
public static class CliJobRunner
{
    public record RunResult(bool Success, string Answer, string? Error, string RawJson, long DurationMs);

    /// <summary>
    ///   CLI'yi vault context'inde subprocess olarak çağırır, JSON çıktıyı parse eder.
    /// </summary>
    public static async Task<RunResult> RunAsync(
        string vaultPath,
        string altarisHome,
        string prompt,
        ProviderConfig provider,
        string llmModel,
        TimeSpan timeout,
        CancellationToken ct)
    {
        if (!Directory.Exists(vaultPath))
            return new RunResult(false, "", $"vault path bulunamadı: {vaultPath}", "", 0);

        var sw = Stopwatch.StartNew();
        var psi = new ProcessStartInfo
        {
            FileName = "altaris",
            WorkingDirectory = vaultPath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("-p");
        psi.ArgumentList.Add(prompt);
        psi.ArgumentList.Add("--output-format=json");

        // HOME'u her invocation için izole bir tmp dizine yönlendir — provider
        // OAuth dosyalarını (codex auth.json, vb.) güvenli yazıp okusun. /srv/altaris
        // bind mount paths sadece okuma için (security). ALTARIS_HOME ayrı.
        var sessionHome = Path.Combine(Path.GetTempPath(), $"altaris-cli-{Guid.NewGuid():N}");
        Directory.CreateDirectory(sessionHome);
        psi.EnvironmentVariables["HOME"] = sessionHome;
        ApplyProviderEnv(psi.EnvironmentVariables, provider, llmModel);

        // CLI bazen $HOME/.altaris.json (legacy claude config) bekliyor. Sunucuda
        // /srv/altaris/.altaris.json'da bağlı, oradan kopyala. Yoksa sessizce geç.
        try
        {
            var srcAltaris = Path.Combine(altarisHome.TrimEnd('/').EndsWith("/.altaris")
                ? altarisHome[..^9] : altarisHome, ".altaris.json");
            if (File.Exists(srcAltaris))
                File.Copy(srcAltaris, Path.Combine(sessionHome, ".altaris.json"), overwrite: true);
        }
        catch { /* ignore */ }

        // Codex OAuth: CLI'nin codex code path'i ~/.codex/auth.json bekliyor.
        // DB'deki refresh + access tokenlardan dosyayı subprocess başlamadan
        // önce session HOME altına yaz.
        if (provider.Provider.Equals("codex", StringComparison.OrdinalIgnoreCase)
            && provider.AuthKind == "oauth"
            && !string.IsNullOrEmpty(provider.RefreshTokenEnc))
        {
            try
            {
                var codexDir = Path.Combine(sessionHome, ".codex");
                Directory.CreateDirectory(codexDir);
                var authPath = Path.Combine(codexDir, "auth.json");
                var auth = new
                {
                    OPENAI_API_KEY = (string?)null,
                    tokens = new
                    {
                        id_token = provider.IdTokenEnc ?? "",
                        access_token = provider.ApiKeyEnc ?? "",
                        refresh_token = provider.RefreshTokenEnc,
                        account_id = provider.AccountId ?? ""
                    },
                    last_refresh = (provider.LastRefreshedAt ?? DateTimeOffset.UtcNow).ToString("O")
                };
                await File.WriteAllTextAsync(authPath, JsonSerializer.Serialize(auth), ct);
            }
            catch { /* sessizce devam — CLI auth.json yoksa kendi hata mesajını döner */ }
        }

        try
        {
            using var proc = new Process { StartInfo = psi };
            var stdoutSb = new StringBuilder();
            var stderrSb = new StringBuilder();
            proc.OutputDataReceived += (_, e) => { if (e.Data is not null) stdoutSb.AppendLine(e.Data); };
            proc.ErrorDataReceived  += (_, e) => { if (e.Data is not null) stderrSb.AppendLine(e.Data); };

            try
            {
                proc.Start();
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();

                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeoutCts.CancelAfter(timeout);
                try { await proc.WaitForExitAsync(timeoutCts.Token); }
                catch (OperationCanceledException)
                {
                    try { proc.Kill(entireProcessTree: true); } catch { /* ignore */ }
                    return new RunResult(false, "", $"timeout ({timeout.TotalSeconds}sn)",
                        stdoutSb.ToString(), sw.ElapsedMilliseconds);
                }
            }
            catch (Exception ex)
            {
                return new RunResult(false, "", $"subprocess başlatılamadı: {ex.Message}", "", sw.ElapsedMilliseconds);
            }

            sw.Stop();
            var raw = stdoutSb.ToString().Trim();
            if (string.IsNullOrEmpty(raw))
                return new RunResult(false, "", $"CLI boş çıktı (exit={proc.ExitCode}, stderr={stderrSb})", "", sw.ElapsedMilliseconds);

            try
            {
                // CLI son satırı tam JSON. Multi-line varsa son non-empty parse.
                var lastLine = raw.Split('\n').Reverse()
                    .FirstOrDefault(l => l.TrimStart().StartsWith("{"));
                using var doc = JsonDocument.Parse(lastLine ?? raw);
                var root = doc.RootElement;
                var isError = root.TryGetProperty("is_error", out var ie) && ie.GetBoolean();
                var result  = root.TryGetProperty("result", out var r) ? (r.GetString() ?? "") : "";

                if (isError)
                    return new RunResult(false, "", result, raw, sw.ElapsedMilliseconds);
                return new RunResult(true, result, null, raw, sw.ElapsedMilliseconds);
            }
            catch (JsonException ex)
            {
                return new RunResult(false, "", $"JSON parse fail: {ex.Message}", raw, sw.ElapsedMilliseconds);
            }
        }
        finally
        {
            try { Directory.Delete(sessionHome, recursive: true); } catch { /* best effort */ }
        }
    }

    /// <summary>
    ///   Provider config'ten CLI bootstrap'ın beklediği env var'ları üret.
    ///   CLI argus/bootstrap.ts'te bu env'lere göre OpenAI / Anthropic / Codex provider'ı kurar.
    /// </summary>
    private static void ApplyProviderEnv(
        System.Collections.Specialized.StringDictionary env,
        ProviderConfig p, string model)
    {
        var key = p.ApiKeyEnc ?? "";
        switch (p.Provider.ToLowerInvariant())
        {
            case "anthropic":
                env["ANTHROPIC_API_KEY"] = key;
                if (!string.IsNullOrEmpty(model)) env["ANTHROPIC_MODEL"] = model;
                break;
            case "codex":
                env["ALTARIS_USE_OPENAI"] = "1";
                env["OPENAI_BASE_URL"] = p.BaseUrl ?? "https://chatgpt.com/backend-api/codex";
                env["OPENAI_API_KEY"] = key;
                env["OPENAI_MODEL"] = model;
                if (!string.IsNullOrEmpty(p.AccountId)) env["OPENAI_ACCOUNT_ID"] = p.AccountId;
                break;
            case "openai":
            case "lmstudio":
            default:
                env["ALTARIS_USE_OPENAI"] = "1";
                env["OPENAI_BASE_URL"] = p.BaseUrl ?? "https://api.openai.com/v1";
                env["OPENAI_API_KEY"] = key;
                env["OPENAI_MODEL"] = model;
                break;
        }
    }
}
