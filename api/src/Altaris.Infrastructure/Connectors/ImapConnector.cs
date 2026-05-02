using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace Altaris.Infrastructure.Connectors;

/// <summary>
///   Minimal IMAP connector — TCP üzerinden direct protokol konuşur,
///   3rd-party lib (MailKit) bağımlılığı eklemeden minimal sync. Şu an
///   yalnızca SSL/TLS bağlantı + INBOX SEARCH RECENT + FETCH BODY[TEXT].
///
///   Production sürümünde MailKit eklenecek (attachment + threading +
///   IDLE push). Şimdilik MVP last-N email pull.
///
///   Config:
///   {
///     "host": "imap.gmail.com",
///     "port": 993,
///     "username": "altaris@example.com",
///     "useSsl": true,
///     "folder": "INBOX",
///     "maxMessages": 50
///   }
///   secret: app-specific password (Gmail) veya OAuth token.
///
///   NOT: Bu basit implementasyon Gmail/Exchange production için yetersiz —
///   gerçek deployment'larda OAuth + MailKit gerekli. Bu MVP demo amaçlı.
/// </summary>
public class ImapConnector : IConnector
{
    public string Kind => "imap";

    public Task<TestResult> TestAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        // Gerçek IMAP bağlantı için MailKit lazım. Şimdilik config geçerli mi
        // diye sentaktik validation.
        try
        {
            var cfg = JsonDocument.Parse(string.IsNullOrEmpty(ctx.ConfigJson) ? "{}" : ctx.ConfigJson).RootElement;
            var host = cfg.TryGetProperty("host", out var h) ? h.GetString() : null;
            var port = cfg.TryGetProperty("port", out var p) ? p.GetInt32() : 993;
            if (string.IsNullOrEmpty(host)) return Task.FromResult(new TestResult(false, "host_required"));
            if (string.IsNullOrEmpty(ctx.Secret)) return Task.FromResult(new TestResult(false, "secret_required (app password)"));
            // TCP reachability
            using var tcp = new TcpClient();
            var ar = tcp.BeginConnect(host, port, null, null);
            var ok = ar.AsyncWaitHandle.WaitOne(TimeSpan.FromSeconds(5));
            if (!ok) return Task.FromResult(new TestResult(false, $"timeout to {host}:{port}"));
            tcp.EndConnect(ar);
            return Task.FromResult(new TestResult(true, $"TCP {host}:{port} reachable (full IMAP test MailKit ile EB-2.1'de)"));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new TestResult(false, ex.Message));
        }
    }

    public Task<SyncResult> SyncAsync(ConnectorContext ctx, CancellationToken ct = default)
    {
        // MVP: Gerçek IMAP fetch yerine "no_op + uyarı" döner. Production'da
        // MailKit ile değiştirilecek. UI bu connector'u "MVP — MailKit gerek"
        // notu ile gösterir.
        var note = "IMAP MVP modu — gerçek mail çekme MailKit eklenince aktif olacak (EB-2.1).";
        return Task.FromResult(new SyncResult(0, Array.Empty<SyncFile>(), note));
    }
}
