using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;

namespace Altaris.Infrastructure.Vaults;

/// <summary>
///   Vault dosya değişikliklerini in-memory pub/sub ile yayınlar. Yazıcı tarafı
///   (PUT/DELETE endpoint'leri) <see cref="Broadcast"/> çağırır; SSE endpoint'i
///   <see cref="Subscribe"/> ile event stream'i açar.
///
///   ÖNEMLİ: In-memory broker — multi-instance API deploy'unda her instance
///   sadece kendi yazıcılarının event'lerini yayınlar. Tek-pod ortam (mevcut
///   docker-compose) için yeterli; horizontal scale gerekirse Redis pub/sub
///   adaptörü eklenmeli (interface aynı kalır).
/// </summary>
public interface IVaultEventBroker
{
    void Broadcast(Guid tenantId, string vaultSlug, VaultFileEvent ev);
    IAsyncEnumerable<VaultFileEvent> Subscribe(Guid tenantId, string vaultSlug, CancellationToken ct);
}

/// <summary>
///   Event payload — tenant + vault zaten subscription key'inde olduğu için
///   payload'da tekrarlanmaz. <c>Type</c>: "created" | "updated" | "deleted".
/// </summary>
public record VaultFileEvent(string Type, string Path, string? Sha256, DateTimeOffset At, Guid? ActorUserId);

public sealed class VaultEventBroker : IVaultEventBroker
{
    private readonly ConcurrentDictionary<(Guid tenantId, string slug), List<Channel<VaultFileEvent>>> _subs = new();

    public void Broadcast(Guid tenantId, string vaultSlug, VaultFileEvent ev)
    {
        var key = (tenantId, vaultSlug);
        if (!_subs.TryGetValue(key, out var list)) return;

        // Snapshot under lock; write outside (TryWrite is non-blocking on unbounded).
        Channel<VaultFileEvent>[] snapshot;
        lock (list)
        {
            if (list.Count == 0) return;
            snapshot = list.ToArray();
        }

        List<Channel<VaultFileEvent>>? dead = null;
        foreach (var ch in snapshot)
        {
            if (!ch.Writer.TryWrite(ev))
            {
                (dead ??= new()).Add(ch);
            }
        }
        if (dead is not null)
        {
            lock (list) { foreach (var d in dead) list.Remove(d); }
        }
    }

    public async IAsyncEnumerable<VaultFileEvent> Subscribe(
        Guid tenantId, string vaultSlug, [EnumeratorCancellation] CancellationToken ct)
    {
        var key = (tenantId, vaultSlug);
        var ch = Channel.CreateUnbounded<VaultFileEvent>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

        var list = _subs.GetOrAdd(key, _ => new List<Channel<VaultFileEvent>>());
        lock (list) { list.Add(ch); }

        try
        {
            await foreach (var ev in ch.Reader.ReadAllAsync(ct))
            {
                yield return ev;
            }
        }
        finally
        {
            lock (list) { list.Remove(ch); }
            ch.Writer.TryComplete();
            // Liste boşaldıysa map'ten temizle (memory leak'i önle).
            if (_subs.TryGetValue(key, out var l))
            {
                lock (l)
                {
                    if (l.Count == 0) _subs.TryRemove(key, out _);
                }
            }
        }
    }
}

public static class VaultEventBrokerServiceCollectionExtensions
{
    public static IServiceCollection AddVaultEventBroker(this IServiceCollection services)
    {
        services.AddSingleton<IVaultEventBroker, VaultEventBroker>();
        return services;
    }
}
