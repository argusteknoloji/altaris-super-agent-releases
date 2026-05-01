import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open as openShell } from "@tauri-apps/plugin-shell";

type DeviceFlow = { user_code: string; verification_uri_complete: string; verification_uri: string };

export default function LoginPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<DeviceFlow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startLogin() {
    setBusy(true); setError(null);
    try {
      const f = await invoke<DeviceFlow>("login_start");
      setFlow(f);
      await openShell(f.verification_uri_complete ?? f.verification_uri);
      // Rust side polls and resolves
      await invoke("login_finish");
      nav("/chat");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Altaris Desktop</h1>
      <p className="mt-2 text-sm text-neutral-400">Argus Identity Provider'a giriş yapın.</p>

      {!flow && (
        <button
          onClick={startLogin}
          disabled={busy}
          className="mt-8 w-full rounded-md bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? "Bağlanıyor…" : "Giriş yap"}
        </button>
      )}

      {flow && (
        <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
          <p className="text-sm text-neutral-300">Tarayıcıda kodu onayla:</p>
          <p className="mt-2 font-mono text-2xl tracking-widest text-orange-400">{flow.user_code}</p>
          <p className="mt-3 break-all text-xs text-neutral-500">{flow.verification_uri}</p>
          <p className="mt-4 text-xs text-neutral-500">Onayladıktan sonra otomatik devam eder…</p>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-red-400">Hata: {error}</p>}
    </div>
  );
}
