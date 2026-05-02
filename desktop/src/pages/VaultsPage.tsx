import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Editor from "@monaco-editor/react";

type Vault = {
  id: string; slug: string; name: string;
  visibility: "private" | "tenant" | "executive";
  fileCount: number; byteSize: number;
  owner: { email: string };
};
type TreeEntry = { path: string; bytes: number; modifiedUtc: string };

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const VIS_COLOR: Record<string, string> = {
  private:   "bg-neutral-700 text-neutral-200",
  tenant:    "bg-sky-600/30 text-sky-300",
  executive: "bg-purple-600/30 text-purple-300",
};

export default function VaultsPage() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [active, setActive] = useState<Vault | null>(null);
  const [tree, setTree]     = useState<TreeEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [openPath, setOpenPath]   = useState<string | null>(null);
  const [content, setContent]     = useState("");
  const [savedContent, setSaved]  = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ slug: "", name: "" });

  async function loadVaults() {
    try {
      const list = await invoke<Vault[]>("api_get", { path: "/api/v1/vaults" });
      setVaults(list);
      if (active && !list.find(v => v.slug === active.slug)) {
        setActive(null); setTree([]); setOpenPath(null);
      }
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { loadVaults(); }, []);

  async function openVault(v: Vault) {
    setActive(v); setOpenPath(null); setContent(""); setSaved("");
    try {
      const t = await invoke<TreeEntry[]>("api_get", { path: `/api/v1/vaults/${v.slug}/tree` });
      setTree(t);
    } catch (e) { setErr(String(e)); }
  }

  async function openFile(v: Vault, path: string) {
    setOpenPath(path); setBusy(true);
    try {
      const r = await invoke<{ path: string; content: string }>("api_get", {
        path: `/api/v1/vaults/${v.slug}/file?path=${encodeURIComponent(path)}`,
      });
      setContent(r.content); setSaved(r.content);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!active || !openPath) return;
    setBusy(true); setErr(null);
    try {
      await invoke("api_put", {
        path: `/api/v1/vaults/${active.slug}/file`,
        body: { path: openPath, content },
      });
      setSaved(content);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function createVault(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await invoke("api_post", {
        path: "/api/v1/vaults",
        body: { slug: createForm.slug, name: createForm.name },
      });
      setCreating(false); setCreateForm({ slug: "", name: "" });
      await loadVaults();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function changeVisibility(v: Vault, vis: Vault["visibility"]) {
    try {
      await invoke("api_patch", {
        path: `/api/v1/vaults/${v.slug}`,
        body: { visibility: vis },
      });
      await loadVaults();
    } catch (e) { setErr(String(e)); }
  }

  const filteredTree = useMemo(
    () => tree.filter(t => t.path.toLowerCase().includes(filter.toLowerCase())),
    [tree, filter]
  );

  const langOf = (path: string | null) => {
    if (!path) return "markdown";
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return ({ md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
              ts: "typescript", tsx: "typescript", js: "javascript",
              cs: "csharp", py: "python", sh: "shell", css: "css",
              html: "html" } as Record<string, string>)[ext] ?? "plaintext";
  };

  const dirty = content !== savedContent;

  return (
    <div className="flex h-full">
      {/* Vault listesi */}
      <aside className="flex w-64 flex-col border-r border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 p-3">
          <h2 className="text-sm font-semibold">Kasalar ({vaults.length})</h2>
          <button onClick={() => setCreating(true)} className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-900">+ Yeni</button>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 text-xs">
          {vaults.length === 0 && <li className="px-2 py-2 text-neutral-500">Kasa yok.</li>}
          {vaults.map(v => (
            <li key={v.id}>
              <button
                onClick={() => openVault(v)}
                className={
                  "block w-full rounded-md px-2 py-2 text-left " +
                  (active?.id === v.id ? "bg-neutral-900 text-orange-400" : "text-neutral-300 hover:bg-neutral-900")
                }
              >
                <p className="truncate font-medium">{v.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-500">
                  <span className="font-mono">{v.slug}</span>
                  <span className={`rounded-full px-1.5 py-0 text-[9px] ${VIS_COLOR[v.visibility]}`}>{v.visibility}</span>
                </p>
                <p className="text-[10px] text-neutral-600">{v.fileCount} dosya · {fmtBytes(v.byteSize)}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* File tree */}
      <aside className="flex w-72 flex-col border-r border-neutral-800 bg-neutral-950">
        {active ? (
          <>
            <div className="border-b border-neutral-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-mono text-neutral-400">{active.slug}</span>
                <select
                  value={active.visibility}
                  onChange={e => changeVisibility(active, e.target.value as Vault["visibility"])}
                  className="rounded border border-neutral-800 bg-neutral-900 px-1 py-0.5 text-[10px] text-neutral-300"
                >
                  <option value="private">private</option>
                  <option value="tenant">tenant</option>
                  <option value="executive">executive</option>
                </select>
              </div>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="dosya filtrele…"
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
              />
            </div>
            <ul className="flex-1 overflow-y-auto p-2 text-xs">
              {filteredTree.length === 0 && <li className="px-2 py-1 text-neutral-500">Dosya yok.</li>}
              {filteredTree.map(f => (
                <li key={f.path}>
                  <button
                    onClick={() => openFile(active, f.path)}
                    className={
                      "block w-full truncate rounded-md px-2 py-1 text-left font-mono " +
                      (openPath === f.path ? "bg-neutral-900 text-orange-400" : "text-neutral-300 hover:bg-neutral-900")
                    }
                  >
                    {f.path}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="p-4 text-xs text-neutral-500">Sol panelden bir kasa seç.</p>
        )}
      </aside>

      {/* Editor */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-2">
          <div className="flex items-center gap-3">
            {openPath && <span className="font-mono text-xs text-neutral-400">{openPath}{dirty && " ●"}</span>}
          </div>
          <button
            onClick={save}
            disabled={!openPath || !dirty || busy}
            className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {busy ? "…" : "Kaydet"}
          </button>
        </header>
        {err && <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">{err}</p>}
        {openPath ? (
          <Editor
            language={langOf(openPath)}
            theme="vs-dark"
            value={content}
            onChange={v => setContent(v ?? "")}
            options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            {active ? "Sol panelden dosya seç" : "Bir kasa aç"}
          </div>
        )}
      </main>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCreating(false)}>
          <form onSubmit={createVault} onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-lg border border-neutral-700 bg-neutral-950 p-6">
            <h3 className="text-base font-semibold">Yeni kasa</h3>
            <input required placeholder="slug (a-z 0-9 - _)" value={createForm.slug}
              onChange={e => setCreateForm({...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm font-mono" />
            <input required placeholder="Görünür ad" value={createForm.name}
              onChange={e => setCreateForm({...createForm, name: e.target.value})}
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900">İptal</button>
              <button disabled={busy} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                {busy ? "…" : "Oluştur"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
