"use client";
import { useEffect, useState } from "react";

type Settings = { requireTotp: boolean; auditRetentionDays: number | null };

export default function TenantSettingsPage() {
  const [s, setS] = useState<Settings>({ requireTotp: false, auditRetentionDays: null });
  const [original, setOriginal] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/proxy/admin/tenant-settings", { cache: "no-store" });
    if (r.ok) {
      const data = await r.json() as Settings;
      setS(data);
      setOriginal(data);
    }
  }
  useEffect(() => { load(); }, []);

  const dirty = original && (s.requireTotp !== original.requireTotp || s.auditRetentionDays !== original.auditRetentionDays);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/proxy/admin/tenant-settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!r.ok) { setMsg("Hata: " + await r.text()); return; }
      const fresh = await r.json() as Settings;
      setS(fresh); setOriginal(fresh);
      setMsg("Kaydedildi.");
    } finally { setBusy(false); }
  }

  async function applyTotpAll() {
    if (!confirm("Tüm tenant kullanıcılarına TOTP zorunluluğu push edilsin mi? Bir sonraki login'lerinde Authenticator kurmaya yönlendirilecekler.")) return;
    setBulkResult(null); setBusy(true);
    try {
      const r = await fetch("/api/proxy/admin/tenant-settings/apply-totp-all", { method: "POST" });
      if (!r.ok) { setBulkResult("Hata: " + await r.text()); return; }
      const j = await r.json() as { applied: number; failed: number; total: number };
      setBulkResult(`${j.applied}/${j.total} kullanıcı işlendi (${j.failed} başarısız).`);
    } finally { setBusy(false); }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-3xl">
      <h2 className="text-2xl font-semibold">Tenant ayarları</h2>
      <p className="mt-1 text-sm text-neutral-400">Güvenlik ve uyumluluk ayarları — tüm tenant'ı etkiler.</p>

      {/* 2FA enforcement */}
      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <h3 className="text-base font-semibold text-orange-400">🔐 İki faktörlü kimlik doğrulama</h3>
        <p className="mt-1 text-xs text-neutral-400">
          Aktif edildiğinde yeni kullanıcılar otomatik olarak Google Authenticator / 1Password / Authy gibi
          TOTP uygulamasına yönlendirilir. Mevcut kullanıcılar için "Tüm kullanıcılara uygula" butonunu
          kullan — onlar da bir sonraki login'de wizard görür.
        </p>
        <label className="mt-4 flex items-center gap-3">
          <input type="checkbox" checked={s.requireTotp}
            onChange={e => setS({ ...s, requireTotp: e.target.checked })}
            className="h-4 w-4" />
          <span className="text-sm">Tüm kullanıcılar için TOTP zorunlu</span>
        </label>
        {s.requireTotp && (
          <button disabled={busy} onClick={applyTotpAll}
            className="mt-4 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-300 hover:bg-orange-500/20 disabled:opacity-50">
            🔁 Mevcut kullanıcılara da uygula
          </button>
        )}
        {bulkResult && <p className="mt-2 text-xs text-neutral-300">{bulkResult}</p>}
      </section>

      {/* Audit retention */}
      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <h3 className="text-base font-semibold text-orange-400">📋 Denetim kaydı saklama</h3>
        <p className="mt-1 text-xs text-neutral-400">
          KVKK / GDPR uyumluluğu için audit log'larının saklama süresi. Saatte bir background sweeper
          bu eşikten eski satırları siler. Boş bırak veya 0 yaz = sonsuz tut.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input type="number" min={0} max={3650}
            value={s.auditRetentionDays ?? ""}
            placeholder="örn. 365"
            onChange={e => setS({ ...s, auditRetentionDays: e.target.value === "" ? null : Number(e.target.value) })}
            className="w-32 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
          <span className="text-xs text-neutral-500">gün</span>
        </div>
        <p className="mt-2 text-[10px] text-neutral-600">
          Yaygın değerler: KVKK kişisel veri kayıtları ≥ 2 yıl (730), kurum içi audit ≥ 1 yıl (365).
        </p>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button disabled={!dirty || busy} onClick={save}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? "…" : "Kaydet"}
        </button>
        {msg && <span className="text-xs text-neutral-400">{msg}</span>}
      </div>
    </div>
  );
}
