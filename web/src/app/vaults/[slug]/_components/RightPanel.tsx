"use client";

// Vault editor'un sağ paneli — Obsidian'ın "Right Sidebar" deneyimi.
// İçerik (yukarıdan aşağı, scrollable):
//   1. Outline    — current dosyanın heading hiyerarşisi, click → satıra scroll
//   2. Backlinks  — bu dosyaya `[[ref]]` koyan diğer dosyalar
//   3. Outgoing   — bu dosyadaki `[[ref]]`'lerin gittiği dosyalar
//   4. Local graph — current node + 2-hop komşular, mini Cytoscape
//
// Veri kaynağı: parent vault graph endpoint'inden bir kez çekilen
// nodes/edges listesi (frontend filter; ek API call yok).

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";

cytoscape.use(fcose);

type GraphNode = { id: string; label: string; path: string | null; group: string };
type GraphEdge = { source: string; target: string };

interface Props {
  /** Aktif dosyanın vault path'i (örn "wiki/concepts/foo.md"). null ise panel boş. */
  currentPath: string | null;
  /** Aktif dosyanın markdown içeriği — outline + outgoing extraction. */
  content: string;
  /** Vault graph data — backlinks + outgoing + local graph için. */
  graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  /** Dosya açma — backlinks/outgoing/outline tıklamaları. */
  onOpenFile: (path: string) => void;
  /** Outline tıklamasında editor'a satır numarası gönder. */
  onGoToLine: (line: number) => void;
}

const COLORS: Record<string, string> = {
  root: "#f97316", wiki: "#22d3ee", entities: "#a855f7", concepts: "#22d3ee",
  decisions: "#facc15", meetings: "#f472b6", comparisons: "#34d399", orphan: "#64748b",
};

// ─── Outline parser ───────────────────────────────────────────────────────
// Markdown source'tan h1–h6 satırlarını çıkar. Code fence içindekileri
// görmezden gel (```...``` blokları).
type OutlineEntry = { level: number; text: string; line: number };
function parseOutline(src: string): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const lines = src.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trimStart().startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = raw.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
  }
  return out;
}

// ─── Wikilink resolver — graph data ile dosya path'ine eşle ───────────────
function resolveTarget(target: string, paths: string[]): string | null {
  const t = target.trim();
  const exact = paths.find(p => p === t || p === `${t}.md`);
  if (exact) return exact;
  const base = paths.find(p => {
    const b = (p.split("/").pop() ?? "").replace(/\.(md|markdown)$/i, "");
    return b.toLowerCase() === t.toLowerCase();
  });
  return base ?? null;
}

// ─── Outgoing — current content'ten `[[X]]` çıkar ─────────────────────────
function extractOutgoing(src: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]\n]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const target = m[1].split("|")[0].trim();
    if (target) out.add(target);
  }
  return [...out];
}

// ─── Section header (collapsible) ─────────────────────────────────────────
function Section({
  title, count, defaultOpen = true, children,
}: { title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
      >
        <span className="flex items-center gap-2">
          <span className={"transition-transform " + (open ? "rotate-90" : "")}>›</span>
          {title}
          {count != null && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400 normal-case tracking-normal">
              {count}
            </span>
          )}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ─── Mini local graph (Cytoscape) ─────────────────────────────────────────
function LocalGraphMini({
  centerNodeId, nodes, edges, onOpenFile, paths,
}: {
  centerNodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onOpenFile: (path: string) => void;
  paths: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !centerNodeId) return;

    // 2-hop komşuları topla
    const adj = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
    const scope = new Set<string>([centerNodeId]);
    const hop1 = adj.get(centerNodeId) ?? new Set();
    hop1.forEach(n => scope.add(n));
    hop1.forEach(n => (adj.get(n) ?? new Set()).forEach(nn => scope.add(nn)));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const elements: ElementDefinition[] = [];
    for (const id of scope) {
      const n = nodeMap.get(id);
      if (!n) continue;
      elements.push({
        group: "nodes",
        data: {
          id: n.id,
          label: n.label,
          path: n.path,
          category: n.group,
          isCenter: id === centerNodeId,
        },
      });
    }
    let edgeCounter = 0;
    for (const e of edges) {
      if (scope.has(e.source) && scope.has(e.target)) {
        elements.push({
          group: "edges",
          data: { id: `me${edgeCounter++}`, source: e.source, target: e.target },
        });
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.2,
      minZoom: 0.2,
      maxZoom: 4,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: NodeSingular) => COLORS[ele.data("category")] ?? "#94a3b8",
            "label": "data(label)",
            "color": "#cbd5e1",
            "font-family": "ui-monospace, Menlo, monospace",
            "font-size": 9,
            "text-outline-color": "#0a0a0a",
            "text-outline-width": 2,
            "text-valign": "center",
            "text-halign": "right",
            "text-margin-x": 4,
            "border-width": 0,
            "width": 8,
            "height": 8,
          },
        },
        {
          selector: "node[?isCenter]",
          style: {
            "border-width": 2,
            "border-color": "#fafafa",
            "width": 14,
            "height": 14,
          },
        },
        {
          selector: "edge",
          style: {
            "width": 1,
            "line-color": "#94a3b8",
            "opacity": 0.3,
            "curve-style": "straight",
          },
        },
      ],
      layout: { name: "preset" },
    });
    cyRef.current = cy;

    cy.layout({
      name: "fcose",
      // @ts-expect-error fcose options
      animate: false,
      randomize: true,
      nodeRepulsion: () => 3000,
      idealEdgeLength: () => 50,
      gravity: 0.4,
    }).run();

    cy.fit(undefined, 12);

    cy.on("tap", "node", (evt) => {
      const path = evt.target.data("path");
      if (path) onOpenFile(path);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [centerNodeId, nodes, edges, onOpenFile, paths]);

  if (!centerNodeId) {
    return (
      <p className="rounded border border-neutral-800 bg-neutral-900/40 px-2 py-3 text-center text-[10px] text-neutral-600">
        Bu dosya graph'a kayıtlı değil.
      </p>
    );
  }
  return (
    <div
      ref={containerRef}
      className="h-44 w-full rounded border border-neutral-800 bg-[#0a0a0a]"
    />
  );
}

// ─── Backlink/outgoing list item ──────────────────────────────────────────
function FileLink({
  path, onOpen,
}: { path: string; onOpen: (p: string) => void }) {
  const display = path.replace(/\.(md|markdown)$/i, "");
  const dir = display.includes("/") ? display.slice(0, display.lastIndexOf("/")) : null;
  const base = display.split("/").pop() ?? display;
  return (
    <button
      onClick={() => onOpen(path)}
      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800/60"
      title={path}
    >
      <span className="text-neutral-100">{base}</span>
      {dir && <span className="ml-1 text-[10px] text-neutral-600">{dir}</span>}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function RightPanel({
  currentPath, content, graph, onOpenFile, onGoToLine,
}: Props) {
  const outline = useMemo(() => parseOutline(content), [content]);

  const allPaths = useMemo(() => graph?.nodes.map(n => n.path).filter((p): p is string => !!p) ?? [],
    [graph]);

  // currentPath → graph node id (nodes id genelde path'tir, ama API
  // synthetic id de döndürebilir → fallback olarak path eşleşmesi)
  const currentNodeId = useMemo(() => {
    if (!graph || !currentPath) return null;
    const byId = graph.nodes.find(n => n.id === currentPath);
    if (byId) return byId.id;
    const byPath = graph.nodes.find(n => n.path === currentPath);
    return byPath?.id ?? null;
  }, [graph, currentPath]);

  // Backlinks: bu node'a target eden edge'lerin source'ları
  const backlinks = useMemo(() => {
    if (!graph || !currentNodeId) return [] as { id: string; path: string | null; label: string }[];
    const sources = graph.edges.filter(e => e.target === currentNodeId).map(e => e.source);
    const ids = new Set(sources);
    return graph.nodes
      .filter(n => ids.has(n.id) && n.path && n.path !== currentPath)
      .map(n => ({ id: n.id, path: n.path, label: n.label }));
  }, [graph, currentNodeId, currentPath]);

  // Outgoing (canlı): mevcut content'ten parse + graph üzerinden resolve
  const outgoing = useMemo(() => {
    const targets = extractOutgoing(content);
    if (targets.length === 0) return [];
    return targets.map(t => {
      const resolved = resolveTarget(t, allPaths);
      return { target: t, path: resolved };
    });
  }, [content, allPaths]);

  if (!currentPath) {
    return (
      <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 text-xs text-neutral-500">
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px]">
          Sağ panel — dosya seç
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950">
      <div className="flex-1 overflow-y-auto">
        <Section title="Outline" count={outline.length || undefined}>
          {outline.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Bu dosyada başlık yok.</p>
          ) : (
            <div className="space-y-0.5">
              {outline.map((h, i) => (
                <button
                  key={i}
                  onClick={() => onGoToLine(h.line)}
                  style={{ paddingLeft: `${(h.level - 1) * 10}px` }}
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-neutral-300 transition-colors hover:bg-neutral-800/60"
                  title={h.text}
                >
                  <span className="mr-1.5 text-[10px] text-neutral-600">H{h.level}</span>
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="Backlinks" count={backlinks.length}>
          {backlinks.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Bu dosyaya link veren bir not yok.</p>
          ) : (
            <div className="space-y-0.5">
              {backlinks.map(b => b.path && (
                <FileLink key={b.id} path={b.path} onOpen={onOpenFile} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Outgoing" count={outgoing.length}>
          {outgoing.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Henüz dış link yok. <code className="rounded bg-neutral-900 px-1">[[Note]]</code> ile ekle.</p>
          ) : (
            <div className="space-y-0.5">
              {outgoing.map((o, i) =>
                o.path ? (
                  <FileLink key={i} path={o.path} onOpen={onOpenFile} />
                ) : (
                  <span
                    key={i}
                    className="block truncate rounded px-2 py-1 text-xs text-neutral-500 italic"
                    title={`Hedef bulunamadı: ${o.target}`}
                  >
                    {o.target} <span className="text-[10px] text-neutral-700">(yok)</span>
                  </span>
                )
              )}
            </div>
          )}
        </Section>

        <Section title="Local graph" defaultOpen={true}>
          <LocalGraphMini
            centerNodeId={currentNodeId}
            nodes={graph?.nodes ?? []}
            edges={graph?.edges ?? []}
            onOpenFile={onOpenFile}
            paths={allPaths}
          />
        </Section>
      </div>
    </aside>
  );
}
