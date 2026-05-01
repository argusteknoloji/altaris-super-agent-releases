import { useEffect, useRef, useState } from "react";

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
      // @ts-expect-error css
      await import("@xterm/xterm/css/xterm.css");

      const term = new Terminal({
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 13,
        theme: { background: "#0a0a0a", foreground: "#e5e5e5", cursor: "#f97316" },
        cursorBlink: true, convertEol: true
      });
      const fit = new FitAddon();
      term.loadAddon(fit); term.loadAddon(new WebLinksAddon());
      if (containerRef.current) { term.open(containerRef.current); fit.fit(); }

      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      try {
        await invoke("terminal_open");
        setStatus("ready");
        term.writeln("\x1b[2m[Altaris] terminal ready\x1b[0m\r\n");
      } catch (e) {
        setStatus("error");
        term.writeln(`\x1b[31m[Altaris] ${e}\x1b[0m`);
        return;
      }

      const u1 = await listen<{ data: string }>("term:out", e => term.write(e.payload.data));
      const onData = term.onData(d => invoke("terminal_write", { data: d }));
      const onResize = () => fit.fit();
      window.addEventListener("resize", onResize);

      cleanup = () => {
        u1(); onData.dispose();
        window.removeEventListener("resize", onResize);
        invoke("terminal_close").catch(() => {});
        term.dispose();
      };
    })();
    return () => cleanup?.();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <h2 className="text-base font-semibold">Terminal</h2>
        <span className={
          status === "ready" ? "text-xs text-emerald-400"
          : status === "error" ? "text-xs text-red-400"
          : "text-xs text-orange-400"
        }>● {status}</span>
      </header>
      <div ref={containerRef} className="flex-1 bg-[#0a0a0a] p-3" />
    </div>
  );
}
