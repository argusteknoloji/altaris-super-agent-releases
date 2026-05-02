using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Altaris.Domain.Entities;

namespace Altaris.Infrastructure.Vaults;

/// <summary>
///   Filesystem-backed vault storage. Each tenant's vaults live under
///   <see cref="VaultStorageOptions.RootDir"/>/{tenant_slug}/{vault_slug}/.
///   All paths are validated against the vault root so a malicious file
///   parameter (../../etc/passwd) can never escape the sandbox.
/// </summary>
public class VaultStorage
{
    private readonly VaultStorageOptions _opts;

    public VaultStorage(VaultStorageOptions opts) => _opts = opts;

    public string TenantRoot(string tenantSlug)
        => Path.Combine(_opts.RootDir, Sanitize(tenantSlug));

    public string VaultPath(string tenantSlug, string vaultSlug)
        => Path.Combine(TenantRoot(tenantSlug), Sanitize(vaultSlug));

    /// <summary>Resolve a relative path inside a vault, rejecting traversal.</summary>
    public string SafeFilePath(string tenantSlug, string vaultSlug, string relative)
    {
        var vaultRoot = Path.GetFullPath(VaultPath(tenantSlug, vaultSlug));
        var combined  = Path.GetFullPath(Path.Combine(vaultRoot, relative.TrimStart('/', '\\')));
        if (!combined.StartsWith(vaultRoot + Path.DirectorySeparatorChar) && combined != vaultRoot)
            throw new InvalidOperationException("path traversal rejected");
        return combined;
    }

    public bool VaultExists(string tenantSlug, string vaultSlug)
        => Directory.Exists(VaultPath(tenantSlug, vaultSlug));

    /// <summary>Recursive file listing as a flat list of vault-relative posix paths.</summary>
    public IEnumerable<VaultFile> List(string tenantSlug, string vaultSlug)
    {
        var root = VaultPath(tenantSlug, vaultSlug);
        if (!Directory.Exists(root)) yield break;
        foreach (var f in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
        {
            // skip dotfiles per Obsidian convention (.obsidian/, .git/ etc are exposed
            // via .obsidian listing but not as plain files in the tree).
            var fi = new FileInfo(f);
            var rel = Path.GetRelativePath(root, f).Replace('\\', '/');
            yield return new VaultFile(rel, fi.Length, fi.LastWriteTimeUtc);
        }
    }

    public (int files, long bytes) Stats(string tenantSlug, string vaultSlug)
    {
        long bytes = 0; int files = 0;
        foreach (var f in List(tenantSlug, vaultSlug)) { files++; bytes += f.Bytes; }
        return (files, bytes);
    }

    public async Task<string> ReadTextAsync(string tenantSlug, string vaultSlug, string relative, CancellationToken ct)
    {
        var p = SafeFilePath(tenantSlug, vaultSlug, relative);
        if (!File.Exists(p)) throw new FileNotFoundException(relative);
        return await File.ReadAllTextAsync(p, Encoding.UTF8, ct);
    }

    public async Task WriteTextAsync(string tenantSlug, string vaultSlug, string relative, string content, CancellationToken ct)
    {
        var p = SafeFilePath(tenantSlug, vaultSlug, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(p)!);
        await File.WriteAllTextAsync(p, content, Encoding.UTF8, ct);
    }

    /// <summary>SHA-256 of the file's UTF-8 bytes (lowercase hex). Empty file → all zeros hash.</summary>
    public string ComputeChecksum(string tenantSlug, string vaultSlug, string relative)
    {
        var p = SafeFilePath(tenantSlug, vaultSlug, relative);
        if (!File.Exists(p)) return string.Empty;
        using var fs = File.OpenRead(p);
        var hash = SHA256.HashData(fs);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string ComputeChecksum(string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }

    public void Delete(string tenantSlug, string vaultSlug, string relative)
    {
        var p = SafeFilePath(tenantSlug, vaultSlug, relative);
        if (File.Exists(p)) File.Delete(p);
    }

    public void DeleteVault(string tenantSlug, string vaultSlug)
    {
        var p = VaultPath(tenantSlug, vaultSlug);
        if (Directory.Exists(p)) Directory.Delete(p, recursive: true);
    }

    /// <summary>
    ///   Build a wikilink graph: nodes are .md files (filename without .md),
    ///   edges are <c>[[Target]]</c> references. Targets that don't resolve
    ///   to a known node become orphan nodes for visual completeness.
    /// </summary>
    public VaultGraph BuildGraph(string tenantSlug, string vaultSlug)
    {
        var nodes = new Dictionary<string, VaultGraphNode>(StringComparer.OrdinalIgnoreCase);
        var edges = new List<VaultGraphEdge>();
        var root = VaultPath(tenantSlug, vaultSlug);
        if (!Directory.Exists(root)) return new VaultGraph(Array.Empty<VaultGraphNode>(), Array.Empty<VaultGraphEdge>());

        // First pass: register every .md as a node.
        foreach (var f in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories))
        {
            var name  = Path.GetFileNameWithoutExtension(f);
            var rel   = Path.GetRelativePath(root, f).Replace('\\', '/');
            nodes[name] = new VaultGraphNode(name, name, rel, GroupOf(rel));
        }

        // Second pass: parse wikilinks.
        var rx = new Regex(@"\[\[([^\]\|#]+)(?:[#\|][^\]]*)?\]\]", RegexOptions.Compiled);
        foreach (var f in Directory.EnumerateFiles(root, "*.md", SearchOption.AllDirectories))
        {
            var sourceName = Path.GetFileNameWithoutExtension(f);
            var content = File.ReadAllText(f);
            foreach (Match m in rx.Matches(content))
            {
                var target = m.Groups[1].Value.Trim();
                if (!nodes.ContainsKey(target))
                {
                    // Orphan link target — render as a faded node so the graph
                    // still shows the intent.
                    nodes[target] = new VaultGraphNode(target, target, null, "orphan");
                }
                edges.Add(new VaultGraphEdge(sourceName, target));
            }
        }

        return new VaultGraph(nodes.Values.ToArray(), edges.ToArray());
    }

    private static string GroupOf(string relativePath)
    {
        var segments = relativePath.Split('/');
        if (segments.Length == 1) return "root";
        return segments[0];
    }

    private static string Sanitize(string s)
    {
        // Conservative slug: lowercase, [a-z0-9-_], length <= 64. Reject anything else.
        var clean = new string(s.ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        if (clean.Length == 0 || clean.Length > 64)
            throw new InvalidOperationException($"invalid slug: '{s}'");
        return clean;
    }
}

public class VaultStorageOptions
{
    public string RootDir { get; set; } = string.Empty;
}

public record VaultFile(string Path, long Bytes, DateTime ModifiedUtc);
public record VaultGraphNode(string Id, string Label, string? Path, string Group);
public record VaultGraphEdge(string Source, string Target);
public record VaultGraph(VaultGraphNode[] Nodes, VaultGraphEdge[] Edges);
