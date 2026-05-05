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

        // Layout settle bekle — flex parent ilk frame'lerde 0 boyut verebilir
        let waitFrames = 0;
        let bbox = canvas.getBoundingClientRect();
        while ((bbox.width === 0 || bbox.height === 0) && waitFrames < 30) {
          await new Promise<void>(r => requestAnimationFrame(() => r()));
          if (cancelled) return;
          bbox = canvas.getBoundingClientRect();
          waitFrames++;
        }
        if (bbox.width === 0 || bbox.height === 0) {
          setError("Canvas boyutu alınamadı");
          return;
        }

        let cssW = bbox.width, cssH = bbox.height;
        const applyResize = () => {
          const r = canvas.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const tw = Math.round(r.width * dpr);
          const th = Math.round(r.height * dpr);
          if (canvas.width !== tw || canvas.height !== th) {
            canvas.width = tw;
            canvas.height = th;
          }
          cssW = r.width; cssH = r.height;
        };
        applyResize();

        // ── World-coord simulation (canvas clamp YOK; pan/zoom view ile yapılıyor)
        const N = data.nodes.length;
        const R0 = Math.sqrt(Math.max(1, N)) * 28;  // initial spread radius
        const nodeMap = new Map<string, Sim>();
        for (const n of data.nodes) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * R0;
          nodeMap.set(n.id, {
            node: n, degree: 0,
            x: Math.cos(a) * r, y: Math.sin(a) * r,
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
        const arr = Array.from(nodeMap.values());

        // ── Force constants (d3-style alpha cooling — sim sonsuza kadar koşmaz)
        const REPULSION      = 900;
        const REPULSION_CAP  = 80;     // node fly-away guard
        const LINK_LEN       = 60;
        const LINK_K         = 0.45;
        const CENTER_K       = 0.025;
        const VELOCITY_DECAY = 0.55;
        const ALPHA_DECAY    = 1 - Math.pow(0.001, 1 / 280);  // ~280 tick'te ~0.001
        const ALPHA_MIN      = 0.005;
        let alpha = 1;

        const radiusOf = (n: Sim) => 3 + Math.min(22, Math.sqrt(n.degree) * 2.4);

        // ── View transform (pan + zoom)
        const view = { tx: cssW / 2, ty: cssH / 2, scale: 1 };
        let didFinalFit = false;

        function computeBBox() {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of arr) {
            if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y;
            if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y;
          }
          if (!Number.isFinite(minX)) return null;
          return { minX, minY, maxX, maxY };
        }
        function fitView(maxScale = 1.4, padPx = 80): boolean {
          const b = computeBBox();
          if (!b) return false;
          // cssW/cssH henüz set olmadıysa pad'lemeyi anlamlı tutamayız → atla
          if (!(cssW > padPx * 2 + 10) || !(cssH > padPx * 2 + 10)) return false;
          const w = Math.max(1, b.maxX - b.minX);
          const h = Math.max(1, b.maxY - b.minY);
          const sx = (cssW - padPx * 2) / w;
          const sy = (cssH - padPx * 2) / h;
          const s = Math.max(0.05, Math.min(maxScale, Math.min(sx, sy)));
          const tx = cssW / 2 - ((b.minX + b.maxX) / 2) * s;
          const ty = cssH / 2 - ((b.minY + b.maxY) / 2) * s;
          // Defansif: NaN/Infinity asla view'a girmesin (aksi halde tüm node'lar
          // ekran dışına kayar → black screen)
          if (!Number.isFinite(s) || !(s > 0)) return false;
          if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
          view.scale = s;
          view.tx = tx;
          view.ty = ty;
          return true;
        }

        // ── Mouse: drag node OR pan empty space; wheel zoom anchored at cursor
        let dragging: Sim | null = null;
        let panning = false;
        let lastSx = 0, lastSy = 0;

        const screenToWorld = (sx: number, sy: number) => ({
          x: (sx - view.tx) / view.scale,
          y: (sy - view.ty) / view.scale
        });

        const pickAt = (sx: number, sy: number): Sim | null => {
          const w = screenToWorld(sx, sy);
          const tol = 5 / view.scale;
          let pick: Sim | null = null;
          let bestD = Infinity;
          for (const n of arr) {
            const dx = n.x - w.x, dy = n.y - w.y;
            const d2 = dx * dx + dy * dy;
            const r = radiusOf(n) + tol;
            if (d2 < r * r && d2 < bestD) { bestD = d2; pick = n; }
          }
          return pick;
        };

        const onDown = (ev: MouseEvent) => {
          const r = canvas.getBoundingClientRect();
          const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
          const hit = pickAt(sx, sy);
          if (hit) {
            dragging = hit;
            const w = screenToWorld(sx, sy);
            hit.fx = w.x; hit.fy = w.y;
            alpha = Math.max(alpha, 0.25);   // reheat: çekildiğinde komşular tekrar yerleşsin
            canvas.style.cursor = "grabbing";
          } else {
            panning = true;
            lastSx = sx; lastSy = sy;
            canvas.style.cursor = "grabbing";
          }
        };
        const onMove = (ev: MouseEvent) => {
          const r = canvas.getBoundingClientRect();
          const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
          if (dragging) {
            const w = screenToWorld(sx, sy);
            dragging.fx = w.x; dragging.fy = w.y;
          } else if (panning) {
            view.tx += sx - lastSx;
            view.ty += sy - lastSy;
            lastSx = sx; lastSy = sy;
          }
        };
        const onUp = () => {
          if (dragging) { dragging.fx = undefined; dragging.fy = undefined; }
          dragging = null;
          panning = false;
          canvas.style.cursor = "grab";
        };
        const onWheel = (ev: WheelEvent) => {
          ev.preventDefault();
          const r = canvas.getBoundingClientRect();
          const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
          const w = screenToWorld(sx, sy);
          const factor = Math.exp(-ev.deltaY * 0.0018);
          const ns = Math.min(8, Math.max(0.05, view.scale * factor));
          view.scale = ns;
          view.tx = sx - w.x * ns;
          view.ty = sy - w.y * ns;
        };

        canvas.addEventListener("mousedown", onDown);
        canvas.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });
        cleanups.push(
          () => canvas.removeEventListener("mousedown", onDown),
          () => canvas.removeEventListener("mousemove", onMove),
          () => window.removeEventListener("mouseup", onUp),
          () => canvas.removeEventListener("wheel", onWheel),
        );

        function step() {
          if (alpha < ALPHA_MIN) return;
          // Coulomb repulsion (O(n²); 631 node = ~200K pair/tick)
          for (let i = 0; i < arr.length; i++) {
            const a = arr[i];
            for (let j = i + 1; j < arr.length; j++) {
              const b = arr[j];
              const dx = a.x - b.x, dy = a.y - b.y;
              let d2 = dx * dx + dy * dy;
              if (d2 < 0.01) d2 = 0.01;
              const d = Math.sqrt(d2);
              let f = (REPULSION * alpha) / d2;
              if (f > REPULSION_CAP) f = REPULSION_CAP;
              const fx = (dx / d) * f, fy = (dy / d) * f;
              a.vx += fx; a.vy += fy;
              b.vx -= fx; b.vy -= fy;
            }
          }
          // Link spring (Hooke's law, hedef uzunluk LINK_LEN)
          for (const l of links) {
            const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - LINK_LEN) * LINK_K * alpha;
            const fx = (dx / d) * f, fy = (dy / d) * f;
            l.s.vx += fx; l.s.vy += fy;
            l.t.vx -= fx; l.t.vy -= fy;
          }
          // Mild center gravity (world origin'e doğru — graph kümesi merkezde dursun)
          for (const n of arr) {
            n.vx += (-n.x) * CENTER_K * alpha;
            n.vy += (-n.y) * CENTER_K * alpha;
            n.vx *= VELOCITY_DECAY;
            n.vy *= VELOCITY_DECAY;
            if (n.fx !== undefined && n.fy !== undefined) {
              n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0;
            } else {
              n.x += n.vx; n.y += n.vy;
            }
            if (!Number.isFinite(n.x)) n.x = 0;
            if (!Number.isFinite(n.y)) n.y = 0;
          }
          // Cooling
          alpha += (0 - alpha) * ALPHA_DECAY;
        }

        function paint() {
          const live = canvasRef.current;
          if (!live || !live.isConnected) { cancelled = true; return; }
          const r = live.getBoundingClientRect();
          const w = r.width, h = r.height;
          if (w <= 0 || h <= 0) return;
          const tw = Math.round(w * dpr), th = Math.round(h * dpr);
          if (live.width !== tw || live.height !== th) {
            live.width = tw; live.height = th;
          }
          cssW = w; cssH = h;
          // Backstop: view bir şekilde NaN/0 olduysa identity'ye düş (black-screen guard)
          if (!(view.scale > 0) || !Number.isFinite(view.tx) || !Number.isFinite(view.ty)) {
            view.scale = 1; view.tx = w / 2; view.ty = h / 2;
          }

          // Background (identity transform)
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx!.fillStyle = "#0a0a0a";
          ctx!.fillRect(0, 0, w, h);

          // World transform → edges + circles draw in world coords
          ctx!.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);

          // Edges — tek path, hızlı
          ctx!.strokeStyle = "rgba(148,163,184,0.22)";
          ctx!.lineWidth = Math.max(0.4, 1 / view.scale);
          ctx!.beginPath();
          for (const l of links) {
            ctx!.moveTo(l.s.x, l.s.y);
            ctx!.lineTo(l.t.x, l.t.y);
          }
          ctx!.stroke();

          // Nodes
          for (const n of arr) {
            const rad = radiusOf(n);
            ctx!.fillStyle = colorFor(n.node.group);
            ctx!.beginPath();
            ctx!.arc(n.x, n.y, rad, 0, Math.PI * 2);
            ctx!.fill();
          }

          // Labels — screen space (zoom-invariant). Yakınlaşmadan SADECE büyük node'lar.
          ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx!.font = "11px ui-monospace, Menlo, monospace";
          ctx!.fillStyle = "#cbd5e1";
          const showAll = view.scale > 1.4;
          const minRadiusForLabel = showAll ? 0 : 9;
          for (const n of arr) {
            const rad = radiusOf(n);
            if (rad < minRadiusForLabel) continue;
            const sx = n.x * view.scale + view.tx;
            const sy = n.y * view.scale + view.ty;
            // Görünür alan dışındakileri atla — büyük graph'larda label maliyetini düşürür
            if (sx < -50 || sy < -50 || sx > cssW + 200 || sy > cssH + 50) continue;
            ctx!.fillText(n.node.label, sx + rad + 3, sy + 4);
          }
        }

        function tick() {
          if (cancelled) return;
          step();
          // Sim DURDUKTAN sonra fit et — alpha < 0.05'te fit edip de sim'in
          // 0.005'e kadar drift etmesi cluster'ı viewport dışına kaydırıyordu
          // (black screen). ALPHA_MIN'de sim donmuş hâldeyken pozisyon stabil.
          if (!didFinalFit && alpha < ALPHA_MIN) {
            if (fitView(1.2, 90)) didFinalFit = true;
          }
          paint();
          raf = requestAnimationFrame(tick);
        }

        // İlk fit — random spread'i de kapsasın ki başlangıçta her şey ekranda olsun
        fitView(1.4, 80);
        paint();
        raf = requestAnimationFrame(tick);

        // ResizeObserver: parent layout değişirse (header lazy-load, sidebar
        // collapse vb.) view eski cssW/cssH'a göre kalıyordu → cluster off-center.
        // Sim oturduysa yeniden fit, henüz oturmadıysa view origin'i adapt et.
        ro = new ResizeObserver(() => {
          const prevW = cssW, prevH = cssH;
          applyResize();
          if (didFinalFit) {
            fitView(1.2, 90);
          } else if (cssW > 0 && cssH > 0 && prevW > 0 && prevH > 0) {
            // Sim hâlâ koşuyor — view'i merkezde tutmak için tx/ty'yi orantıla
            view.tx += (cssW - prevW) / 2;
            view.ty += (cssH - prevH) / 2;
          }
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
          <span className="text-[10px] text-neutral-600">scroll = zoom · drag boş alan = pan · drag node = taşı</span>
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
