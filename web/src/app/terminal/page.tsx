"use client";

import { useEffect, useRef, useState } from "react";

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "closed" | "error">("connecting");

  useEffect(() => {
    let term: import("@xterm/xterm").Terminal | null = null;
    let fitAddon: import("@xterm/addon-fit").FitAddon | null = null;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links")
      ]);
      // @ts-expect-error - the xterm.css ships with the package
      await import("@xterm/xterm/css/xterm.css");

      term = new Terminal({
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: true,
        convertEol: true
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }

      // Get fresh access token via proxy
      const tokenRes = await fetch("/api/proxy/token");
      if (!tokenRes.ok) { setStatus("error"); term.writeln("\x1b[31m[Altaris] Auth required.\x1b[0m"); return; }
      const { token, wsBase } = await tokenRes.json();

      const url = new URL(`${wsBase.replace(/^http/, "ws")}/ws/pty`);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus("ready");
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" || msg.type === "err") term?.write(msg.data);
          else if (msg.type === "ready") term?.writeln(`\x1b[2m[Altaris] shell ${msg.shell} pid=${msg.pid}\x1b[0m`);
          else if (msg.type === "error") term?.writeln(`\x1b[31m[Altaris] ${msg.message}\x1b[0m`);
        } catch {}
      };
      ws.onclose = () => { setStatus("closed"); term?.writeln("\r\n\x1b[2m[Altaris] connection closed\x1b[0m"); };
      ws.onerror = () => setStatus("error");

      const onData = term.onData(d => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
      const onResize = () => fitAddon?.fit();
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        onData.dispose();
        ws.close();
        term?.dispose();
      };
    })();

    return () => cleanup?.();
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Altaris Remote Terminal</h1>
          <p className="text-xs text-neutral-500">Sunucu tarafı kabuk · ws/pty</p>
        </div>
        <span className={
          status === "ready" ? "text-xs text-emerald-400"
          : status === "error" ? "text-xs text-red-400"
          : status === "closed" ? "text-xs text-neutral-500"
          : "text-xs text-orange-400"
        }>● {status}</span>
      </header>
      <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
    </main>
  );
}
