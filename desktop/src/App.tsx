import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Identity = { email?: string; tenantSlug?: string; expiresAt?: number };

export default function App() {
  const nav = useNavigate();
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const id = await invoke<Identity | null>("whoami");
        if (!id) nav("/login");
        else setIdentity(id);
      } catch {
        nav("/login");
      }
    })();
  }, [nav]);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-4">
        <div className="mb-6 px-2">
          <h1 className="text-base font-semibold tracking-tight">Altaris</h1>
          <p className="text-xs text-neutral-500">{identity?.email ?? "—"}</p>
          <p className="text-xs text-neutral-600">{identity?.tenantSlug ? `tenant: ${identity.tenantSlug}` : ""}</p>
        </div>
        <nav className="space-y-1 text-sm">
          <NavItem to="/chat" label="Chat" />
          <NavItem to="/code" label="Code" />
          <NavItem to="/terminal" label="Terminal" />
        </nav>
        <div className="mt-auto pt-4">
          <button
            onClick={async () => { await invoke("logout"); nav("/login"); }}
            className="w-full rounded-md border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900"
          >
            Çıkış
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
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
