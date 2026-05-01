using StackExchange.Redis;

namespace Altaris.Infrastructure.Presence;

/// <summary>
///   Redis-backed presence: which sessions are live right now.
///   Keys:
///     presence:tenant:{slug}:sessions = SET of active session IDs (TTL 60s, refreshed on heartbeat)
///     presence:session:{id} = HASH { tenantSlug, userId, source, startedAt } (TTL 60s)
/// </summary>
public class PresenceTracker
{
    private readonly IConnectionMultiplexer _redis;
    public PresenceTracker(IConnectionMultiplexer redis) => _redis = redis;

    private IDatabase Db => _redis.GetDatabase();
    private static TimeSpan Ttl => TimeSpan.FromSeconds(60);

    public async Task TouchAsync(string tenantSlug, Guid sessionId, Guid userId, string source)
    {
        var skey = $"presence:tenant:{tenantSlug}:sessions";
        var hkey = $"presence:session:{sessionId}";
        var batch = Db.CreateBatch();
        var t1 = batch.SetAddAsync(skey, sessionId.ToString());
        var t2 = batch.KeyExpireAsync(skey, Ttl);
        var t3 = batch.HashSetAsync(hkey, new HashEntry[]
        {
            new("tenantSlug", tenantSlug),
            new("userId", userId.ToString()),
            new("source", source),
            new("lastSeen", DateTimeOffset.UtcNow.ToUnixTimeSeconds())
        });
        var t4 = batch.KeyExpireAsync(hkey, Ttl);
        batch.Execute();
        await Task.WhenAll(t1, t2, t3, t4);
    }

    public async Task DropAsync(string tenantSlug, Guid sessionId)
    {
        await Db.SetRemoveAsync($"presence:tenant:{tenantSlug}:sessions", sessionId.ToString());
        await Db.KeyDeleteAsync($"presence:session:{sessionId}");
    }

    public async Task<List<Guid>> ActiveSessionsAsync(string tenantSlug)
    {
        var members = await Db.SetMembersAsync($"presence:tenant:{tenantSlug}:sessions");
        var ids = new List<Guid>();
        foreach (var m in members)
            if (Guid.TryParse(m.ToString(), out var g)) ids.Add(g);
        return ids;
    }

    public async Task<bool> IsActiveAsync(Guid sessionId)
    {
        return await Db.KeyExistsAsync($"presence:session:{sessionId}");
    }
}
