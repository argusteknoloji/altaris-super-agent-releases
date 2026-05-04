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
    ///   <paramref name="ptyMgr"/> + <paramref name="liveSessionId"/> verilirse
    ///   process spawn edilir edilmez PtySessionManager'a register edilir, stdout
    ///   chunk'ları paralel olarak broadcast edilir → frontend xterm.js viewer canlı izler.
    /// </summary>
    public static async Task<RunResult> RunAsync(
        string vaultPath,
        string altarisHome,
        string prompt,
        ProviderConfig provider,
        string llmModel,
        TimeSpan timeout,
        CancellationToken ct,
        Altaris.Infrastructure.Pty.PtySessionManager? ptyMgr = null,
        Guid? liveSessionId = null,
        Guid? liveTenantId = null,
        Guid? liveUserId = null)
    {
        if (!Directory.Exists(vaultPath))
            return new RunResult(false, "", $"vault path bulunamadı: {vaultPath}", "", 0);

        var sw = Stopwatch.StartNew();
        var psi = new ProcessStartInfo
        {
            FileName = "altaris",
            WorkingDirectory = vaultPath,
            // RedirectStandardInput=false → CLI stdin'i parent'tan inherit eder
            // (container'da /dev/null). Yoksa CLI 3sn 'no stdin data received'
            // warning yazıp ilerliyor → log gürültüsü.
            RedirectStandardInput = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("-p");
        psi.ArgumentList.Add(prompt);
        // stream-json: her olay (system/assistant/tool_use/tool_result/result)
        // satır satır anında stdout'a → live PTY preview canlı çalışıyor görüntü
        // verir + final 'result' event'inden cevabı parse ediyoruz.
        psi.ArgumentList.Add("--output-format=stream-json");
        psi.ArgumentList.Add("--include-partial-messages");
        psi.ArgumentList.Add("--verbose");   // stream-json + --print combo'su zorunlu
        // CLI bayrağı: stream-json input format opsiyonel — biz tek prompt'ta
        // çalıştırdığımız için --input-format text default, ekleme yapmıyoruz.
        // Server-side subprocess: kullanıcı interaktif onay veremez. Tüm tool
        // çağrılarına otomatik onay (Bash/Edit/Write/Grep/...). Sandbox: vault
        // cwd zaten izolasyon sağlıyor, /srv/altaris/.altaris read-only mount.
        psi.ArgumentList.Add("--dangerously-skip-permissions");
        // Model'i flag olarak da geç — env var (ANTHROPIC_MODEL/OPENAI_MODEL)
        // OAuth path'inde dikkate alınmayabiliyor, --model authoritative.
        if (!string.IsNullOrEmpty(llmModel))
        {
            psi.ArgumentList.Add("--model");
            psi.ArgumentList.Add(llmModel);
        }

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
            Altaris.Infrastructure.Pty.PtySession? ptySession = null;
            // Stdout: collect for JSON parse + (eğer pty subscribers varsa) broadcast et
            proc.OutputDataReceived += (_, e) =>
            {
                if (e.Data is null) return;
                stdoutSb.AppendLine(e.Data);
                if (ptySession is not null)
                {
                    // Fire-and-forget — ws subscribers yoksa sessizce no-op
                    _ = ptySession.BroadcastAsync("out", e.Data + "\r\n", CancellationToken.None);
                }
            };
            proc.ErrorDataReceived += (_, e) =>
            {
                if (e.Data is null) return;
                stderrSb.AppendLine(e.Data);
                if (ptySession is not null)
                {
                    _ = ptySession.BroadcastAsync("out", "[31m" + e.Data + "[0m\r\n", CancellationToken.None);
                }
            };

            try
            {
                proc.Start();
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();

                // PTY register — process spawn olduktan sonra. Manager Process referansı tutar.
                if (ptyMgr is not null && liveSessionId.HasValue && liveTenantId.HasValue && liveUserId.HasValue)
                {
                    try { ptySession = ptyMgr.Open(liveSessionId.Value, liveTenantId.Value, liveUserId.Value, proc); }
                    catch { /* register fail — broadcast olmaz, job devam eder */ }
                }

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
                // stream-json: her satır bir event JSON. Final cevap için
                // sondan başa doğru tara, type=='result' eventini bul.
                var lines = raw.Split('\n');
                string? resultText = null;
                bool isError = false;
                for (var i = lines.Length - 1; i >= 0; i--)
                {
                    var line = lines[i].Trim();
                    if (!line.StartsWith("{")) continue;
                    try
                    {
                        using var doc = JsonDocument.Parse(line);
                        var root = doc.RootElement;
                        if (!root.TryGetProperty("type", out var tEl)) continue;
                        var t = tEl.GetString();
                        if (t == "result")
                        {
                            isError = root.TryGetProperty("is_error", out var ie) && ie.GetBoolean();
                            resultText = root.TryGetProperty("result", out var r) ? (r.GetString() ?? "") : "";
                            break;
                        }
                    }
                    catch (JsonException) { /* skip malformed */ }
                }
                if (resultText is null)
                    return new RunResult(false, "", $"CLI sonuç event'i bulunamadı (exit={proc.ExitCode})", raw, sw.ElapsedMilliseconds);
                if (isError)
                    return new RunResult(false, "", resultText, raw, sw.ElapsedMilliseconds);
                return new RunResult(true, resultText, null, raw, sw.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                return new RunResult(false, "", $"Stream parse fail: {ex.Message}", raw, sw.ElapsedMilliseconds);
            }
        }
        finally
        {
            try { Directory.Delete(sessionHome, recursive: true); } catch { /* best effort */ }
            // PTY session'ı registry'den çıkar (subscriber ws connection'ları kapanır)
            if (ptyMgr is not null && liveSessionId.HasValue) ptyMgr.Remove(liveSessionId.Value);
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
                if (p.AuthKind == "oauth")
                {
                    env["ALTARIS_OAUTH_TOKEN"] = key;
                }
                else
                {
                    env["ANTHROPIC_API_KEY"] = key;
                }
                if (!string.IsNullOrEmpty(model))
                {
                    env["ANTHROPIC_MODEL"] = model;
                    // CLI'nin alias resolver'ı (sonnet/opus/haiku → real model)
                    // hangi alias'i seçerse seçsin user'ın seçtiği modele düşsün:
                    // 3 default env'i de aynı modele set ediyoruz. Aksi halde agent
                    // 'sonnet' alias'ı kullanırsa "selected model (sonnet)" hatası.
                    env["ANTHROPIC_DEFAULT_OPUS_MODEL"]   = model;
                    env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = model;
                    env["ANTHROPIC_DEFAULT_HAIKU_MODEL"]  = model;
                }
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
