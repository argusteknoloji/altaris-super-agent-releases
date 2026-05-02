import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Identity = { email?: string; tenantSlug?: string; expiresAt?: number };
type Me = {
  email?: string;
  tenantSlug?: string;
  roles?: string[];
  isPlatformAdmin?: boolean;
  isTenantAdmin?: boolean;
  capabilities?: string[];
};

// Friendly toast — chat:error event'leri ve genel error sinyalleri için.
type Toast = { id: number; level: "error" | "info"; text: string };

export default function App() {
  const nav = useNavigate();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(level: "error" | "info", text: string) {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, level, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }

  useEffect(() => {
    (async () => {
      try {
        const id = await invoke<Identity | null>("whoami");
        if (!id) { nav("/login"); return; }
        setIdentity(id);
        // Capabilities + roles backend'den çek (API up değilse sessizce atla)
        try {
          const m = await invoke<Me>("api_get", { path: "/api/v1/me" });
          setMe(m);
        } catch (e) {
          // Auth fail yoksa (token expired vb) backend down — başka bir signal
          const msg = String(e);
          if (msg.includes("401") || msg.includes("Not logged in")) { nav("/login"); return; }
          pushToast("info", `Backend bilgisi alınamadı: ${msg}`);
        }
      } catch {
        nav("/login");
      }
    })();
  }, [nav]);

  // chat:error event'lerini yakalayıp toast olarak göster.
  useEffect(() => {
    const unlistens: Array<() => void> = [];
    listen<{ message?: string }>("chat:error", e => {
      const raw = e.payload?.message ?? "Bilinmeyen chat hatası";
      // missing_capability JSON'u içerirse bunu çıkar
      const capMatch = raw.match(/missing_capability['":\s]+([\w.]+)/);
      const text = capMatch
        ? `Bu işlem için '${capMatch[1]}' yetkisi gerekiyor — tenant adminine danış.`
        : raw;
      pushToast("error", text);
    }).then(u => unlistens.push(u));
    return () => unlistens.forEach(u => u());
  }, []);

  // Tauri auto-updater: app açıldığında tek seferlik check, yeni sürüm varsa
  // dialog → kabul ederse indir + yeniden başlat. tauri.conf.json'daki updater
  // endpoint'i (releases/latest/download/latest.json) Tauri tarafından çekilir,
  // imza TAURI_UPDATER_PRIVATE_KEY ile production'da doğrulanır.
  useEffect(() => {
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) return;
        const ok = window.confirm(
          `Yeni Altaris sürümü mevcut: ${update.version}\n\n` +
          `Yüklemek ve uygulamayı yeniden başlatmak ister misin?`
        );
        if (!ok) return;
        pushToast("info", `İndiriliyor: ${update.version}…`);
        await update.downloadAndInstall();
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (e) {
        // Sessizce skip — endpoint down, network yok, vb. Console'a logla.
        console.debug("[updater] check failed:", e);
      }
    })();
  }, []);

  const has = (cap: string) => me?.capabilities?.includes(cap) ?? true;   // bilinmiyorsa göster (defensive)

  return (
    <div className="flex h-full">
      <aside className="flex w-56 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-4">
        <div className="mb-6 px-2">
          <h1 className="text-base font-semibold tracking-tight">Altaris</h1>
          <p className="text-xs text-neutral-500">{identity?.email ?? "—"}</p>
          <p className="text-xs text-neutral-600">{identity?.tenantSlug ? `tenant: ${identity.tenantSlug}` : ""}</p>
          {me?.roles && me.roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {me.roles.map(r => (
                <span key={r} className={
                  "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                  (r === "platform_admin" ? "bg-red-500/15 text-red-300"
                  : r === "tenant_admin"  ? "bg-orange-500/15 text-orange-300"
                  :                          "bg-emerald-500/15 text-emerald-300")
                }>{r.replace("tenant_", "")}</span>
              ))}
            </div>
          )}
        </div>
        <nav className="space-y-1 text-sm">
          {has("chat.use")         && <NavItem to="/chat"     label="Chat" />}
          {has("vault.read")       && <NavItem to="/vaults"   label="Vaults" />}
          {true                    && <NavItem to="/code"     label="Code" />}
          {true                    && <NavItem to="/terminal" label="Terminal" />}
          {has("remote_control.view") && <NavItem to="/remote-control" label="🎥 Remote" />}
        </nav>
        <div className="mt-auto pt-4">
          {me?.capabilities && (
            <p className="mb-2 px-2 text-[10px] text-neutral-600" title={me.capabilities.join(", ")}>
              {me.capabilities.length} yetki
            </p>
          )}
          <button
            onClick={async () => { await invoke("logout"); nav("/login"); }}
            className="w-full rounded-md border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900"
          >
            Çıkış
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>

      {/* Toast container */}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-2xl backdrop-blur " +
              (t.level === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-neutral-700 bg-neutral-900/90 text-neutral-200")
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-md px-3 py-2 ${isActive ? "bg-orange-500/10 text-orange-400" : "text-neutral-300 hover:bg-neutral-900"}`
      }
    >
      {label}
    </NavLink>
  );
}
