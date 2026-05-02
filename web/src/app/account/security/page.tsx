"use client";

import { useEffect, useState } from "react";

type Status = { enabled: boolean; kind: "totp" };

export default function SecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const r = await fetch("/api/proxy/me/totp/status", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function startSetup() {
    setBusy(true); setErr(null);
    try {
      // Mevcut sayfayı return param olarak gönder — Keycloak setup bittikten
      // sonra "Back to application" linkiyle buraya dönüp status'u refresh ederiz.
      const ret = encodeURIComponent(window.location.href);
      const r = await fetch(`/api/proxy/me/totp/setup-url?return=${ret}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { url } = await r.json() as { url: string };
      // Tarayıcı Keycloak account console'una gider — kullanıcı QR'ı tarar,
      // 6-digit kod girer, "Back to application" ile portala döner.
      window.location.href = url;
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  async function disable() {
    if (!confirm("İki faktörlü doğrulama kapatılsın mı? Hesap güvenliği zayıflar.")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/me/totp/disable", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setFlash("✓ TOTP kaldırıldı");
      setTimeout(() => setFlash(null), 2000);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Hesap güvenliği</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Hesabını koruyacak ek güvenlik ayarları. Kurum admin'in zorunlu kıldığı maddeler ek
        olarak burada yönetilebilir.
      </p>

      {/* 2FA / TOTP kartı */}
      <section className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">İki faktörlü doğrulama (2FA)</h2>
              {status?.enabled ? (
                <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-medium text-emerald-300">● Aktif</span>
              ) : status === null ? (
                <span className="rounded-full bg-neutral-800 px-3 py-0.5 text-xs text-neutral-500">— yükleniyor</span>
              ) : (
                <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-xs font-medium text-amber-300">○ Kapalı</span>
              )}
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              Telefonundaki <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>,
              <strong> Authy</strong>, <strong>1Password</strong> veya <strong>Bitwarden</strong> uygulamasıyla 6-haneli
              kod üretirsin. Login'de email + şifre + TOTP kodu sorulur.
            </p>
            <ol className="mt-4 ml-5 list-decimal space-y-1 text-xs text-neutral-500">
              <li>Aşağıdaki butona tıkla → Keycloak güvenlik sayfası açılır</li>
              <li>"Authenticator application" altında kameranı QR'a tut</li>
              <li>Uygulamadaki 6-digit kodu yaz, "Submit"</li>
              <li>"Back to application" → buraya dönersin, durum "Aktif" olur</li>
            </ol>
          </div>
          <div className="flex shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 p-3 text-3xl">
            {status?.enabled ? "🔐" : "🛡"}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          {!status?.enabled ? (
            <button
              onClick={startSetup}
              disabled={busy || status === null}
              className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? "Yönlendiriliyor…" : "Authenticator ile kur →"}
            </button>
          ) : (
            <button
              onClick={disable}
              disabled={busy}
              className="rounded-md border border-red-500/30 px-5 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy ? "Kapatılıyor…" : "2FA'yı kaldır"}
            </button>
          )}
          {status?.enabled && (
            <button
              onClick={startSetup}
              disabled={busy}
              className="rounded-md border border-neutral-700 px-5 py-2 text-sm text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
            >
              Yeni cihaz ekle
            </button>
          )}
          {flash && <span className="text-xs text-emerald-400">{flash}</span>}
        </div>

        {err && <p className="mt-3 text-xs text-red-400">Hata: {err}</p>}

        <p className="mt-4 rounded border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/80">
          💡 <strong>Telefon kaybı senaryosu:</strong> Authenticator uygulamasındaki kodu
          giremezsen, kurum admin'inden 2FA'nı kaldırmasını iste. Sonra tekrar
          buradan yeni cihazla kur.
        </p>
      </section>

      {/* Şifre kartı */}
      <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="text-lg font-semibold">Şifre</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Şifreni güncellemek için Keycloak hesap konsolunu kullanabilirsin.
        </p>
        <a
          href="/api/proxy/me/totp/setup-url"
          onClick={async (e) => {
            // Şifre değiştirme aynı account console'da; setup-url endpoint'i return ile dönüyor
            e.preventDefault();
            const r = await fetch("/api/proxy/me/totp/setup-url");
            if (!r.ok) return;
            const { url } = await r.json();
            // /security/signing-in yerine /account/?#/security/account-security profil sayfasına
            window.location.href = url.replace("/security/signing-in", "/account-security/personal-info");
          }}
          className="mt-3 inline-block rounded-md border border-neutral-700 px-4 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
        >
          Hesap konsoluna git →
        </a>
      </section>
    </main>
  );
}
