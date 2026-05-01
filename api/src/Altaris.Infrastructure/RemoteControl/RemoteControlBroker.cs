using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace Altaris.Infrastructure.RemoteControl;

/// <summary>
///   In-memory pub/sub for CLI-published agent sessions.
///   The CLI opens an outbound WebSocket to /ws/remote-control/publish — that
///   socket becomes the SESSION'S "master" channel. Web viewers attach via
///   /ws/remote-control/attach; the broker fans output to every viewer and
///   forwards keystrokes from the active "input owner" back to the CLI.
///
///   Message envelopes (over WS, all JSON):
///     publisher → broker:    { type: "out", data }     // shell stdout chunk
///                            { type: "ready", title }  // initial handshake
///     broker → publisher:    { type: "in",  data }     // viewer keystroke (only when owner)
///                            { type: "owner", userId } // input ownership transfer
///     broker → viewer:       { type: "out", data }     // mirrored stdout
///                            { type: "info", text }    // system line (joined/left/owner)
///     viewer → broker:       { type: "in",  data }     // attempted keystroke
///                            { type: "takeover" }      // request input ownership
/// </summary>
public class RemoteControlBroker
{
    private readonly ConcurrentDictionary<Guid, BrokeredSession> _sessions = new();

    public BrokeredSession Open(Guid sessionId, Guid tenantId, Guid publisherUserId,
                                string publisherEmail, WebSocket publisher, string? title)
    {
        var s = new BrokeredSession(sessionId, tenantId, publisherUserId, publisherEmail, publisher, title);
        _sessions[sessionId] = s;
        return s;
    }

    public BrokeredSession? Get(Guid sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    public IEnumerable<BrokeredSession> ForTenant(Guid tenantId) =>
        _sessions.Values.Where(s => s.TenantId == tenantId);

    public void Remove(Guid sessionId) => _sessions.TryRemove(sessionId, out _);
}

public class BrokeredSession
{
    public Guid Id { get; }
    public Guid TenantId { get; }
    public Guid PublisherUserId { get; }
    public string PublisherEmail { get; }
    public WebSocket Publisher { get; }
    public string? Title { get; }
    public DateTimeOffset OpenedAt { get; } = DateTimeOffset.UtcNow;

    private readonly ConcurrentDictionary<string, Viewer> _viewers = new();
    private Guid _inputOwner;
    private readonly object _lock = new();

    public BrokeredSession(Guid id, Guid tenantId, Guid publisherUserId,
                           string publisherEmail, WebSocket publisher, string? title)
    {
        Id = id; TenantId = tenantId; PublisherUserId = publisherUserId;
        PublisherEmail = publisherEmail; Publisher = publisher; Title = title;
        _inputOwner = publisherUserId;
    }

    public Guid InputOwnerUserId => _inputOwner;
    public IReadOnlyCollection<Viewer> Viewers => _viewers.Values.ToList();

    public Viewer Attach(WebSocket ws, Guid userId, string email, string mode)
    {
        var key = Guid.NewGuid().ToString("N");
        var v = new Viewer(key, ws, userId, email, mode);
        _viewers[key] = v;
        return v;
    }

    public void Detach(string key) => _viewers.TryRemove(key, out _);

    public bool RequestTakeover(Guid newOwner)
    {
        lock (_lock) { _inputOwner = newOwner; }
        return true;
    }

    public bool ReleaseTakeover()
    {
        lock (_lock) { _inputOwner = PublisherUserId; }
        return true;
    }

    /// <summary>Forward stdout/stderr from publisher to every viewer.</summary>
    public async Task BroadcastOutAsync(string data, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new { type = "out", data });
        var bytes = Encoding.UTF8.GetBytes(json);
        await SendToAllViewers(bytes, ct);
    }

    /// <summary>Send a small system-line notice to viewers (joined / left / owner).</summary>
    public async Task NotifyAsync(string text, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "info", text }));
        await SendToAllViewers(bytes, ct);
    }

    /// <summary>Push a keystroke to the publisher CLI (gated by InputOwnerUserId).</summary>
    public async Task ForwardInputAsync(string data, CancellationToken ct)
    {
        if (Publisher.State != WebSocketState.Open) return;
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "in", data }));
        try { await Publisher.SendAsync(bytes, WebSocketMessageType.Text, true, ct); }
        catch { }
    }

    /// <summary>Tell the publisher who owns input (so its UI can show a banner).</summary>
    public async Task PushOwnerAsync(Guid ownerUserId, string ownerEmail, CancellationToken ct)
    {
        if (Publisher.State != WebSocketState.Open) return;
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
            type = "owner", userId = ownerUserId, email = ownerEmail
        }));
        try { await Publisher.SendAsync(bytes, WebSocketMessageType.Text, true, ct); }
        catch { }
    }

    private async Task SendToAllViewers(byte[] bytes, CancellationToken ct)
    {
        var dead = new List<string>();
        foreach (var v in _viewers.Values)
        {
            try
            {
                if (v.Ws.State == WebSocketState.Open)
                    await v.Ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
                else dead.Add(v.Key);
            }
            catch { dead.Add(v.Key); }
        }
        foreach (var k in dead) _viewers.TryRemove(k, out _);
    }
}

public record Viewer(string Key, WebSocket Ws, Guid UserId, string Email, string Mode);
