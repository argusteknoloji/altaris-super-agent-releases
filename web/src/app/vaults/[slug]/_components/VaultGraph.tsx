"use client";

// Obsidian-inspired vault graph view, built on Cytoscape.js + cytoscape-fcose.
// Replaces the canvas-based custom force simulation that suffered repeated
// black-screen regressions. Cytoscape handles layout, hit-testing, hover,
// pan/zoom, animation; we layer the Obsidian feature set on top.

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from "cytoscape";
import { ensureFcose } from "@/lib/cytoscape-setup";

ensureFcose();

type Node = { id: string; label: string; path: string | null; group: string };
type Edge = { source: string; target: string };

interface Props {
  nodes: Node[];
  edges: Edge[];
  /**
   * Bir node'a tıklayınca tetiklenir. Parent path null olsa bile id/label
   * bilgisinden tree üzerinde best-effort eşleşme yapabilir, bu yüzden
   * tüm node info gönderiyoruz.
   */
  onNodeOpen?: (info: { id: string; label: string; path: string | null }) => void;
}

const COLORS: Record<string, string> = {
  root:        "#f97316",
  wiki:        "#22d3ee",
  entities:    "#a855f7",
  concepts:    "#22d3ee",
  decisions:   "#facc15",
  meetings:    "#f472b6",
  comparisons: "#34d399",
  orphan:      "#64748b",
};

const ALL_GROUPS = Object.keys(COLORS);

interface ViewSettings {
  /** Hidden grupların id'leri */
  hiddenGroups: Set<string>;
  /** Search query — eşleşmeyen node'lar fade. Empty = filter yok. */
  search: string;
  /** Label gösterim eşiği — degree >= bu olanlar label gösterir. -1 = tümü. */
  labelMinDegree: number;
  /** Local graph fokus node'u — null ise tam graph */
  focusNode: string | null;
  /** Local graph hop sayısı */
  focusHops: number;
  /** Edge opacity (0–1) */
  edgeOpacity: number;
  /** Node size multiplier */
  nodeSizeScale: number;
}

export default function VaultGraph({ nodes, edges, onNodeOpen }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [settings, setSettings] = useState<ViewSettings>({
    hiddenGroups: new Set(),
    search: "",
    labelMinDegree: 4,
    focusNode: null,
    focusHops: 1,
    edgeOpacity: 0.25,
    nodeSizeScale: 1.0,
  });
  const [showSettings, setShowSettings] = useState(false);

  // Search input → debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSettings(s => ({ ...s, search: searchInput.trim().toLowerCase() })), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Build cytoscape elements once per data change
  const elements: ElementDefinition[] = useMemo(() => {
    // Wikilinks may point to pages that don't exist (e.g. `[[WIKI]]` referencing
    // a stub). Cytoscape throws "Can not create edge `e8` with nonexistent
    // source/target" on dangling edges, so we drop them up front.
    const nodeIds = new Set(nodes.map(n => n.id));
    const validEdges = edges.filter(
      e => e.source !== e.target && nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    const degree = new Map<string, number>();
    for (const e of validEdges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const nodeEls: ElementDefinition[] = nodes.map(n => ({
      group: "nodes",
      data: {
        id: n.id,
        label: n.label,
        path: n.path,
        category: n.group,
        degree: degree.get(n.id) ?? 0,
      },
    }));
    const edgeEls: ElementDefinition[] = validEdges.map((e, i) => ({
      group: "edges",
      data: { id: `e${i}`, source: e.source, target: e.target },
    }));
    return [...nodeEls, ...edgeEls];
  }, [nodes, edges]);

  // ── Init cytoscape once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.25,
      minZoom: 0.05,
      // 8× iken Cytoscape canvas rendering'i siyah frame üretebiliyordu (texture
      // / projection sınırı). 4× pratikte bütün label'ları okunaklı yapıyor,
      // daha fazlasına ihtiyaç olursa kullanıcı zaten node'a tıklayıp dosyayı
      // açabilir.
      maxZoom: 4,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: NodeSingular) => COLORS[ele.data("category")] ?? "#94a3b8",
            "label": "",
            "color": "#cbd5e1",
            "font-family": "ui-monospace, Menlo, monospace",
            "font-size": 10,
            "text-outline-color": "#0a0a0a",
            "text-outline-width": 2,
            "text-valign": "center",
            "text-halign": "right",
            "text-margin-x": 6,
            "border-width": 0,
            "width": (ele: NodeSingular) => 8 + Math.min(28, Math.sqrt(ele.data("degree") || 0) * 4),
            "height": (ele: NodeSingular) => 8 + Math.min(28, Math.sqrt(ele.data("degree") || 0) * 4),
          },
        },
        {
          selector: "node.show-label",
          style: { "label": "data(label)" },
        },
        {
          selector: "edge",
          style: {
            "width": 1,
            "line-color": "#94a3b8",
            "opacity": 0.25,
            "curve-style": "straight",
          },
        },
        {
          selector: ".faded",
          style: { "opacity": 0.08 },
        },
        {
          selector: ".highlighted",
          style: {
            "border-width": 2,
            "border-color": "#fafafa",
            "label": "data(label)",
            "z-index": 999,
          },
        },
        {
          selector: "edge.highlighted",
          style: { "line-color": "#f97316", "opacity": 0.9, "width": 1.5 },
        },
        {
          selector: "node.hidden, edge.hidden",
          style: { "display": "none" },
        },
      ],
      layout: { name: "preset" }, // run fcose explicitly below
    });
    cyRef.current = cy;

    // fcose layout options @types/cytoscape'in base LayoutOptions tipinde yok;
    // cast ile geçiriyoruz. Runtime'da fcose.register cytoscape'e bu name'i
    // tanıtıyor, parametreler doğru iletiliyor.
    cy.layout({
      name: "fcose",
      quality: "default",
      randomize: true,
      animate: false,
      nodeRepulsion: () => 6000,
      idealEdgeLength: () => 70,
      edgeElasticity: () => 0.45,
      gravity: 0.25,
      gravityRange: 3.8,
      nodeSeparation: 75,
      packComponents: true,
      nestingFactor: 0.1,
    } as cytoscape.LayoutOptions).run();

    cy.fit(undefined, 60);

    // ── Hover highlight (Obsidian-tarzı) ──────────────────────────────────
    cy.on("mouseover", "node", (evt: cytoscape.EventObject) => {
      const node = evt.target as NodeSingular;
      cy.elements().addClass("faded");
      const neigh = node.closedNeighborhood();
      neigh.removeClass("faded").addClass("highlighted");
    });
    cy.on("mouseout", "node", () => {
      cy.elements().removeClass("faded").removeClass("highlighted");
    });

    // ── Click → dosyaya git ───────────────────────────────────────────────
    // Path null olsa bile (synthetic kategoriler / orphan etiketler) parent'a
    // bilgi gönder; parent tree üzerinden id/label ile dosya tahmini yapabilir.
    cy.on("tap", "node", (evt: cytoscape.EventObject) => {
      if (!onNodeOpen) return;
      const node = evt.target as NodeSingular;
      onNodeOpen({
        id: node.id(),
        label: node.data("label") ?? "",
        path: node.data("path") ?? null,
      });
    });

    // ── Sağ tık → local graph (focus mode) ────────────────────────────────
    cy.on("cxttap", "node", (evt: cytoscape.EventObject) => {
      const id = (evt.target as NodeSingular).id();
      setSettings((s) => ({ ...s, focusNode: s.focusNode === id ? null : id }));
    });

    // Boş alana sağ tık → focus modu kapat
    cy.on("cxttap", (evt: cytoscape.EventObject) => {
      if (evt.target === cy) {
        setSettings((s) => ({ ...s, focusNode: null }));
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  // ── Apply settings (filter / search / label / focus) ──────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      // 1. Group visibility
      cy.nodes().forEach((n: NodeSingular) => {
        const cat = n.data("category");
        const groupHidden = settings.hiddenGroups.has(cat);
        if (groupHidden) n.addClass("hidden");
        else n.removeClass("hidden");
      });

      // 2. Focus / local graph
      if (settings.focusNode) {
        const focus = cy.getElementById(settings.focusNode);
        if (focus.nonempty()) {
          let scope: cytoscape.Collection = focus as unknown as cytoscape.Collection;
          for (let i = 0; i < settings.focusHops; i++) {
            scope = scope.union(scope.openNeighborhood());
          }
          cy.elements().difference(scope).addClass("hidden");
          scope.removeClass("hidden");
        }
      }

      // 3. Search filter (eşleşmeyenleri fade — hidden değil)
      cy.elements().removeClass("faded");
      if (settings.search) {
        const q = settings.search;
        const matches = cy.nodes().filter((n: NodeSingular) =>
          (n.data("label") ?? "").toLowerCase().includes(q),
        );
        if (matches.length > 0) {
          cy.elements().addClass("faded");
          matches.removeClass("faded").addClass("highlighted");
          matches.connectedEdges().removeClass("faded");
          matches.openNeighborhood().removeClass("faded");
        }
      } else {
        cy.elements().removeClass("highlighted");
      }

      // 4. Label visibility — degree >= threshold olanlar
      cy.nodes().forEach((n: NodeSingular) => {
        const deg = n.data("degree") || 0;
        if (settings.labelMinDegree < 0 || deg >= settings.labelMinDegree) {
          n.addClass("show-label");
        } else {
          n.removeClass("show-label");
        }
      });

      // 5. Edge opacity + node size — global style override
      cy.style()
        .selector("edge")
        .style({ "opacity": settings.edgeOpacity })
        .selector("node")
        .style({
          "width": (ele: NodeSingular) =>
            (8 + Math.min(28, Math.sqrt(ele.data("degree") || 0) * 4)) * settings.nodeSizeScale,
          "height": (ele: NodeSingular) =>
            (8 + Math.min(28, Math.sqrt(ele.data("degree") || 0) * 4)) * settings.nodeSizeScale,
        })
        .update();
    });
  }, [settings]);

  function toggleGroup(g: string) {
    setSettings((s) => {
      const next = new Set(s.hiddenGroups);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return { ...s, hiddenGroups: next };
    });
  }

  function resetView() {
    cyRef.current?.fit(undefined, 60);
  }

  function exitFocus() {
    setSettings((s) => ({ ...s, focusNode: null }));
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-[#0a0a0a]" />

      {/* ── Top bar: search + reset + settings ──────────────────────────── */}
      <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <input
            type="search"
            placeholder="Ara…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-56 rounded-md border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 backdrop-blur focus:border-neutral-600 focus:outline-none"
          />
          <button
            onClick={resetView}
            className="rounded-md border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-xs text-neutral-300 backdrop-blur hover:bg-neutral-800"
            title="Görünümü sığdır"
          >
            Sığdır
          </button>
          {settings.focusNode && (
            <button
              onClick={exitFocus}
              className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300 backdrop-blur hover:bg-orange-500/20"
              title="Local graph modundan çık"
            >
              ◯ Tüm graph'a dön
            </button>
          )}
        </div>
        <div className="pointer-events-auto">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={
              "rounded-md border px-3 py-1.5 text-xs backdrop-blur " +
              (showSettings
                ? "border-neutral-600 bg-neutral-800/80 text-neutral-100"
                : "border-neutral-800 bg-neutral-900/80 text-neutral-300 hover:bg-neutral-800")
            }
          >
            ⚙ Ayarlar
          </button>
        </div>
      </div>

      {/* ── Sol panel: filtreler ────────────────────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-4 left-4 w-56 rounded-md border border-neutral-800 bg-neutral-900/80 p-3 text-xs backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
          <span>Filtreler</span>
          <button
            onClick={() => setSettings((s) => ({ ...s, hiddenGroups: new Set() }))}
            className="text-neutral-400 hover:text-neutral-200"
          >
            sıfırla
          </button>
        </div>
        <div className="space-y-1.5">
          {ALL_GROUPS.map((g) => {
            const hidden = settings.hiddenGroups.has(g);
            return (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={
                  "flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-opacity " +
                  (hidden ? "opacity-40" : "opacity-100 hover:bg-neutral-800/50")
                }
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COLORS[g] }}
                />
                <span className="text-neutral-300">{g}</span>
                {hidden && <span className="ml-auto text-[10px] text-neutral-600">gizli</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sağ panel: ayarlar ──────────────────────────────────────────── */}
      {showSettings && (
        <div className="pointer-events-auto absolute right-4 top-16 w-72 rounded-md border border-neutral-800 bg-neutral-900/90 p-4 text-xs text-neutral-300 backdrop-blur">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-neutral-500">
            Görünüm ayarları
          </div>
          <label className="mb-3 block">
            <span className="mb-1 block text-neutral-400">
              Label eşiği (degree ≥ {settings.labelMinDegree < 0 ? "tümü" : settings.labelMinDegree})
            </span>
            <input
              type="range"
              min={-1}
              max={20}
              step={1}
              value={settings.labelMinDegree}
              onChange={(e) =>
                setSettings((s) => ({ ...s, labelMinDegree: Number(e.target.value) }))
              }
              className="w-full"
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-neutral-400">
              Edge opacity ({settings.edgeOpacity.toFixed(2)})
            </span>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={settings.edgeOpacity}
              onChange={(e) =>
                setSettings((s) => ({ ...s, edgeOpacity: Number(e.target.value) }))
              }
              className="w-full"
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-neutral-400">
              Node boyutu ({settings.nodeSizeScale.toFixed(1)}×)
            </span>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.1}
              value={settings.nodeSizeScale}
              onChange={(e) =>
                setSettings((s) => ({ ...s, nodeSizeScale: Number(e.target.value) }))
              }
              className="w-full"
            />
          </label>
          <label className="mb-1 block">
            <span className="mb-1 block text-neutral-400">
              Local graph hop ({settings.focusHops})
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={settings.focusHops}
              onChange={(e) =>
                setSettings((s) => ({ ...s, focusHops: Number(e.target.value) }))
              }
              className="w-full"
            />
          </label>
          <p className="mt-3 border-t border-neutral-800 pt-3 text-[10px] leading-relaxed text-neutral-500">
            Sağ tık bir node'a → o node + komşuları (focus mode). Boş alana
            sağ tık → tam graph'a dön. Cmd/Ctrl + scroll = zoom, drag = pan.
          </p>
        </div>
      )}

      {/* ── Sağ alt: legend (focus modunda farklı bilgi) ────────────────── */}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-[10px] text-neutral-500 backdrop-blur">
        {settings.focusNode ? (
          <span className="text-orange-300">Local graph · {settings.focusHops} hop</span>
        ) : (
          <span>{nodes.length} node · {edges.length} edge</span>
        )}
      </div>
    </div>
  );
}
