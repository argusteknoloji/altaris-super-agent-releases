"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Vault = {
  id: string;
  slug: string;
  name: string;
  status: string;
  fileCount: number;
  byteSize: number;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; email: string };
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function VaultsPage() {
  const [rows, setRows] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: "", name: "" });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/proxy/vaults-root", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(await r.json());
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const r = await fetch("/api/proxy/vaults-root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!r.ok) throw new Error(await r.text());
      setForm({ slug: "", name: "" });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setCreating(false); }
  }

  async function remove(slug: string) {
    if (!confirm(`'${slug}' kasası ve tüm içeriği silinsin mi?`)) return;
    const r = await fetch(`/api/proxy/vaults/${slug}`, { method: "DELETE" });
    if (r.ok) load(); else setError(await r.text());
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vaults</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Argus knowledge vaults — Obsidian uyumlu, sunucu tarafı yönetilen.
            CLI'dan da: <code className="font-mono text-orange-400">altaris vault create &lt;slug&gt;</code>
          </p>
        </div>
        <button onClick={load} className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900">Yenile</button>
      </div>

      <form onSubmit={create} className="mt-6 grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 md:grid-cols-5">
        <input
          required
          placeholder="slug (ör. proje-alpha)"
          value={form.slug}
          onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono"
        />
        <input
          required
          placeholder="Görünür ad (ör. Proje Alpha)"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
        />
        <button disabled={creating} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {creating ? "Oluşturuluyor…" : "Yeni kasa"}
        </button>
      </form>

      {error && <p className="mt-4 text-xs text-red-400">Hata: {error}</p>}

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading && rows.length === 0 && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
        {!loading && rows.length === 0 && (
          <p className="col-span-full text-sm text-neutral-500">Henüz kasa yok. Yukarıdan oluştur.</p>
        )}
        {rows.map(v => (
          <div key={v.id} className="group rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 hover:border-orange-500/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/vaults/${v.slug}`} className="block truncate text-base font-semibold text-orange-400 hover:underline">
                  {v.name}
                </Link>
                <p className="mt-0.5 truncate text-xs font-mono text-neutral-500">{v.slug}</p>
              </div>
              <button
                onClick={() => remove(v.slug)}
                className="hidden rounded text-xs text-neutral-500 hover:text-red-400 group-hover:inline"
                title="Sil"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              {v.fileCount} dosya · {fmtBytes(v.byteSize)} · {v.owner.email}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              güncellendi {new Date(v.updatedAt).toLocaleString("tr-TR")}
            </p>
            <div className="mt-3 flex gap-2 text-xs">
              <Link href={`/vaults/${v.slug}`} className="rounded-md bg-orange-500 px-3 py-1 font-medium text-white hover:bg-orange-600">Aç →</Link>
              <Link href={`/vaults/${v.slug}/graph`} className="rounded-md border border-neutral-700 px-3 py-1 text-neutral-200 hover:bg-neutral-800">Graph</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
