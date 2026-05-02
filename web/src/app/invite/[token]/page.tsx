"use client";

import { useEffect, useState, use } from "react";

type Lookup = {
  email: string;
  role: string;
  tenant: { id: string; slug: string; name: string };
  expiresAt: string;
  acceptedAt: string | null;
  status: "pending" | "accepted" | "expired";
};

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ password: "", confirm: "", firstName: "", lastName: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ tenantSlug: string } | null>(null);

  useEffect(() => {
    fetch(`/api/proxy/invite/${token}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch(e => setErr((e as Error).message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setErr("Şifreler eşleşmiyor"); return; }
    if (form.password.length < 8)        { setErr("Şifre en az 8 karakter"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/proxy/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: form.password,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`HTTP ${r.status}: ${txt}`);
      }
      const result = await r.json();
      setDone({ tenantSlug: result.tenantSlug });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (err && !data) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Davet bulunamadı</h1>
        <p className="mt-2 text-sm text-neutral-400">{err}</p>
      </main>
    );
  }
  if (!data) {
    return <main className="mx-auto max-w-xl px-6 py-16 text-sm text-neutral-500">Yükleniyor…</main>;
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-emerald-400">Hesap oluşturuldu ✓</h1>
        <p className="mt-3 text-sm text-neutral-400">
          <strong>{data.tenant.name}</strong> ({data.tenant.slug}) tenant'ına eklendin.
        </p>
        <p className="mt-2 text-sm text-neutral-400">E-posta: <span className="font-mono">{data.email}</span></p>
        <a href="/api/auth/signin/keycloak" className="mt-8 inline-block rounded-md bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600">
          Giriş yap →
        </a>
      </main>
    );
  }

  if (data.status === "accepted") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Bu davet zaten kabul edilmiş</h1>
        <p className="mt-2 text-sm text-neutral-400">{data.email} ile giriş yapabilirsin.</p>
        <a href="/api/auth/signin/keycloak" className="mt-6 inline-block rounded-md bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600">Giriş yap →</a>
      </main>
    );
  }
  if (data.status === "expired") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Davet süresi dolmuş</h1>
        <p className="mt-2 text-sm text-neutral-400">Yöneticinden yeni bir davet iste.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Altaris'e hoş geldin</h1>
      <p className="mt-2 text-sm text-neutral-400">
        <strong className="text-orange-400">{data.tenant.name}</strong> ({data.tenant.slug}) tenant'ına
        <span className="mx-1 rounded bg-neutral-800 px-2 py-0.5 text-xs font-mono">{data.role}</span>
        rolüyle davetlisin.
      </p>
      <p className="mt-1 text-xs text-neutral-500">E-posta: <span className="font-mono">{data.email}</span> · Davet süresi: {new Date(data.expiresAt).toLocaleDateString("tr-TR")}</p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Ad" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
          <input placeholder="Soyad" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        </div>
        <input required type="password" placeholder="Şifre (min 8 karakter)" minLength={8} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        <input required type="password" placeholder="Şifre (tekrar)" minLength={8} value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm" />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <button disabled={busy} className="w-full rounded-md bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {busy ? "Hesap oluşturuluyor…" : "Hesabı oluştur"}
        </button>
      </form>
    </main>
  );
}
