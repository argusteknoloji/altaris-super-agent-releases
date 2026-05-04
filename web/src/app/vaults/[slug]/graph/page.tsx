"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";

type Node = { id: string; label: string; path: string | null; group: string };
type Edge = { source: string; target: string };

interface Sim {
  x: number; y: number; vx: number; vy: number;
  fx?: number; fy?: number;
  node: Node;
  degree: number;
}

const COLORS: Record<string, string> = {
  root: "#f97316",
  wiki: "#22d3ee",
  entities: "#a855f7",
  concepts: "#22d3ee",
  decisions: "#facc15",
  meetings: "#f472b6",
  comparisons: "#34d399",
  orphan: "#64748b"
};
function colorFor(g: string) { return COLORS[g] ?? "#94a3b8"; }

export default function VaultGraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const r = await fetch(`/api/proxy/vaults/${slug}/graph`, { cache: "no-store" });
        if (!r.ok) { setError(await r.text()); return; }
        const data = await r.json() as { nodes: Node[]; edges: Edge[] };
        if (cancelled) return;
        setStats({ nodes: data.nodes.length, edges: data.edges.length });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setError("Canvas 2D context alinamadi"); return; }
        const dpr = window.devicePixelRatio || 1;

        // Layout settle bekle — flex parent ilk birkaç frame 0 boyut verebilir.
        let waitFrames = 0;
        let rect = canvas.getBoundingClientRect();
        while ((rect.width === 0 || rect.height === 0) && waitFrames < 30) {
          await new Promise<void>(r => requestAnimationFrame(() => r()));
          if (cancelled) return;
          rect = canvas.getBoundingClientRect();
          waitFrames++;
        }
        if (rect.width === 0 || rect.height === 0) {
          setError("Canvas boyutu alınamadı (layout 500ms içinde settle olmadı)");
          return;
        }

        // Resize sadece ResizeObserver tetiklediğinde — per-tick fit yok.
        // Tek seferde set + transform; sonraki resize'larda da paintNow() ile
        // anında redraw → kararlı, flash yok.
        let cssW = 0, cssH = 0;
        const applyResize = () => {
          const r = canvas.getBoundingClientRect();
          const w = r.width, h = r.height;
          if (w === 0 || h === 0) return;
          // Sub-pixel oynamayı yut — sadece tam pixel değişince re-init
          const targetW = Math.round(w * dpr);
          const targetH = Math.round(h * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width  = targetW;
            canvas.height = targetH;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
          cssW = w; cssH = h;
        };
        applyResize();

        // Build sim nodes — merkezle
        const nodeMap = new Map<string, Sim>();
        const cx0 = cssW / 2, cy0 = cssH / 2;
        for (const n of data.nodes) {
          nodeMap.set(n.id, {
            node: n, degree: 0,
            x: cx0 + (Math.random() - 0.5) * 400,
            y: cy0 + (Math.random() - 0.5) * 400,
            vx: 0, vy: 0
          });
        }
        for (const e of data.edges) {
          const a = nodeMap.get(e.source); const b = nodeMap.get(e.target);
          if (a) a.degree++; if (b) b.degree++;
        }
        const links = data.edges
          .map(e => ({ s: nodeMap.get(e.source)!, t: nodeMap.get(e.target)! }))
          .filter(l => l.s && l.t);

        const REPULSION = 4500;
        const LINK_LEN  = 90;
        const LINK_K    = 0.04;
        const CENTER_K  = 0.005;
        const DAMPING   = 0.85;

        let dragging: Sim | null = null;
        const onDown = (ev: MouseEvent) => {
          const rect = canvas.getBoundingClientRect();
          const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
          let pick: Sim | null = null;
          let bestD = 16 * 16;
          for (const n of nodeMap.values()) {
            const d = (n.x - mx) ** 2 + (n.y - my) ** 2;
            if (d < bestD) { bestD = d; pick = n; }
          }
          if (pick) { dragging = pick; pick.fx = mx; pick.fy = my; }
        };
        const onMove = (ev: MouseEvent) => {
          if (!dragging) return;
          const rect = canvas.getBoundingClientRect();
          dragging.fx = ev.clientX - rect.left;
          dragging.fy = ev.clientY - rect.top;
        };
        const onUp = () => {
          if (dragging) { dragging.fx = undefined; dragging.fy = undefined; }
          dragging = null;
        };
        canvas.addEventListener("mousedown", onDown);
        canvas.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        cleanups.push(
          () => canvas.removeEventListener("mousedown", onDown),
          () => canvas.removeEventListener("mousemove", onMove),
          () => window.removeEventListener("mouseup", onUp),
        );

        function paint() {
          ctx!.fillStyle = "#0a0a0a";
          ctx!.fillRect(0, 0, cssW, cssH);
          ctx!.strokeStyle = "rgba(148,163,184,0.18)";
          ctx!.lineWidth = 1;
          for (const l of links) {
            ctx!.beginPath();
            ctx!.moveTo(l.s.x, l.s.y); ctx!.lineTo(l.t.x, l.t.y);
            ctx!.stroke();
          }
          ctx!.font = "11px ui-monospace, Menlo, monospace";
          for (const n of nodeMap.values()) {
            const r = 4 + Math.min(8, Math.sqrt(n.degree) * 2.5);
            ctx!.fillStyle = colorFor(n.node.group);
            ctx!.beginPath(); ctx!.arc(n.x, n.y, r, 0, Math.PI * 2); ctx!.fill();
            ctx!.fillStyle = "#cbd5e1";
            ctx!.fillText(n.node.label, n.x + r + 2, n.y + 4);
          }
        }

        function step() {
          const arr = Array.from(nodeMap.values());
          // Coulomb repulsion
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const a = arr[i], b = arr[j];
              const dx = a.x - b.x, dy = a.y - b.y;
              let d2 = dx * dx + dy * dy;
              if (d2 < 1) d2 = 1;
              const f = REPULSION / d2;
              const d = Math.sqrt(d2);
              const fx = (dx / d) * f, fy = (dy / d) * f;
              a.vx += fx; a.vy += fy;
              b.vx -= fx; b.vy -= fy;
            }
          }
          for (const l of links) {
            const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - LINK_LEN) * LINK_K;
            const fx = (dx / d) * f, fy = (dy / d) * f;
            l.s.vx += fx; l.s.vy += fy;
            l.t.vx -= fx; l.t.vy -= fy;
          }
          const cx2 = cssW / 2, cy2 = cssH / 2;
          for (const n of arr) {
            n.vx += (cx2 - n.x) * CENTER_K;
            n.vy += (cy2 - n.y) * CENTER_K;
            n.vx *= DAMPING; n.vy *= DAMPING;
            if (n.fx !== undefined && n.fy !== undefined) { n.x = n.fx; n.y = n.fy; }
            else { n.x += n.vx; n.y += n.vy; }
          }
        }

        function tick() {
          if (cancelled) return;
          step();
          paint();
          raf = requestAnimationFrame(tick);
        }
        // İlk frame'i hemen çiz ki resize fit sonrası boş canvas görünmesin
        paint();
        raf = requestAnimationFrame(tick);

        // Resize handling — ResizeObserver, per-tick yerine event-driven.
        // Boyut değişince anında applyResize + paint → black flash yok.
        ro = new ResizeObserver(() => {
          applyResize();
          paint();
        });
        ro.observe(canvas);
        cleanups.push(() => ro?.disconnect());
      } catch (e) {
        setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const fn of cleanups) { try { fn(); } catch { /* ignore */ } }
    };
  }, [slug]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/vaults/${slug}`} className="text-xs text-neutral-400 hover:text-orange-400">← Dosyalar</Link>
          <h1 className="text-base font-semibold">{slug} · graph</h1>
          {stats && <span className="text-xs text-neutral-500">{stats.nodes} node · {stats.edges} edge</span>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(COLORS).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 text-neutral-400">
              <span className="h-2 w-2 rounded-full" style={{ background: v }} />{k}
            </span>
          ))}
        </div>
      </header>
      <div className="relative flex-1">
        {error && <p className="absolute left-4 top-4 rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400">{error}</p>}
        <canvas ref={canvasRef} className="block h-full w-full cursor-grab" />
      </div>
    </div>
  );
}
