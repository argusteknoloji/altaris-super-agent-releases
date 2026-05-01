"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";

type TreeEntry = { path: string; bytes: number; modifiedUtc: string };
type FileResp  = { path: string; content: string };

export default function VaultBrowserPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [filter, setFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<Array<{ path: string; snippet: string; lineHint: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function loadTree() {
    const r = await fetch(`/api/proxy/vaults/${slug}/tree`, { cache: "no-store" });
    if (!r.ok) { setError(await r.text()); return; }
    setTree(await r.json());
  }

  useEffect(() => { loadTree(); /* eslint-disable-next-line */ }, [slug]);

  async function openFile(path: string) {
    setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (!r.ok) { setError(await r.text()); return; }
    const f = await r.json() as FileResp;
    setActivePath(f.path); setContent(f.content); setSavedContent(f.content);
  }

  async function save() {
    if (!activePath) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: activePath, content })
    });
    if (!r.ok) setError(await r.text());
    else { setSavedContent(content); loadTree(); }
    setBusy(false);
  }

  async function newFile() {
    const path = prompt("Yeni dosya yolu (ör. wiki/concepts/yeni-not.md):", "wiki/concepts/yeni-not.md");
    if (!path) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content: `# ${path.split("/").pop()?.replace(/\.md$/, "")}\n` })
    });
    if (!r.ok) setError(await r.text());
    else { await loadTree(); openFile(path); }
    setBusy(false);
  }

  async function runSearch(q: string) {
    setSearchQ(q);
    if (!q.trim()) { setSearchHits([]); return; }
    const r = await fetch(`/api/proxy/vaults/${slug}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (r.ok) setSearchHits(await r.json());
  }

  const filteredTree = useMemo(
    () => tree.filter(t => t.path.toLowerCase().includes(filter.toLowerCase())),
    [tree, filter]
  );

  const dirty = content !== savedContent;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/vaults" className="text-xs text-neutral-400 hover:text-orange-400">← Kasalar</Link>
          <h1 className="text-base font-semibold">{slug}</h1>
          {activePath && <span className="font-mono text-xs text-neutral-500">{activePath}{dirty && " ●"}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/vaults/${slug}/graph`} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
            Graph
          </Link>
          <button onClick={newFile} disabled={busy} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
            + Dosya
          </button>
          <button onClick={save} disabled={!activePath || !dirty || busy} className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40">
            {busy ? "…" : "Kaydet"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* sol: tree + arama */}
        <aside className="flex w-80 flex-col border-r border-neutral-800 bg-neutral-950">
          <div className="space-y-2 border-b border-neutral-800 p-3">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="dosya filtrele…"
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
            />
            <input
              value={searchQ}
              onChange={e => runSearch(e.target.value)}
              placeholder="içerikte ara…"
              className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
            />
          </div>

          {searchHits.length > 0 && (
            <div className="border-b border-neutral-800 p-2 text-xs">
              <p className="px-2 py-1 text-neutral-500">{searchHits.length} eşleşme</p>
              {searchHits.map(h => (
                <button
                  key={h.path + h.lineHint}
                  onClick={() => { openFile(h.path); setSearchQ(""); setSearchHits([]); }}
                  className="block w-full rounded-md px-2 py-1 text-left hover:bg-neutral-900"
                >
                  <p className="truncate font-mono text-orange-400">{h.path}:{h.lineHint}</p>
                  <p className="truncate text-neutral-500">{h.snippet}</p>
                </button>
              ))}
            </div>
          )}

          <ul className="flex-1 overflow-y-auto p-2 text-xs">
            {filteredTree.length === 0 && <li className="px-2 py-1 text-neutral-500">Dosya yok.</li>}
            {filteredTree.map(f => (
              <li key={f.path}>
                <button
                  onClick={() => openFile(f.path)}
                  className={
                    "block w-full truncate rounded-md px-2 py-1 text-left font-mono " +
                    (activePath === f.path ? "bg-neutral-900 text-orange-400" : "text-neutral-300 hover:bg-neutral-900")
                  }
                  title={`${f.bytes} B · ${new Date(f.modifiedUtc).toLocaleString("tr-TR")}`}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* sağ: editor */}
        <main className="flex flex-1 flex-col">
          {!activePath && (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Sol panelden bir dosya seç ya da <span className="mx-1 font-mono text-neutral-300">+ Dosya</span> ile yeni oluştur.
            </div>
          )}
          {activePath && (
            <textarea
              ref={taRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
              }}
              spellCheck={false}
              className="flex-1 resize-none bg-[#0a0a0a] p-4 font-mono text-xs leading-6 text-neutral-100 outline-none"
            />
          )}
          {error && <p className="border-t border-neutral-800 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</p>}
        </main>
      </div>
    </div>
  );
}
