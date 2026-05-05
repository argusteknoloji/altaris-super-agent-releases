"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { fmtDateTimeTR } from "@/lib/datetime";

// Monaco bundle is heavy (~1.5 MB). Lazy-load + skip SSR so the rest of the
// vault browser is interactive instantly.
// Code files (.ts, .py, .json, ...) → Monaco (full IDE features).
// Markdown (.md, .markdown) → CM6 (Obsidian-inspired, lighter, wikilink-aware).
const MonacoEditor = dynamic(() => import("@monaco-editor/react").then(m => m.default), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">Editor yükleniyor…</div>
});
const MarkdownEditor = dynamic(() => import("./_components/MarkdownEditor"), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">Editor yükleniyor…</div>
});

type McpEnvRow = { key: string; value: string };
type McpFormState = {
  name: string;
  transport: "stdio" | "http";
  command: string;
  args: string;
  url: string;
  envs: McpEnvRow[];
};

/** Tek-pass markdown → HTML çevirici. Tam CommonMark değil; vault preview için yeterli. */
function renderMarkdown(src: string): string {
  const esc = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = "";
  const lines = src.split("\n");
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listOpen = false;
  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (!inCode) { inCode = true; codeLang = raw.slice(3).trim(); codeBuf = []; }
      else {
        out += `<pre class="bg-neutral-900 rounded p-3 text-xs overflow-x-auto"><code data-lang="${esc(codeLang)}">${esc(codeBuf.join("\n"))}</code></pre>`;
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (/^#{1,6}\s/.test(raw)) {
      const lvl = raw.match(/^#+/)![0].length;
      const text = raw.replace(/^#+\s+/, "");
      out += `<h${lvl} class="font-semibold text-orange-300 mt-4 mb-2">${esc(text)}</h${lvl}>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(raw)) {
      if (!listOpen) { out += `<ul class="list-disc pl-5 my-2">`; listOpen = true; }
      out += `<li>${inline(esc(raw.replace(/^\s*[-*]\s+/, "")))}</li>`;
      continue;
    }
    if (listOpen) { out += "</ul>"; listOpen = false; }
    if (raw.trim() === "") { out += "<br/>"; continue; }
    out += `<p class="my-1">${inline(esc(raw))}</p>`;
  }
  if (listOpen) out += "</ul>";
  return out;

  function inline(s: string): string {
    // [text](url) — markdown link. http(s):// dış (yeni sekme), aksi halde
    // vault içi relative path olarak işaretle (data-relpath).
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
      const trimmed = String(href).trim();
      if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
        return `<a href="${escAttr(trimmed)}" target="_blank" rel="noreferrer" class="text-sky-400 hover:underline">${text}</a>`;
      }
      return `<a data-relpath="${escAttr(trimmed)}" class="text-sky-400 hover:underline cursor-pointer">${text}</a>`;
    });
    // [[wikilink]] | [[wikilink#section]] | [[wikilink|alias]] → vault içi link
    s = s.replace(/\[\[([^\]\|#]+)(?:#[^\]\|]*)?(?:\|([^\]]+))?\]\]/g,
      (_m, target, alias) => {
        const label = alias ?? target;
        return `<a data-wikilink="${escAttr(target.trim())}" class="text-sky-400 hover:underline cursor-pointer">${label}</a>`;
      });
    // **bold**
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // *italic*
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    // `inline code`
    s = s.replace(/`([^`]+)`/g, '<code class="bg-neutral-800 rounded px-1">$1</code>');
    return s;
  }
  function escAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

type TreeEntry = { path: string; bytes: number; modifiedUtc: string };

// Folder/file tree node — flat path listesinden hiyerarsik yapi inseasi icin
type FileNode   = { type: "file"; name: string; path: string; bytes: number; modifiedUtc: string };
type FolderNode = { type: "folder"; name: string; path: string; children: TreeNode[] };
type TreeNode   = FileNode | FolderNode;

/** Flat path listesinden ('wiki/sources/foo.md') hiyerarsik tree olustur. */
function buildTree(entries: TreeEntry[]): FolderNode {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] };
  // Yardimci: bir folder path'i icin (yoksa olustur) child folder doner
  function ensureFolder(parent: FolderNode, name: string, path: string): FolderNode {
    let f = parent.children.find(c => c.type === "folder" && c.name === name) as FolderNode | undefined;
    if (!f) {
      f = { type: "folder", name, path, children: [] };
      parent.children.push(f);
    }
    return f;
  }
  for (const e of entries) {
    const parts = e.path.split("/");
    const fileName = parts.pop()!;
    let cur = root;
    let curPath = "";
    for (const p of parts) {
      curPath = curPath ? `${curPath}/${p}` : p;
      cur = ensureFolder(cur, p, curPath);
    }
    cur.children.push({ type: "file", name: fileName, path: e.path, bytes: e.bytes, modifiedUtc: e.modifiedUtc });
  }
  // Klasorler once, sonra alfabetik sirala (recursive)
  function sortRec(n: FolderNode) {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, "tr");
    });
    for (const c of n.children) if (c.type === "folder") sortRec(c);
  }
  sortRec(root);
  return root;
}
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
  const [sidebarTab, setSidebarTab] = useState<"files" | "search">("files");
  // Editor ref + pending scroll line (search hit'ten gelen satır)
  // Monaco instance'i tutmak için useRef; openFile sonrası satır highlight + reveal
  const editorRef = useRef<{ revealLineInCenter: (line: number) => void; setSelection: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => void } | null>(null);
  const pendingLineRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  // Obsidian-tarzı iki ana mod: Edit (CM6 source + light live-preview cilo)
  // ve Read (full HTML render). Tercih localStorage'da kalıcı.
  const [viewMode, setViewMode] = useState<"edit" | "read">("edit");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("altaris_md_view_mode") : null;
    if (saved === "edit" || saved === "read") setViewMode(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("altaris_md_view_mode", viewMode);
  }, [viewMode]);
  const isMd = activePath?.toLowerCase().endsWith(".md") ?? false;
  const langOf = (path: string | null) => {
    if (!path) return "markdown";
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return { md: "markdown", markdown: "markdown",
             json: "json", yaml: "yaml", yml: "yaml",
             ts: "typescript", tsx: "typescript",
             js: "javascript", jsx: "javascript",
             cs: "csharp", py: "python", sh: "shell",
             css: "css", html: "html" }[ext] ?? "plaintext";
  };

  async function loadTree() {
    const r = await fetch(`/api/proxy/vaults/${slug}/tree`, { cache: "no-store" });
    if (!r.ok) { setError(await r.text()); return; }
    setTree(await r.json());
  }

  useEffect(() => { loadTree(); /* eslint-disable-next-line */ }, [slug]);

  // Vault yüklenince varsayılan dosyayı aç:
  //   1. URL ?file=X varsa onu (graph view'den tıklamış olabilir)
  //   2. Yoksa Altaris.md (Obsidian-tarzı landing page)
  // Sadece ilk render'da; kullanıcı manuel başka dosya açtıysa onu ezme.
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenRef.current || activePath || tree.length === 0) return;
    // URL query'sini browser API ile oku — useSearchParams çağırmak için
    // Suspense boundary gerekiyor; tek seferlik bootstrap için window yeterli.
    const fromQuery = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("file")
      : null;
    if (fromQuery) {
      const target = tree.find(t => t.path === fromQuery);
      if (target) {
        didAutoOpenRef.current = true;
        void openFile(target.path);
        return;
      }
    }
    const landing = tree.find(t => t.path === "Altaris.md");
    if (landing) {
      didAutoOpenRef.current = true;
      void openFile(landing.path);
    }
    /* eslint-disable-next-line */
  }, [tree]);

  async function openFile(path: string, line?: number) {
    setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (!r.ok) { setError(await r.text()); return; }
    const f = await r.json() as FileResp;
    setActivePath(f.path); setContent(f.content); setSavedContent(f.content);
    pendingLineRef.current = line ?? null;
    // Eğer editor zaten mounted ise (aynı vault içinde dosya değişimi),
    // content set edildikten sonra Monaco yeni değerle render eder; küçük delay
    // ile reveal çağırırız ki yeni model hazır olsun.
    if (line && editorRef.current) {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.revealLineInCenter(line);
          editorRef.current.setSelection({ startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 999 });
        }
      }, 80);
    }
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
    await writeFile(path, `# ${path.split("/").pop()?.replace(/\.md$/, "")}\n`);
  }

  async function writeFile(path: string, content: string) {
    setBusy(true); setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content })
    });
    if (!r.ok) setError(await r.text());
    else { await loadTree(); openFile(path); }
    setBusy(false);
  }

  /**
   *  Preview <div> üzerinde event delegation: <a data-wikilink="X"> ya da
   *  <a data-relpath="path"> tıklamasını yakala, vault dosyasını aç.
   *  - data-relpath: aktif dosya dizinine göre çözer (ör. ./other.md, ../foo.md)
   *  - data-wikilink: tüm tree'de basename === target ya da .md eki kontrolüyle
   *    eşleşen ilk dosyayı bulur (Obsidian davranışı)
   */
  function onPreviewClick(ev: React.MouseEvent<HTMLDivElement>) {
    const t = ev.target as HTMLElement;
    const a = t.closest("a") as HTMLAnchorElement | null;
    if (!a) return;
    const rel = a.getAttribute("data-relpath");
    const wiki = a.getAttribute("data-wikilink");
    if (!rel && !wiki) return;
    ev.preventDefault();

    let target: string | null = null;
    if (rel) {
      // aktif dosya dizinine göre normalize et
      const baseDir = activePath ? activePath.split("/").slice(0, -1).join("/") : "";
      const joined = baseDir ? `${baseDir}/${rel}` : rel;
      // ./ ve ../ çöz
      const parts: string[] = [];
      for (const p of joined.split("/")) {
        if (p === "" || p === ".") continue;
        if (p === "..") parts.pop();
        else parts.push(p);
      }
      target = parts.join("/");
      // .md eki yoksa dene
      if (!tree.some(f => f.path === target) && !target.endsWith(".md")) target = target + ".md";
    } else if (wiki) {
      const name = wiki.trim();
      // Önce path === name (ör. "wiki/foo.md")
      let m = tree.find(f => f.path === name || f.path === name + ".md");
      // Sonra basename eşleşmesi (Obsidian: wikilinks isim ile bağlanır)
      if (!m) m = tree.find(f => {
        const base = f.path.split("/").pop()!.replace(/\.md$/i, "");
        return base.toLowerCase() === name.toLowerCase();
      });
      target = m?.path ?? null;
    }

    if (target && tree.some(f => f.path === target)) {
      void openFile(target);
    } else {
      setError(`Bağlantı hedefi bulunamadı: ${rel ?? wiki}`);
    }
  }

  async function deleteActiveFile() {
    if (!activePath) return;
    if (!confirm(`"${activePath}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/proxy/vaults/${slug}/file?path=${encodeURIComponent(activePath)}`, {
      method: "DELETE"
    });
    if (!r.ok) {
      setError(`Silinemedi: HTTP ${r.status} ${await r.text()}`);
    } else {
      // Editör'den çıkar, listeyi yenile
      setActivePath(null);
      setContent("");
      setSavedContent("");
      await loadTree();
    }
    setBusy(false);
  }

  /**
   * Altaris CLI'nin proje konvansiyonu — bu vault içinde:
   *   .mcp.json                          MCP server config (Claude Code uyumlu)
   *   .altaris/skills/{name}/SKILL.md    Proje skill'i (frontmatter + body)
   *   .altaris/agents/{name}.md          Sub-agent (frontmatter + body)
   *   ALTARIS.md veya CLAUDE.md          Proje instruction (root)
   */
  function quickCreateMcp() {
    setMcpModalOpen(true);
  }

  /**
   *  Visual MCP form sonucu mevcut .mcp.json'a server ekler (yoksa yaratır).
   *  Stdio: command + args, HTTP: url. Env vars opsiyonel.
   */
  async function saveMcpServer(form: McpFormState) {
    const existing = tree.some(t => t.path === ".mcp.json");
    let parsed: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
    if (existing) {
      try {
        const r = await fetch(`/api/proxy/vaults/${slug}/file?path=${encodeURIComponent(".mcp.json")}`);
        if (r.ok) {
          const data = await r.json();
          const cur = JSON.parse(data.content || "{}");
          if (cur && typeof cur === "object" && cur.mcpServers) parsed = cur;
        }
      } catch { /* ignore — boş başla */ }
    }
    const slugName = form.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slugName) { setError("MCP server adı zorunlu"); return; }

    const envObj: Record<string, string> = {};
    for (const e of form.envs) {
      if (e.key.trim() && e.value.trim()) envObj[e.key.trim()] = e.value.trim();
    }

    let serverDef: Record<string, unknown>;
    if (form.transport === "http") {
      if (!form.url.trim()) { setError("HTTP MCP için URL zorunlu"); return; }
      serverDef = { type: "http", url: form.url.trim() };
      if (Object.keys(envObj).length) (serverDef as { headers?: Record<string,string> }).headers = envObj;
    } else {
      if (!form.command.trim()) { setError("Stdio MCP için komut zorunlu"); return; }
      const argsArr = form.args.split(/\s+/).filter(Boolean);
      serverDef = { command: form.command.trim() };
      if (argsArr.length) (serverDef as { args?: string[] }).args = argsArr;
      if (Object.keys(envObj).length) (serverDef as { env?: Record<string,string> }).env = envObj;
    }
    parsed.mcpServers[slugName] = serverDef;

    await writeFile(".mcp.json", JSON.stringify(parsed, null, 2));
    setMcpModalOpen(false);
    openFile(".mcp.json");
  }

  async function quickCreateSkill() {
    const name = prompt("Skill adı (slug, ör: ingest-pdf):");
    if (!name) return;
    const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const tmpl = `---\nname: ${safe}\ndescription: Bu skill'in ne işe yaradığını 1-2 cümlede yaz. Triggering keywords + output expectations.\n---\n\n# ${safe}\n\n## Ne yapar\nKısaca açıkla.\n\n## Adımlar\n1. ...\n2. ...\n\n## Örnek kullanım\n\`\`\`\n[user prompt'u]\n\`\`\`\n`;
    await writeFile(`.altaris/skills/${safe}/SKILL.md`, tmpl);
  }

  async function uploadSkillZip(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("ZIP dosyası seçin"); return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Dosya çok büyük (max 50MB)"); return;
    }
    const explicitName = prompt(
      `Skill adı (slug, boş bırakırsan ZIP içindeki dizin/dosya adı kullanılır):`,
      file.name.replace(/\.zip$/i, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
    );
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (explicitName) fd.append("name", explicitName);
      const r = await fetch(`/api/proxy/vaults/${slug}/upload-skill`, {
        method: "POST", body: fd,
      });
      if (!r.ok) {
        const txt = await r.text();
        setError(`Upload fail: ${txt}`);
      } else {
        const out = await r.json() as { skill: string; path: string; files: number };
        await loadTree();
        // Skill'in SKILL.md'sini aç
        openFile(`${out.path}/SKILL.md`);
        alert(`✓ Skill yüklendi: ${out.skill} (${out.files} dosya)`);
      }
    } catch (e) {
      setError(`Upload hatası: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function pickSkillZip() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) uploadSkillZip(file);
    };
    input.click();
  }

  async function quickCreateAgent() {
    const name = prompt("Sub-agent adı (slug, ör: code-reviewer):");
    if (!name) return;
    const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const tmpl = `---\nname: ${safe}\ndescription: Bu sub-agent ne için. Hangi durumda main agent bunu spawn etmeli.\ntools: Read, Grep, Glob, Bash\nmodel: claude-sonnet-4-6\n---\n\nSen ${safe} sub-agent'sın. Görevin:\n\n- ...\n- ...\n\nÇıktı formatın:\n\n\`\`\`\n[expected output schema]\n\`\`\`\n`;
    await writeFile(`.altaris/agents/${safe}.md`, tmpl);
  }

  async function runSearch(q: string) {
    setSearchQ(q);
    if (!q.trim()) { setSearchHits([]); return; }
    const r = await fetch(`/api/proxy/vaults/${slug}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (r.ok) setSearchHits(await r.json());
  }

  // Hiyerarşik tree + filter — filter aktifse sadece eşleşen dosyaları göster
  // (klasör yapısı korunur)
  const filteredEntries = useMemo(
    () => filter
      ? tree.filter(t => t.path.toLowerCase().includes(filter.toLowerCase()))
      : tree,
    [tree, filter]
  );
  const treeRoot = useMemo(() => buildTree(filteredEntries), [filteredEntries]);
  // Filter aktifken tüm klasörleri otomatik aç (sonuçları göster)
  const autoExpand = filter.length > 0;

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
          {isMd && (
            <div className="inline-flex overflow-hidden rounded-md border border-neutral-700 text-xs">
              <button
                onClick={() => setViewMode("edit")}
                className={
                  "px-3 py-1 transition-colors " +
                  (viewMode === "edit"
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-800")
                }
                title="Düzenle modu — CM6 source + live preview"
              >
                Düzenle
              </button>
              <button
                onClick={() => setViewMode("read")}
                className={
                  "px-3 py-1 border-l border-neutral-700 transition-colors " +
                  (viewMode === "read"
                    ? "bg-neutral-700 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-800")
                }
                title="Okuma modu — markdown render"
              >
                Oku
              </button>
            </div>
          )}
          <button onClick={quickCreateMcp} disabled={busy} className="rounded-md border border-blue-500/40 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/10" title=".mcp.json oluştur veya aç (CLI projede otomatik yükler)">
            📦 MCP
          </button>
          <button onClick={quickCreateSkill} disabled={busy} className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10" title=".altaris/skills/ altına yeni skill template'i oluştur">
            🧠 Skill
          </button>
          <button onClick={pickSkillZip} disabled={busy} className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10" title="ZIP dosyasından skill yükle (.altaris/skills/{name}/ altına extract)">
            📥 Skill ZIP
          </button>
          <button onClick={quickCreateAgent} disabled={busy} className="rounded-md border border-purple-500/40 px-3 py-1 text-xs text-purple-300 hover:bg-purple-500/10" title=".altaris/agents/ altına yeni sub-agent template'i oluştur">
            🤖 Sub-agent
          </button>
          <button onClick={newFile} disabled={busy} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
            + Dosya
          </button>
          {activePath && (
            <button
              onClick={deleteActiveFile}
              disabled={busy}
              title={`${activePath} dosyasını sil`}
              className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
            >
              🗑 Sil
            </button>
          )}
          <button onClick={save} disabled={!activePath || !dirty || busy} className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40">
            {busy ? "…" : "Kaydet"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* sol: tree + arama (sekmeli) */}
        <aside className="flex w-80 flex-col border-r border-neutral-800 bg-neutral-950">
          {/* Tab bar */}
          <div className="flex items-center border-b border-neutral-800 text-xs font-mono">
            <button
              onClick={() => setSidebarTab("files")}
              className={
                "flex-1 px-3 py-2 border-b-2 transition-colors " +
                (sidebarTab === "files"
                  ? "border-orange-500 text-orange-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-300")
              }
            >
              📁 DOSYALAR
            </button>
            <button
              onClick={() => setSidebarTab("search")}
              className={
                "flex-1 px-3 py-2 border-b-2 transition-colors " +
                (sidebarTab === "search"
                  ? "border-orange-500 text-orange-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-300")
              }
            >
              🔎 ARAMA{searchHits.length > 0 ? ` (${searchHits.length})` : ""}
            </button>
          </div>

          {sidebarTab === "files" && (
            <>
              <div className="border-b border-neutral-800 p-3">
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="dosya filtrele…"
                  className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 text-xs">
                {treeRoot.children.length === 0
                  ? <p className="px-2 py-1 text-neutral-500">Dosya yok.</p>
                  : <TreeView
                      nodes={treeRoot.children}
                      activePath={activePath}
                      autoExpand={autoExpand}
                      onPick={openFile}
                    />
                }
              </div>
            </>
          )}

          {sidebarTab === "search" && (
            <>
              <div className="border-b border-neutral-800 p-3">
                <input
                  value={searchQ}
                  onChange={e => runSearch(e.target.value)}
                  placeholder="vault içinde ara…"
                  className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs"
                  autoFocus
                />
                {searchQ && (
                  <p className="mt-1 px-1 text-[10px] text-neutral-500">
                    {searchHits.length} eşleşme {searchHits.length > 0 && "· tıkla ve aç"}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto text-xs">
                {searchQ && searchHits.length === 0 && (
                  <p className="px-3 py-2 text-neutral-500">Eşleşme yok.</p>
                )}
                {searchHits.map(h => (
                  <button
                    key={h.path + h.lineHint}
                    onClick={() => {
                      openFile(h.path, h.lineHint);
                      setSidebarTab("files");
                    }}
                    className="block w-full border-b border-neutral-900 px-3 py-2 text-left hover:bg-neutral-900"
                  >
                    <p className="truncate font-mono text-[11px] text-orange-400">
                      {h.path}<span className="text-neutral-500">:{h.lineHint}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 font-mono text-[11px] leading-snug text-neutral-400">{h.snippet}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* sağ: editor */}
        <main className="flex flex-1 flex-col">
          {!activePath && (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Sol panelden bir dosya seç ya da <span className="mx-1 font-mono text-neutral-300">+ Dosya</span> ile yeni oluştur.
            </div>
          )}
          {activePath && (
            <div className="flex flex-1 overflow-hidden">
              {/* Markdown: Edit (CM6) ya da Read (HTML render). Tek panel,
                  Obsidian gibi mod-tabanlı switch. Diğer dosyalar her zaman Monaco. */}
              {isMd && viewMode === "read" ? (
                <div
                  className="prose prose-invert flex-1 overflow-y-auto bg-[#0a0a0a] px-8 py-6 text-sm text-neutral-200"
                  onClick={onPreviewClick}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              ) : isMd ? (
                <div className="flex-1">
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    onSave={save}
                    vaultFiles={tree.map(t => t.path)}
                    onWikilinkClick={(target) => {
                      // [[Page]] → vault'ta bul:
                      // 1. exact path match (alt klasör dahil): "Page.md" veya "Page"
                      // 2. basename match: */Page.md
                      // 3. eşleşme yoksa target.md olarak openFile çağır → API 404 dönerse
                      //    kullanıcı "yeni dosya oluştur" akışına yönlendirilir (ileri faz).
                      const t = target.trim();
                      const candidates = tree.map(x => x.path);
                      const exact = candidates.find(p => p === t || p === `${t}.md`);
                      if (exact) { void openFile(exact); return; }
                      const baseMatch = candidates.find(p => {
                        const base = (p.split('/').pop() ?? '').replace(/\.(md|markdown)$/i, '');
                        return base.toLowerCase() === t.toLowerCase();
                      });
                      if (baseMatch) { void openFile(baseMatch); return; }
                      // Fallback: tahmini path. openFile 404'te error mesajı gösterir.
                      const guess = /\.(md|markdown)$/i.test(t) ? t : `${t}.md`;
                      void openFile(guess);
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <MonacoEditor
                    language={langOf(activePath)}
                    theme="vs-dark"
                    value={content}
                    onChange={(v: string | undefined) => setContent(v ?? "")}
                    options={{
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: 13,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2
                    }}
                    onMount={(editor: any, monaco: { KeyMod: { CtrlCmd: number }; KeyCode: { KeyS: number } }) => {
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
                      editorRef.current = editor;
                      // İlk mount sırasında pending line varsa (search'ten geldi) reveal et
                      if (pendingLineRef.current) {
                        const line = pendingLineRef.current;
                        setTimeout(() => {
                          editor.revealLineInCenter(line);
                          editor.setSelection({ startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 999 });
                        }, 80);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {error && <p className="border-t border-neutral-800 bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</p>}
        </main>
      </div>
      {mcpModalOpen && (
        <McpServerModal
          onClose={() => setMcpModalOpen(false)}
          onSave={saveMcpServer}
          existingNames={(() => {
            const f = tree.find(t => t.path === ".mcp.json");
            return f ? null : []; // mevcut isim listesi save anında parse edilirken kontrol edilir
          })() ?? []}
        />
      )}
    </div>
  );
}

/* ─── Folder tree (expand/collapse) ─────────────────────────────────── */

function TreeView({
  nodes, activePath, autoExpand, onPick,
}: {
  nodes: TreeNode[];
  activePath: string | null;
  autoExpand: boolean;
  onPick: (path: string) => void;
}) {
  // Expanded folder paths (sessionStorage'a backed up — vault değişimi dışında kalıcı)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  function toggle(path: string) {
    setExpanded(s => {
      const ns = new Set(s);
      if (ns.has(path)) ns.delete(path); else ns.add(path);
      return ns;
    });
  }
  return (
    <ul className="space-y-px">
      {nodes.map(n =>
        n.type === "folder"
          ? <FolderRow
              key={n.path}
              node={n}
              activePath={activePath}
              expanded={expanded}
              autoExpand={autoExpand}
              onToggle={toggle}
              onPick={onPick}
            />
          : <FileRow key={n.path} node={n} active={activePath === n.path} onPick={onPick} />
      )}
    </ul>
  );
}

function FolderRow({
  node, activePath, expanded, autoExpand, onToggle, onPick,
}: {
  node: FolderNode;
  activePath: string | null;
  expanded: Set<string>;
  autoExpand: boolean;
  onToggle: (path: string) => void;
  onPick: (path: string) => void;
}) {
  const isOpen = autoExpand || expanded.has(node.path);
  return (
    <li>
      <button
        onClick={() => onToggle(node.path)}
        className="block w-full truncate rounded-md px-2 py-1 text-left font-mono text-neutral-400 hover:bg-neutral-900"
      >
        <span className="inline-block w-3 text-neutral-600">{isOpen ? "▼" : "▶"}</span>{" "}
        <span>{node.name}</span>
        <span className="ml-1 text-neutral-600">({node.children.length})</span>
      </button>
      {isOpen && (
        <ul className="ml-3 border-l border-neutral-800 pl-2">
          {node.children.map(c =>
            c.type === "folder"
              ? <FolderRow
                  key={c.path}
                  node={c}
                  activePath={activePath}
                  expanded={expanded}
                  autoExpand={autoExpand}
                  onToggle={onToggle}
                  onPick={onPick}
                />
              : <FileRow key={c.path} node={c} active={activePath === c.path} onPick={onPick} />
          )}
        </ul>
      )}
    </li>
  );
}

function FileRow({ node, active, onPick }: { node: FileNode; active: boolean; onPick: (path: string) => void }) {
  return (
    <li>
      <button
        onClick={() => onPick(node.path)}
        className={
          "block w-full truncate rounded-md px-2 py-1 text-left font-mono " +
          (active ? "bg-neutral-900 text-orange-400" : "text-neutral-300 hover:bg-neutral-900")
        }
        title={`${node.bytes} B · ${fmtDateTimeTR(node.modifiedUtc)}`}
      >
        <span className="inline-block w-3" />{" "}
        {node.name}
      </button>
    </li>
  );
}

function McpServerModal({
  onClose,
  onSave,
  existingNames,
}: {
  onClose: () => void;
  onSave: (form: McpFormState) => Promise<void> | void;
  existingNames: string[];
}) {
  const [form, setForm] = useState<McpFormState>({
    name: "",
    transport: "stdio",
    command: "",
    args: "",
    url: "",
    envs: [{ key: "", value: "" }],
  });
  const [saving, setSaving] = useState(false);

  function setEnv(i: number, patch: Partial<McpEnvRow>) {
    setForm(f => ({ ...f, envs: f.envs.map((e, idx) => idx === i ? { ...e, ...patch } : e) }));
  }
  function addEnv() { setForm(f => ({ ...f, envs: [...f.envs, { key: "", value: "" }] })); }
  function delEnv(i: number) { setForm(f => ({ ...f, envs: f.envs.filter((_, idx) => idx !== i) })); }

  // Quick presets — kullanıcının bilmesi zor şeyleri 1-tıklama hazır hale getir
  function applyPreset(p: "n8n" | "filesystem" | "fetch" | "github") {
    if (p === "n8n") {
      setForm(f => ({ ...f, name: "n8n", transport: "http", url: "https://n8n.argusteknoloji.com/mcp-server/http", envs: [{ key: "", value: "" }] }));
    } else if (p === "filesystem") {
      setForm(f => ({ ...f, name: "filesystem", transport: "stdio", command: "npx", args: "-y @modelcontextprotocol/server-filesystem /srv/altaris/vaults", envs: [{ key: "", value: "" }] }));
    } else if (p === "fetch") {
      setForm(f => ({ ...f, name: "fetch", transport: "stdio", command: "uvx", args: "mcp-server-fetch", envs: [{ key: "", value: "" }] }));
    } else if (p === "github") {
      setForm(f => ({ ...f, name: "github", transport: "stdio", command: "npx", args: "-y @modelcontextprotocol/server-github", envs: [{ key: "GITHUB_PERSONAL_ACCESS_TOKEN", value: "" }] }));
    }
  }

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">📦 MCP Server ekle</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Vault'taki <code className="bg-neutral-800 px-1 rounded">.mcp.json</code>'a server kaydı ekler.
              CLI bu dizine cd edince otomatik yükler.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-2xl leading-none">×</button>
        </div>

        {/* Presets */}
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Hazır şablon</div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "n8n", label: "🔄 n8n (Argus)" },
              { id: "filesystem", label: "📁 Filesystem" },
              { id: "fetch", label: "🌐 Fetch (URL)" },
              { id: "github", label: "🐙 GitHub" },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id as "n8n" | "filesystem" | "fetch" | "github")}
                className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Server adı (slug)</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="örn. n8n, slack, custom-tool"
              className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono"
            />
            {existingNames.includes(form.name.trim()) && (
              <p className="mt-1 text-[11px] text-amber-400">⚠ Bu isim zaten var — üzerine yazılacak</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Transport</label>
            <div className="flex gap-2">
              {(["stdio", "http"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, transport: t })}
                  className={`rounded border px-3 py-1.5 text-xs ${
                    form.transport === t
                      ? "border-orange-500 bg-orange-500/15 text-orange-200"
                      : "border-neutral-700 hover:bg-neutral-800"
                  }`}
                >
                  {t === "stdio" ? "stdio (komut)" : "http (URL)"}
                </button>
              ))}
            </div>
          </div>

          {form.transport === "stdio" ? (
            <>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Komut</label>
                <input
                  value={form.command}
                  onChange={e => setForm({ ...form, command: e.target.value })}
                  placeholder="npx, uvx, python, node, /path/to/binary"
                  className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Argümanlar (boşlukla ayır)</label>
                <input
                  value={form.args}
                  onChange={e => setForm({ ...form, args: e.target.value })}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs text-neutral-400 mb-1">URL</label>
              <input
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/mcp-server/http"
                className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-neutral-400">
                {form.transport === "http" ? "HTTP Headers" : "Environment variables"} (opsiyonel)
              </label>
              <button onClick={addEnv} className="text-xs text-orange-400 hover:text-orange-300">+ ekle</button>
            </div>
            {form.envs.map((e, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input
                  value={e.key}
                  onChange={ev => setEnv(i, { key: ev.target.value })}
                  placeholder="KEY"
                  className="w-1/3 rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs font-mono"
                />
                <input
                  value={e.value}
                  onChange={ev => setEnv(i, { value: ev.target.value })}
                  placeholder="value (secret/url/path)"
                  className="flex-1 rounded bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs font-mono"
                />
                <button onClick={() => delEnv(i)} className="text-neutral-600 hover:text-red-400 px-1">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded border border-neutral-700 px-4 py-2 text-xs hover:bg-neutral-800">İptal</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="rounded bg-orange-500 hover:bg-orange-400 px-4 py-2 text-xs font-medium text-neutral-950 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : ".mcp.json'a ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
