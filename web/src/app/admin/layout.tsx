import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PresenceBadge from "@/app/_components/PresenceBadge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      <aside className="w-56 border-r border-neutral-800 bg-neutral-950 px-3 py-6">
        <div className="mb-6 px-2">
          <h1 className="text-base font-semibold tracking-tight">Altaris Admin</h1>
          <p className="text-xs text-neutral-500">Tenant: <span className="font-mono">{session.tenantSlug ?? "—"}</span></p>
          <p className="mt-1.5"><PresenceBadge /></p>
        </div>
        <nav className="space-y-1 text-sm">
          <Item href="/admin/users"        label="Kullanıcılar" />
          <Item href="/admin/sessions"     label="Tüm oturumlar" />
          <Item href="/admin/invitations"  label="Davetler" />
          <Item href="/admin/api-keys"     label="API anahtarları" />
          <Item href="/admin/providers"    label="Provider config" />
          <Item href="/admin/data-sources" label="🔌 Connector'lar" />
          <Item href="/admin/audit"        label="Denetim kaydı" />
          <Item href="/admin/tenants"      label="Tenant'lar (platform)" />
        </nav>
        <div className="mt-8 border-t border-neutral-900 pt-4">
          <Link href="/dashboard" className="block rounded-md px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900">← Panele dön</Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-neutral-950">{children}</main>
    </div>
  );
}

function Item({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block rounded-md px-3 py-2 text-neutral-300 hover:bg-neutral-900 hover:text-orange-400">
      {label}
    </Link>
  );
}
