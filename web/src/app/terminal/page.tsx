"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sade sunucu tarafı shell — bu sayfa ARTIK Altaris agent oturumu açmıyor.
 * Agent oturumlarını lokalde `altaris` ile başlat, web'den izlemek için
 * /remote-control sayfasını kullan.
 */
export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "closed" | "error">("connecting");

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links")
      ]);
      // @ts-expect-error css side-effect
      await import("@xterm/xterm/css/xterm.css");

      const term = new Terminal({
        fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: true, convertEol: true, scrollback: 5000
      });
      const fit = new FitAddon();
      term.loadAddon(fit); term.loadAddon(new WebLinksAddon());
      if (containerRef.current) { term.open(containerRef.current); fit.fit(); }

      const tokenRes = await fetch("/api/proxy/token");
      if (!tokenRes.ok) { setStatus("error"); term.writeln("\x1b[31m[Altaris] auth required\x1b[0m"); return; }
      const { token, wsBase } = await tokenRes.json();

      // command=shell zorla — bu sayfa düz shell, agent değil.
      const url = new URL(`${wsBase.replace(/^http/, "ws")}/ws/pty`);
      url.searchParams.set("command", "shell");
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);

      ws.onopen = () => setStatus("ready");
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" || msg.type === "err") term.write(msg.data);
          else if (msg.type === "ready") term.writeln(`\x1b[2m[Altaris] ${msg.command} pid=${msg.pid}\x1b[0m`);
          else if (msg.type === "error") term.writeln(`\x1b[31m[Altaris] ${msg.message}\x1b[0m`);
        } catch {}
      };
      ws.onclose = () => { setStatus("closed"); term.writeln("\r\n\x1b[2m[Altaris] connection closed\x1b[0m"); };
      ws.onerror = () => setStatus("error");

      const onData = term.onData(d => { if (ws.readyState === WebSocket.OPEN) ws.send(d); });
      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        onData.dispose(); ws.close(); term.dispose();
      };
    })();
    return () => cleanup?.();
  }, []);

  return (
    <main className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Sunucu Terminal</h1>
          <p className="text-xs text-neutral-500">
            Düz host shell · Agent için lokal <code className="font-mono">altaris</code> + <a className="text-orange-400 hover:underline" href="/remote-control">/remote-control</a>
          </p>
        </div>
        <span className={
          status === "ready" ? "text-xs text-emerald-400"
          : status === "error" ? "text-xs text-red-400"
          : "text-xs text-orange-400"
        }>● {status}</span>
      </header>
      <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
    </main>
  );
}
