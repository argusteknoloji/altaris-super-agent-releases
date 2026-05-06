"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Vault = { id: string; slug: string; name: string };

/**
 * Terminal — kullanıcı önce hangi vault'ta açacağını seçer, sonra orada
 * çalışan bir shell + Altaris CLI hazır. Vault'siz mod (host shell) da var.
 */
export default function TerminalPage() {
  const [vaults, setVaults] = useState<Vault[] | null>(null);
  const [active, setActive] = useState<{ vault: string | null; mode: "altaris" | "shell" } | null>(null);

  useEffect(() => {
    // /api/proxy/vaults catch-all `[...path]` boş path kabul etmiyor → 404
    // dönüyordu ve "Vault yok" gösteriliyordu. Doğru endpoint: vaults-root.
    fetch("/api/proxy/vaults-root", { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        // API tenant-scope edilmiş bir liste döner (admin → tüm tenant
        // vault'ları, normal kullanıcı → kendi tenant'ınınkileri). Hem array
        // hem {vaults:[...]} formatına tolerant ol.
        const list = Array.isArray(data) ? data : (data?.vaults ?? []);
        setVaults(list);
      })
      .catch(() => setVaults([]));
  }, []);

  if (!active) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-semibold">Terminal</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Hangi vault'ta terminal açılsın? Altaris CLI o vault'un dizininde başlar.
        </p>

        <div className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Vault</h2>
          {vaults === null && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
          {vaults && vaults.length === 0 && (
            <p className="rounded border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
              Vault yok. <Link href="/vaults" className="underline text-orange-400">Önce bir vault yarat</Link>.
            </p>
          )}
          {vaults && vaults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {vaults.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActive({ vault: v.slug, mode: "altaris" })}
                  className="group flex items-center justify-between rounded border border-neutral-700 bg-neutral-900/40 px-4 py-3 text-left hover:border-orange-500/50 hover:bg-neutral-900"
                >
                  <span>
                    <span className="block text-sm text-neutral-100">📂 {v.name}</span>
                    <span className="block text-[11px] font-mono text-neutral-500">{v.slug}</span>
                  </span>
                  <span className="text-xs text-orange-400 opacity-0 group-hover:opacity-100">aç →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-4">
          <p className="text-[11px] text-neutral-500">
            Vault'tan bağımsız host shell ister misin?
            <button
              onClick={() => setActive({ vault: null, mode: "shell" })}
              className="ml-2 underline text-neutral-400 hover:text-neutral-200"
            >
              Düz shell aç
            </button>
          </p>
        </div>
      </main>
    );
  }

  return <TerminalView vault={active.vault} mode={active.mode} onExit={() => setActive(null)} />;
}

function TerminalView({ vault, mode, onExit }: { vault: string | null; mode: "altaris" | "shell"; onExit: () => void }) {
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

      const url = new URL(`${wsBase.replace(/^http/, "ws")}/ws/pty`);
      url.searchParams.set("command", mode);
      if (vault) url.searchParams.set("vault", vault);
      url.searchParams.set("access_token", token);
      const ws = new WebSocket(url);

      ws.onopen = () => setStatus("ready");
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "out" || msg.type === "err") term.write(msg.data);
          else if (msg.type === "ready") term.writeln(`\x1b[2m[Altaris] ${msg.command} pid=${msg.pid}${vault ? ` · vault=${vault}` : ""}\x1b[0m`);
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
  }, [vault, mode]);

  return (
    <main className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">
            Terminal
            {vault && <span className="ml-2 rounded bg-orange-500/20 px-2 py-0.5 text-xs font-mono text-orange-300">📂 {vault}</span>}
            {!vault && <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">host-shell</span>}
          </h1>
          <p className="text-xs text-neutral-500">
            {vault ? `Vault dizininde Altaris CLI · cd /srv/altaris/vaults/<tenant>/${vault}` : "Sunucu host shell"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={
            status === "ready" ? "text-xs text-emerald-400"
            : status === "error" ? "text-xs text-red-400"
            : "text-xs text-orange-400"
          }>● {status}</span>
          <button
            onClick={onExit}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
          >
            ← Vault değiştir
          </button>
        </div>
      </header>
      <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
    </main>
  );
}
