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

    (async () => {
      try {
        const r = await fetch(`/api/proxy/vaults/${slug}/graph`, { cache: "no-store" });
        if (!r.ok) { setError(await r.text()); return; }
        const data = await r.json() as { nodes: Node[]; edges: Edge[] };
        if (cancelled) return;
        setStats({ nodes: data.nodes.length, edges: data.edges.length });

        const canvasNullable = canvasRef.current;
        if (!canvasNullable) return;
        const ctxNullable = canvasNullable.getContext("2d");
        if (!ctxNullable) { setError("Canvas 2D context alinamadi"); return; }
        const canvas = canvasNullable;        // narrow non-null
        const ctx = ctxNullable;
        const dpr = window.devicePixelRatio || 1;
        const fit = () => {
          const w = canvas.clientWidth, h = canvas.clientHeight;
          if (w === 0 || h === 0) return;        // layout henuz settle olmadi — skip
          canvas.width  = w * dpr;
          canvas.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        // ResizeObserver: parent flex layout ilk renderda 0 verebiliyor; observer
        // gercek boyut gelince fit'i tekrar eder.
        const ro = new ResizeObserver(() => fit());
        ro.observe(canvas);
        fit();
        window.addEventListener("resize", fit);

        // Build sim nodes — random initial positions
        const nodeMap = new Map<string, Sim>();
        const cx = canvas.clientWidth / 2;
        const cy = canvas.clientHeight / 2;
        for (const n of data.nodes) {
          nodeMap.set(n.id, {
            node: n, degree: 0,
            x: cx + (Math.random() - 0.5) * 400,
            y: cy + (Math.random() - 0.5) * 400,
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

        // Tiny force-directed layout (no external lib). Good enough up to ~500 nodes.
        const REPULSION = 4500;
        const LINK_LEN  = 90;
        const LINK_K    = 0.04;
        const CENTER_K  = 0.005;
        const DAMPING   = 0.85;

        let dragging: Sim | null = null;
        let mouseX = 0, mouseY = 0;
        canvas.addEventListener("mousedown", ev => {
          const rect = canvas.getBoundingClientRect();
          mouseX = ev.clientX - rect.left;
          mouseY = ev.clientY - rect.top;
          let pick: Sim | null = null;
          let bestD = 16 * 16;
          for (const n of nodeMap.values()) {
            const d = (n.x - mouseX) ** 2 + (n.y - mouseY) ** 2;
            if (d < bestD) { bestD = d; pick = n; }
          }
          if (pick) { dragging = pick; pick.fx = mouseX; pick.fy = mouseY; }
        });
        canvas.addEventListener("mousemove", ev => {
          const rect = canvas.getBoundingClientRect();
          mouseX = ev.clientX - rect.left;
          mouseY = ev.clientY - rect.top;
          if (dragging) { dragging.fx = mouseX; dragging.fy = mouseY; }
        });
        canvas.addEventListener("mouseup", () => {
          if (dragging) { dragging.fx = undefined; dragging.fy = undefined; }
          dragging = null;
        });

        function tick() {
          if (cancelled) return;
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
          // Hooke springs along links
          for (const l of links) {
            const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - LINK_LEN) * LINK_K;
            const fx = (dx / d) * f, fy = (dy / d) * f;
            l.s.vx += fx; l.s.vy += fy;
            l.t.vx -= fx; l.t.vy -= fy;
          }
          const cx2 = canvas.clientWidth / 2, cy2 = canvas.clientHeight / 2;
          for (const n of arr) {
            // Centering pull
            n.vx += (cx2 - n.x) * CENTER_K;
            n.vy += (cy2 - n.y) * CENTER_K;
            n.vx *= DAMPING; n.vy *= DAMPING;
            if (n.fx !== undefined && n.fy !== undefined) { n.x = n.fx; n.y = n.fy; }
            else { n.x += n.vx; n.y += n.vy; }
          }

          // Render
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
          ctx.strokeStyle = "rgba(148,163,184,0.18)";
          ctx.lineWidth = 1;
          for (const l of links) {
            ctx.beginPath();
            ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y);
            ctx.stroke();
          }
          ctx.font = "11px ui-monospace, Menlo, monospace";
          for (const n of arr) {
            const r = 4 + Math.min(8, Math.sqrt(n.degree) * 2.5);
            ctx.fillStyle = colorFor(n.node.group);
            ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#cbd5e1";
            ctx.fillText(n.node.label, n.x + r + 2, n.y + 4);
          }
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);

        // cleanup — NOT effective: async IIFE'nin return'i useEffect tarafindan
        // gormezden gelinir. Aslinda asagidaki outer return calisir. ResizeObserver
        // cleanup'i icin window'a disconnect helper ekliyoruz.
        (window as unknown as { __graphCleanup?: () => void }).__graphCleanup = () => {
          ro.disconnect();
          window.removeEventListener("resize", fit);
        };
      } catch (e) {
        setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const cleanup = (window as unknown as { __graphCleanup?: () => void }).__graphCleanup;
      if (cleanup) cleanup();
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
