using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace Altaris.Infrastructure.Pty;

/// <summary>
///   In-memory registry of live PTY sessions. Each session has one master
///   (the original creator) and zero or more watchers (admins observing live
///   or end users in another tab). Master input goes to the shell stdin;
///   watchers receive a read-only mirror of stdout/stderr unless takeover
///   is granted, in which case input ownership transfers.
/// </summary>
public class PtySessionManager
{
    private readonly ConcurrentDictionary<Guid, PtySession> _sessions = new();

    public PtySession Open(Guid sessionId, Guid tenantId, Guid ownerUserId, Process proc)
    {
        var s = new PtySession(sessionId, tenantId, ownerUserId, proc);
        _sessions[sessionId] = s;
        return s;
    }

    public PtySession? Get(Guid sessionId) => _sessions.TryGetValue(sessionId, out var s) ? s : null;

    public IEnumerable<PtySession> Active => _sessions.Values;

    public void Remove(Guid sessionId) => _sessions.TryRemove(sessionId, out _);
}

public class PtySession
{
    public Guid Id { get; }
    public Guid TenantId { get; }
    public Guid OwnerUserId { get; }
    public Process Process { get; }
    public Guid InputOwnerUserId { get; private set; }
    public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;

    private readonly ConcurrentDictionary<string, Subscriber> _subs = new();
    private readonly object _writerLock = new();

    public PtySession(Guid id, Guid tenantId, Guid ownerUserId, Process proc)
    {
        Id = id; TenantId = tenantId; OwnerUserId = ownerUserId;
        Process = proc; InputOwnerUserId = ownerUserId;
    }

    public IReadOnlyCollection<Subscriber> Subscribers => _subs.Values.ToList();

    public Subscriber Attach(WebSocket ws, Guid userId, string mode)
    {
        var key = Guid.NewGuid().ToString("N");
        var sub = new Subscriber(key, ws, userId, mode);
        _subs[key] = sub;
        return sub;
    }

    public void Detach(string key) => _subs.TryRemove(key, out _);

    public bool RequestTakeover(Guid newOwnerUserId)
    {
        // Always granted in MVP — admin can always take over.
        // Production: check role / consent of current input owner.
        InputOwnerUserId = newOwnerUserId;
        return true;
    }

    /// <summary>Broadcast a chunk of shell output to every subscriber.</summary>
    public async Task BroadcastAsync(string kind, string text, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new { type = kind, data = text });
        var bytes = Encoding.UTF8.GetBytes(json);
        var snapshot = _subs.Values.ToList();
        var dead = new List<string>();
        foreach (var s in snapshot)
        {
            try
            {
                if (s.Ws.State == WebSocketState.Open)
                    await s.Ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
                else dead.Add(s.Key);
            }
            catch { dead.Add(s.Key); }
        }
        foreach (var k in dead) _subs.TryRemove(k, out _);
    }

    public async Task NotifyEvent(string evt, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new { type = evt, payload });
        var bytes = Encoding.UTF8.GetBytes(json);
        foreach (var s in _subs.Values)
        {
            try { if (s.Ws.State == WebSocketState.Open) await s.Ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct); }
            catch { }
        }
    }

    public void WriteToShell(string input)
    {
        lock (_writerLock)
        {
            try { Process.StandardInput.Write(input); Process.StandardInput.Flush(); }
            catch { }
        }
    }
}

public record Subscriber(string Key, WebSocket Ws, Guid UserId, string Mode);
