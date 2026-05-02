"use client";
import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";

type Status = "connecting" | "watching" | "takeover" | "closed" | "error";

export default function RemoteControlViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const termRef      = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [mode,   setMode]   = useState<"watch" | "takeover">("watch");
  const [debugCount, setDebugCount] = useState(0);
  const [watchLock, setWatchLock] = useState<string | null>(null);

  useEffect(() => {
    // Strict-mode safe: cancel async setup mid-flight so the second invocation
    // doesn't race a half-attached terminal into the DOM.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit")
      ]);
      // @ts-expect-error css side-effect
      await import("@xterm/xterm/css/xterm.css");
      if (cancelled) return;

      // If a previous invocation managed to attach a terminal before being
      // cancelled, scrub the leftover DOM so we don't render twice.
      if (containerRef.current) containerRef.current.innerHTML = "";

      const term = new Terminal({
        fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: true, convertEol: true, scrollback: 5000
      });
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      if (containerRef.current) { term.open(containerRef.current); fit.fit(); }

      const tokenRes = await fetch("/api/proxy/token");
      if (cancelled) { term.dispose(); termRef.current = null; return; }
      if (!tokenRes.ok) { setStatus("error"); term.writeln("\x1b[31m[Altaris] auth required\x1b[0m"); return; }
      const { token, wsBase } = await tokenRes.json();
      if (cancelled) { term.dispose(); termRef.current = null; return; }

      const url = new URL(`${wsBase.replace(/^http/, "ws")}/ws/remote-control/attach`);
      url.searchParams.set("session", id);
      url.searchParams.set("mode", mode);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { try { ws.close(); } catch {} return; }
        setStatus(mode === "takeover" ? "takeover" : "watching");
        if (mode === "takeover") requestAnimationFrame(() => term.focus());
      };
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" && typeof msg.data === "string") term.write(msg.data);
          else if (msg.type === "info") {
            if (msg.kind === "watch_locked") {
              setWatchLock(msg.text ?? "watch-only — Takeover gerek");
              setTimeout(() => setWatchLock(null), 3000);
            } else {
              term.writeln(`\r\n\x1b[2m[Altaris] ${msg.text}\x1b[0m`);
            }
          }
          else if (msg.type === "error") term.writeln(`\r\n\x1b[31m[Altaris] ${msg.message}\x1b[0m`);
        } catch {}
      };
      ws.onclose = () => {
        if (cancelled) return;
        setStatus("closed");
        term.writeln("\r\n\x1b[2m[Altaris] connection closed\x1b[0m");
      };
      ws.onerror = () => { if (!cancelled) setStatus("error"); };

      const onData = term.onData(d => {
        if (mode !== "takeover") return;
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "in", data: d }));
        setDebugCount(c => c + 1);
        // Per-keystroke console.log kaldırıldı — yüksek frekansta
        // DevTools console queue'sunu doldurup görsel takılmaya yol açıyordu.
        // Debug isteyen ?debug=1 query param ile aktif edebilir.
        if (typeof window !== "undefined" && window.location.search.includes("debug=1")) {
          // eslint-disable-next-line no-console
          console.debug("[remote-control] sent in", JSON.stringify(d));
        }
      });

      // Window resize → refit xterm cells. Send the new dimensions to the
      // broker so the publisher CLI re-layouts (Ink reads process.stdout.columns).
      const onResize = () => {
        fit.fit();
        if (mode === "takeover" && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      };
      window.addEventListener("resize", onResize);
      // Also push initial dimensions once the WS opens (publisher's TUI sized
      // for its host stdout, which usually differs from the viewer's window).
      if (mode === "takeover") {
        const initialResize = () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        };
        if (ws.readyState === WebSocket.OPEN) initialResize();
        else ws.addEventListener("open", initialResize, { once: true });
      }

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        try { onData.dispose(); } catch {}
        try { ws.close(); } catch {}
        try { term.dispose(); } catch {}
        if (containerRef.current) containerRef.current.innerHTML = "";
        termRef.current = null;
        wsRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, mode]);

  function requestTakeover() { setMode("takeover"); }
  function dropToWatch() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "release" }));
    }
    setMode("watch");
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/remote-control" className="text-xs text-neutral-400 hover:text-orange-400">← Liste</Link>
          <h1 className="text-base font-semibold">Remote Control</h1>
          <span className="text-xs font-mono text-neutral-500">{id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={
            status === "watching" ? "text-xs text-emerald-400"
            : status === "takeover" ? "text-xs text-orange-400"
            : status === "error" ? "text-xs text-red-400"
            : "text-xs text-neutral-500"
          }>● {status}</span>
          <span className="text-xs text-neutral-500">{debugCount} ↑</span>
          {mode === "watch" ? (
            <button onClick={requestTakeover} className="rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600">
              Takeover
            </button>
          ) : (
            <button onClick={dropToWatch} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
              Watch only'e geç
            </button>
          )}
        </div>
      </header>

      {mode === "takeover" && (
        <div className="flex items-center justify-between border-b border-orange-500/30 bg-orange-500/10 px-6 py-1.5 text-xs">
          <span className="text-orange-300">⌨ Takeover aktif — siyah terminal alanına tıkla, klavyeden yaz · her keystroke sağ üstteki sayaçta artar</span>
          <button onClick={() => termRef.current?.focus()} className="rounded border border-orange-500/40 px-2 py-0.5 text-orange-200 hover:bg-orange-500/20">
            Odakla
          </button>
        </div>
      )}

      {watchLock && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-6 py-1.5 text-xs text-yellow-300">
          🔒 {watchLock} — şu an watch modundasın, yazmak için "Takeover"a bas.
        </div>
      )}

      <div
        ref={containerRef}
        onClick={() => termRef.current?.focus()}
        className="flex-1 cursor-text bg-[#0a0a0a] p-3"
      />
    </div>
  );
}
