import { auth } from "@/auth";
import { redirect } from "next/navigation";

type SessionRow = {
  id: string;
  source: string;
  provider: string;
  model: string;
  title: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
};

async function getSessions(token: string): Promise<SessionRow[]> {
  const base = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";
  const r = await fetch(`${base}/api/v1/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!r.ok) return [];
  return r.json();
}

export default async function Dashboard() {
  const session = await auth();
  if (!session) redirect("/");

  const token = (session as Record<string, unknown>).accessToken as string | undefined;
  const tenantSlug = (session as Record<string, unknown>).tenantSlug as string | undefined;
  const sessions = token ? await getSessions(token) : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Oturumlar</h1>
          <p className="text-xs text-neutral-400">Tenant: <span className="font-mono">{tenantSlug ?? "—"}</span></p>
        </div>
        <div className="flex gap-2">
          <a href="/terminal" className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800">
            Remote terminal
          </a>
          <a href="/chat" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            Yeni web sohbeti
          </a>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3">Başlık</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Başlangıç</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Henüz oturum yok. Terminalde <code className="font-mono">altaris</code> ile bir oturum başlatın.</td></tr>
            )}
            {sessions.map(s => (
              <tr key={s.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                <td className="px-4 py-3">{s.title ?? <span className="text-neutral-500">—</span>}</td>
                <td className="px-4 py-3"><span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{s.source}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{s.provider}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.model}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{new Date(s.startedAt).toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
