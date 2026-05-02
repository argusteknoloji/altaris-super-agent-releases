import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Session = {
  id: string;
  title: string;
  provider: string;
  model: string;
  startedAt: string;
  status: string;
  ownerEmail?: string;
  remoteControl?: boolean;
};

type WsInfo = { apiBase: string; accessToken: string };

/**
 * Remote Control viewer — başka bir kullanıcının (veya kendi CLI'inin) yayınlanan
 * altaris session'ına attach olur. Watch modu sadece izler; takeover modu
 * keystroke gönderebilir (admin/owner). xterm.js + WebSocket protokolü:
 *   IN  (server→client): { type: "out", data: "..." }     terminal output
 *                        { type: "owner", userId, email } input owner change
 *                        { type: "notice", text }         system mesaj
 *   OUT (client→server): { type: "in", data: "keystroke" } takeover mode
 */
export default function RemoteControlPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [mode, setMode] = useState<"watch" | "takeover">("watch");
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "closed" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  async function loadSessions() {
    try {
      const list = await invoke<Session[]>("api_get", { path: "/api/v1/remote-control/sessions" });
      setSessions(list ?? []);
    } catch (e) {
      setNotice(`Liste alınamadı: ${e}`);
    }
  }
  useEffect(() => { loadSessions(); const t = setInterval(loadSessions, 5000); return () => clearInterval(t); }, []);

  async function attach(s: Session, m: "watch" | "takeover") {
    if (!containerRef.current) return;
    cleanupRef.current?.();
    setActive(s); setMode(m); setStatus("connecting"); setNotice(null);

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);
    // @ts-expect-error css
    await import("@xterm/xterm/css/xterm.css");

    const term = new Terminal({
      fontFamily: "ui-monospace, Menlo, monospace",
      fontSize: 13,
      theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
      cursorBlink: true, convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    containerRef.current.innerHTML = "";
    term.open(containerRef.current); fit.fit();

    let info: WsInfo;
    try {
      info = await invoke<WsInfo>("ws_connection_info");
    } catch (e) {
      setStatus("error"); setNotice(`Token alınamadı: ${e}`); return;
    }

    // http(s)://host → ws(s)://host dönüşümü
    const wsBase = info.apiBase.replace(/^http/, "ws");
    const url = `${wsBase}/ws/remote-control/attach?session=${encodeURIComponent(s.id)}&mode=${m}&access_token=${encodeURIComponent(info.accessToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("live");
      term.writeln(`\x1b[2m[Altaris] attached to ${s.title} as ${m}\x1b[0m\r\n`);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "out" && typeof msg.data === "string") term.write(msg.data);
        else if (msg.type === "notice") {
          term.writeln(`\r\n\x1b[33m[notice] ${msg.text}\x1b[0m\r\n`);
          setNotice(msg.text);
        } else if (msg.type === "owner") {
          term.writeln(`\r\n\x1b[36m[input owner → ${msg.email ?? msg.userId}]\x1b[0m\r\n`);
        }
      } catch {
        // raw bytes — direkt yaz
        term.write(ev.data);
      }
    };
    ws.onerror = () => { setStatus("error"); setNotice("WebSocket hatası"); };
    ws.onclose = (ev) => {
      setStatus("closed");
      term.writeln(`\r\n\x1b[2m[Altaris] connection closed (${ev.code} ${ev.reason || ""})\x1b[0m`);
    };

    const onData = term.onData((d) => {
      if (m === "takeover" && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "in", data: d }));
      }
    });
    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    cleanupRef.current = () => {
      onData.dispose();
      window.removeEventListener("resize", onResize);
      try { ws.close(1000, "user disconnect"); } catch { }
      term.dispose();
      wsRef.current = null;
    };
  }

  function disconnect() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setActive(null); setStatus("idle"); setNotice(null);
    if (containerRef.current) containerRef.current.innerHTML = "";
  }

  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <div className="flex h-full">
      {/* Session list */}
      <aside className="w-72 border-r border-neutral-800 bg-neutral-950 px-3 py-4 overflow-auto">
        <header className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">Yayınlanan oturumlar</h2>
          <button onClick={loadSessions} className="text-[10px] text-neutral-400 hover:text-orange-400" title="Yenile">↻</button>
        </header>
        {sessions.length === 0 && (
          <p className="px-1 text-xs text-neutral-500">
            Şu anda yayında oturum yok. CLI'da <code className="rounded bg-neutral-900 px-1">altaris remote-control on</code> ile yayınla.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map(s => (
            <li key={s.id}>
              <button
                onClick={() => attach(s, "watch")}
                className={`block w-full rounded-md px-2 py-2 text-left text-xs hover:bg-neutral-900 ${active?.id === s.id ? "bg-orange-500/10" : ""}`}>
                <div className="font-medium text-neutral-200">{s.title}</div>
                <div className="text-[10px] text-neutral-500 font-mono">{s.provider}/{s.model}</div>
                {s.ownerEmail && <div className="text-[10px] text-neutral-600">👤 {s.ownerEmail}</div>}
              </button>
              {active?.id === s.id && (
                <div className="mt-1 flex gap-1 px-2">
                  <button onClick={() => attach(s, "watch")}
                    className={`rounded px-2 py-0.5 text-[10px] ${mode === "watch" ? "bg-blue-500/20 text-blue-300" : "border border-neutral-700 text-neutral-400 hover:bg-neutral-900"}`}>
                    👁 watch
                  </button>
                  <button onClick={() => attach(s, "takeover")}
                    className={`rounded px-2 py-0.5 text-[10px] ${mode === "takeover" ? "bg-orange-500/20 text-orange-300" : "border border-neutral-700 text-neutral-400 hover:bg-neutral-900"}`}>
                    ✋ takeover
                  </button>
                  <button onClick={disconnect}
                    className="ml-auto rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10">
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* Terminal viewport */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
          <div>
            <h2 className="text-base font-semibold">Remote Control</h2>
            {active && (
              <p className="text-[10px] text-neutral-500">
                {active.title} · mode: <span className={mode === "takeover" ? "text-orange-400" : "text-blue-400"}>{mode}</span>
              </p>
            )}
          </div>
          <span className={
            status === "live"      ? "text-xs text-emerald-400"
            : status === "error"   ? "text-xs text-red-400"
            : status === "closed"  ? "text-xs text-neutral-500"
            : status === "connecting" ? "text-xs text-orange-400"
            : "text-xs text-neutral-600"
          }>● {status}</span>
        </header>
        {notice && <div className="border-b border-neutral-800 bg-neutral-900/40 px-6 py-2 text-xs text-amber-300">{notice}</div>}
        <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-neutral-600">Sol panelden bir oturum seç.</p>
          </div>
        )}
      </div>
    </div>
  );
}
