"use client";
import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";

type Status = "connecting" | "watching" | "takeover" | "closed" | "error";

export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [mode, setMode] = useState<"watch" | "takeover">("watch");
  const [info, setInfo] = useState<{ subscribers?: number; inputOwner?: string }>({});

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit")
      ]);
      // @ts-expect-error css
      await import("@xterm/xterm/css/xterm.css");

      const term = new Terminal({
        fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: true, convertEol: true
      });
      termRef.current = term;
      const fit = new FitAddon();
      term.loadAddon(fit);
      if (containerRef.current) { term.open(containerRef.current); fit.fit(); }

      const tokenRes = await fetch("/api/proxy/token");
      if (!tokenRes.ok) { setStatus("error"); term.writeln("\x1b[31m[Altaris] auth required\x1b[0m"); return; }
      const { token, wsBase } = await tokenRes.json();

      const path = mode === "takeover" ? "/ws/pty/takeover" : "/ws/pty/watch";
      const url = new URL(`${wsBase.replace(/^http/, "ws")}${path}`);
      url.searchParams.set("session", id);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus(mode === "takeover" ? "takeover" : "watching");
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" || msg.type === "err") term.write(msg.data);
          else if (msg.type === "attached") {
            term.writeln(`\x1b[2m[Altaris] attached as ${msg.mode} · ${msg.subscribers} subscriber(s)\x1b[0m`);
            setInfo({ subscribers: msg.subscribers });
          }
          else if (msg.type === "watcher_joined") {
            term.writeln(`\x1b[2m[Altaris] ${msg.payload?.user} joined as ${msg.payload?.mode} (${msg.payload?.count})\x1b[0m`);
            setInfo(i => ({ ...i, subscribers: msg.payload?.count }));
          }
          else if (msg.type === "watcher_left") {
            term.writeln(`\x1b[2m[Altaris] ${msg.payload?.user} left (${msg.payload?.count})\x1b[0m`);
            setInfo(i => ({ ...i, subscribers: msg.payload?.count }));
          }
          else if (msg.type === "input_owner_changed") {
            term.writeln(`\x1b[33m[Altaris] input owner → ${msg.payload?.user}\x1b[0m`);
            setInfo(i => ({ ...i, inputOwner: msg.payload?.user }));
          }
          else if (msg.type === "error") term.writeln(`\x1b[31m[Altaris] ${msg.message}\x1b[0m`);
        } catch {}
      };
      ws.onclose = () => { setStatus("closed"); term.writeln("\r\n\x1b[2m[Altaris] connection closed\x1b[0m"); };
      ws.onerror = () => setStatus("error");

      const onData = term.onData(d => {
        if (mode === "takeover" && ws.readyState === WebSocket.OPEN) ws.send(d);
      });
      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        onData.dispose(); ws.close(); term.dispose();
      };
    })();

    return () => cleanup?.();
  }, [id, mode]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/admin/sessions/${id}`} className="text-xs text-neutral-400 hover:text-orange-400">← Detay</Link>
          <h1 className="text-base font-semibold">Canlı oturum izleme</h1>
          <span className="text-xs font-mono text-neutral-500">{id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">{info.subscribers ?? "—"} subscriber</span>
          {info.inputOwner && <span className="rounded bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-300">input: {info.inputOwner}</span>}
          <span className={
            status === "watching" ? "text-xs text-emerald-400"
            : status === "takeover" ? "text-xs text-orange-400"
            : status === "error" ? "text-xs text-red-400"
            : "text-xs text-neutral-500"
          }>● {status}</span>
          <button
            onClick={() => setMode(m => m === "watch" ? "takeover" : "watch")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              mode === "takeover"
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            }`}
          >
            {mode === "watch" ? "Takeover" : "Watch only'e geç"}
          </button>
        </div>
      </header>
      <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
    </div>
  );
}
