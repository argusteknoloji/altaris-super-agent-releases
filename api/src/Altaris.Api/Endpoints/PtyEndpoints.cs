using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Altaris.Infrastructure.MultiTenancy;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /ws/pty — bidirectional WebSocket bridge to a child shell process.
///   Note: this is a basic pipe (not a true PTY) — ANSI cursor sequences and
///   interactive TUI apps may misbehave. Production deployment should swap in
///   a proper PTY backend (Microsoft.Terminal.Wpf / pty.net / docker exec -it).
/// </summary>
public static class PtyEndpoints
{
    public static IEndpointRouteBuilder MapPtyEndpoints(this IEndpointRouteBuilder app)
    {
        app.Map("/ws/pty", HandlePty).RequireAuthorization();
        return app;
    }

    private static async Task HandlePty(HttpContext ctx, ITenantContext tenant)
    {
        if (!ctx.WebSockets.IsWebSocketRequest)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }
        if (tenant.TenantId is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        using var ws = await ctx.WebSockets.AcceptWebSocketAsync();

        var shell = OperatingSystem.IsWindows() ? "cmd.exe" : "/bin/bash";
        var args = OperatingSystem.IsWindows() ? "" : "--login -i";

        var psi = new ProcessStartInfo
        {
            FileName = shell,
            Arguments = args,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Environment.GetEnvironmentVariable("HOME") ?? "/tmp"
        };
        psi.Environment["TERM"] = "xterm-256color";
        psi.Environment["ALTARIS_REMOTE"] = "1";

        using var proc = Process.Start(psi);
        if (proc is null)
        {
            await SendAsync(ws, JsonSerializer.Serialize(new { type = "error", message = "Failed to spawn shell" }), CancellationToken.None);
            return;
        }

        await SendAsync(ws, JsonSerializer.Serialize(new { type = "ready", pid = proc.Id, shell }), ctx.RequestAborted);

        // Pump shell stdout → ws
        var stdoutTask = PumpStreamToWs(proc.StandardOutput, ws, "out", ctx.RequestAborted);
        var stderrTask = PumpStreamToWs(proc.StandardError, ws, "err", ctx.RequestAborted);

        // Pump ws → shell stdin
        var buf = new byte[8192];
        try
        {
            while (ws.State == WebSocketState.Open && !proc.HasExited)
            {
                var result = await ws.ReceiveAsync(buf, ctx.RequestAborted);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var input = Encoding.UTF8.GetString(buf, 0, result.Count);
                await proc.StandardInput.WriteAsync(input);
                await proc.StandardInput.FlushAsync();
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
        finally
        {
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            await Task.WhenAny(Task.WhenAll(stdoutTask, stderrTask), Task.Delay(500));
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "shell exited", CancellationToken.None);
        }
    }

    private static async Task PumpStreamToWs(StreamReader src, WebSocket ws, string type, CancellationToken ct)
    {
        var buf = new char[4096];
        try
        {
            while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
            {
                var n = await src.ReadAsync(buf, ct);
                if (n == 0) break;
                var text = new string(buf, 0, n);
                await SendAsync(ws, JsonSerializer.Serialize(new { type, data = text }), ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
    }

    private static async Task SendAsync(WebSocket ws, string json, CancellationToken ct)
    {
        if (ws.State != WebSocketState.Open) return;
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }
}
