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

      {/* Recovery codes kartı */}
      <RecoveryCodesCard totpEnabled={!!status?.enabled} />

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

function RecoveryCodesCard({ totpEnabled }: { totpEnabled: boolean }) {
  const [status, setStatus] = useState<{ unused: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string[] | null>(null);

  async function loadStatus() {
    try {
      const r = await fetch("/api/proxy/me/recovery-codes/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
  }
  useEffect(() => { void loadStatus(); }, []);

  async function generate() {
    if (status && status.total > 0 && !confirm("Mevcut recovery codes geçersiz olacak ve yenileri üretilecek. Devam edilsin mi?")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/proxy/me/recovery-codes/generate", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setGenerated(j.codes);
      void loadStatus();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function copyAll() {
    if (generated) navigator.clipboard.writeText(generated.join("\n"));
  }

  function downloadTxt() {
    if (!generated) return;
    const blob = new Blob([
      "Altaris Recovery Codes\n",
      `Generated: ${new Date().toISOString()}\n`,
      "Each code can be used only ONCE. Store offline (password manager).\n\n",
      ...generated.map(c => c + "\n"),
    ], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "altaris-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Recovery codes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            TOTP cihazını kaybedersen (telefon kırıldı, çalındı), bu kodlardan birini girerek
            erişimi geri kazanabilirsin. Her kod <strong>tek kullanımlık</strong> — kullandığın
            silinir. 10 kod üretilir; tükenince yenisini üretebilirsin (eskiler iptal olur).
          </p>
          {status && (
            <p className="mt-3 text-xs">
              <span className={status.unused > 0 ? "text-emerald-400" : "text-neutral-500"}>
                {status.unused} / {status.total} kullanılabilir
              </span>
              {status.unused === 0 && status.total > 0 && (
                <span className="ml-2 text-amber-400">⚠ Tüm kodlar tükendi — yenilerini üret</span>
              )}
              {status.total === 0 && totpEnabled && (
                <span className="ml-2 text-amber-400">⚠ Henüz recovery code üretmedin</span>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-3xl">🔑</div>
      </div>

      {generated && (
        <div className="mt-5 rounded border border-amber-600 bg-amber-950/30 p-4">
          <div className="text-sm text-amber-200 font-medium mb-2">⚠ Bu kodlar sadece şimdi gösteriliyor — kaydet:</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            {generated.map(c => (
              <code key={c} className="rounded bg-neutral-950 px-2 py-1.5 text-center text-amber-100">{c}</code>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={copyAll} className="rounded bg-neutral-800 hover:bg-neutral-700 px-3 py-1 text-xs">📋 Hepsini kopyala</button>
            <button onClick={downloadTxt} className="rounded bg-neutral-800 hover:bg-neutral-700 px-3 py-1 text-xs">⬇ .txt indir</button>
            <button onClick={() => setGenerated(null)} className="rounded bg-amber-700 hover:bg-amber-600 px-3 py-1 text-xs ml-auto">Kaydettim, kapat</button>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={generate}
          disabled={busy || !totpEnabled}
          className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
          title={!totpEnabled ? "Önce 2FA'yı aktive et" : ""}
        >
          {busy ? "Üretiliyor…" : status && status.total > 0 ? "Yeni set üret (eski iptal olur)" : "10 recovery code üret"}
        </button>
        {!totpEnabled && (
          <span className="text-xs text-neutral-500">Önce yukarıdan 2FA'yı kur</span>
        )}
      </div>

      {err && <p className="mt-3 text-xs text-red-400">Hata: {err}</p>}
    </section>
  );
}
