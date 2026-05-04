"use client";

import { useEffect, useRef, useState } from "react";

/**
 *  CLI stream-json event'lerini xterm.js'de okunaklı render eder.
 *  Each event tek satırlık JSON: {type:'system'|'assistant'|'tool_use'|'tool_result'|'result', ...}
 *  Renkli badge + kısa özet, full JSON'i değil.
 */
function renderCliEvent(term: import("@xterm/xterm").Terminal, raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (!trimmed.startsWith("{")) {
    // JSON değil — düz text (CLI banner, stderr vb), ham yaz
    term.write(raw);
    return;
  }
  try {
    const e = JSON.parse(trimmed) as { type?: string; subtype?: string; message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> }; tool_use_id?: string; content?: unknown; result?: string; is_error?: boolean };
    const t = e.type;
    if (t === "system") {
      term.writeln(`\x1b[2m\x1b[36m▸ system\x1b[0m \x1b[2m${e.subtype ?? ""}\x1b[0m`);
    } else if (t === "assistant" && e.message?.content) {
      for (const part of e.message.content) {
        if (part.type === "text" && part.text) {
          term.write(`\x1b[37m${part.text}\x1b[0m`);
        } else if (part.type === "tool_use" && part.name) {
          const inp = part.input ? JSON.stringify(part.input).slice(0, 80) : "";
          term.writeln(`\r\n\x1b[36m⚙ ${part.name}\x1b[0m \x1b[2m${inp}${inp.length >= 80 ? "…" : ""}\x1b[0m`);
        } else if (part.type === "thinking" && (part as { thinking?: string }).thinking) {
          term.writeln(`\r\n\x1b[2m\x1b[33m🧠 ${(part as { thinking?: string }).thinking?.slice(0, 200) ?? ""}\x1b[0m`);
        }
      }
    } else if (t === "user" && e.message?.content) {
      // Tool result genelde 'user' tipinde gelir
      for (const part of e.message.content) {
        if (part.type === "tool_result") {
          const txt = typeof (part as { content?: string }).content === "string"
            ? (part as { content?: string }).content!
            : "";
          const preview = txt.slice(0, 200).replace(/\n/g, " ");
          term.writeln(`  \x1b[2m↳ ${preview}${txt.length > 200 ? "…" : ""}\x1b[0m`);
        }
      }
    } else if (t === "result") {
      const ok = !e.is_error;
      const tag = ok ? "\x1b[32m✓ done\x1b[0m" : "\x1b[31m✗ error\x1b[0m";
      term.writeln(`\r\n${tag}`);
    }
  } catch {
    // JSON parse fail — ham göster
    term.write(raw);
  }
}

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

      // WS URL — /api/proxy/token endpoint hem accessToken hem wsBase döner
      // (remote-control viewer ile aynı pattern, NEXT_PUBLIC_API_BASE bağımsız)
      const tokenRes = await fetch("/api/proxy/token", { cache: "no-store" }).catch(() => null);
      if (!tokenRes || !tokenRes.ok) {
        setStatus("error");
        return;
      }
      const { token, wsBase } = await tokenRes.json() as { token: string; wsBase: string };
      const url = new URL(`${wsBase.replace(/^http/, "ws")}/ws/pty/watch`);
      url.searchParams.set("session", sessionId);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { if (!cancelled) setStatus("live"); };
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" && typeof msg.data === "string") {
            // CLI stream-json çıktısı: her satır JSON event. İnsan okunaklı render
            renderCliEvent(term, msg.data);
          }
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
