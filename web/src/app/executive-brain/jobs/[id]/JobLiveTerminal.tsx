"use client";

import { useEffect, useRef, useState } from "react";

/**
 *  Read-only xterm.js viewer attached to a PtySession via /ws/pty/watch.
 *  Reuses the same WS protocol as the remote-control viewer:
 *    server → client: { type: "out", data: "..." } stdout chunks
 *                     { type: "info"|"error", text: "..." }
 *  Client only listens; no input forwarding (takeover comes in v2).
 */
export default function JobLiveTerminal({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "closed" | "error">("connecting");

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      // @ts-expect-error css side-effect
      await import("@xterm/xterm/css/xterm.css");
      if (cancelled || !containerRef.current) return;

      // Eski mount artık varsa scrub et (Next route transition + StrictMode)
      containerRef.current.innerHTML = "";
      const term = new Terminal({
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 12,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: false,
        cursorStyle: "underline",
        convertEol: true,
        scrollback: 8000,
        disableStdin: true,        // read-only
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      // WS URL — token query param ile auth (proxy/cookie değil, direct WS)
      const tokenRes = await fetch("/api/auth/token", { cache: "no-store" }).catch(() => null);
      const token = tokenRes?.ok ? (await tokenRes.json()).accessToken : "";
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const apiHost = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/^https?:\/\//, "")
        || window.location.host.replace(/^([^.]+)/, "api.$1");
      const url = new URL(`${proto}//${apiHost}/ws/pty/watch`);
      url.searchParams.set("session", sessionId);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { if (!cancelled) setStatus("live"); };
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" && typeof msg.data === "string") term.write(msg.data);
          else if (msg.type === "info") term.writeln(`\r\n\x1b[2m[${msg.text}]\x1b[0m`);
          else if (msg.type === "error") term.writeln(`\r\n\x1b[31m[${msg.message}]\x1b[0m`);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!cancelled) {
          setStatus("closed");
          term.writeln("\r\n\x1b[2m[bağlantı kapandı]\x1b[0m");
        }
      };
      ws.onerror = () => { if (!cancelled) setStatus("error"); };

      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        try { ws.close(); } catch { /* ignore */ }
        try { term.dispose(); } catch { /* ignore */ }
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
    })();

    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, [sessionId]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[280px] w-full overflow-hidden rounded border border-neutral-800 bg-[#0a0a0a]"
      />
      {status === "connecting" && (
        <p className="mt-2 text-[11px] text-neutral-500">Bağlanılıyor…</p>
      )}
      {status === "error" && (
        <p className="mt-2 text-[11px] text-red-400">Bağlantı hatası — job çalışmıyor olabilir.</p>
      )}
    </div>
  );
}
