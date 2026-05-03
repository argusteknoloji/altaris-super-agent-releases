import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fmtDateTimeTR } from "@/lib/datetime";

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

  const token = session.accessToken;
  const tenantSlug = session.tenantSlug;
  const sessions = token ? await getSessions(token) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Oturumlar</h1>
          <p className="text-xs text-neutral-400">Tenant: <span className="font-mono">{tenantSlug ?? "—"}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin" className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800">
            Admin
          </a>
          <a href="/terminal" className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800">
            Remote terminal
          </a>
          <a href="/chat" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            Yeni web sohbeti
          </a>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[640px] text-sm">
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
                <td className="px-4 py-3 text-xs text-neutral-400">{fmtDateTimeTR(s.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Build version badge — deploy doğrulama */}
      <BuildBadge />
    </main>
  );
}

function BuildBadge() {
  const ver  = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "?";
  const sha  = process.env.NEXT_PUBLIC_BUILD_SHA     ?? "?";
  const time = process.env.NEXT_PUBLIC_BUILD_TIME    ?? "";
  const timeFmt = time ? new Date(time).toLocaleString("tr-TR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }) : "?";
  return (
    <div className="mt-8 flex items-center gap-3 text-[10px] text-neutral-500 font-mono">
      <span className="rounded bg-neutral-900 border border-neutral-800 px-2 py-0.5">
        web · v{ver}
      </span>
      <span className="rounded bg-neutral-900 border border-neutral-800 px-2 py-0.5">
        sha · {sha}
      </span>
      <span className="text-neutral-600">build {timeFmt}</span>
    </div>
  );
}
