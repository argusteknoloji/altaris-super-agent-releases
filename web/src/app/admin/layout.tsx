import Link from "next/link";
import { auth, isAdmin, isPlatformAdmin } from "@/auth";
import { redirect } from "next/navigation";
import PresenceBadge from "@/app/_components/PresenceBadge";
import AdminMobileNav from "./_AdminMobileNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/");
  // Tenant_member admin alanına giremesin — backend AdminAuth zaten 403 döner
  // ama frontend'de de erken redirect ile UX kötü olmasın.
  if (!isAdmin(session)) redirect("/dashboard?error=admin_required");

  const platformAdmin = isPlatformAdmin(session);

  const items = [
    { href: "/admin/users",            label: "Kullanıcılar" },
    { href: "/admin/sessions",         label: "Tüm oturumlar" },
    { href: "/admin/invitations",      label: "Davetler" },
    { href: "/admin/api-keys",         label: "API anahtarları" },
    { href: "/admin/providers",        label: "Provider config" },
    { href: "/admin/data-sources",     label: "🔌 Connector'lar" },
    { href: "/admin/webhooks",         label: "🪝 Webhook'lar" },
    { href: "/admin/audit",            label: "Denetim kaydı" },
    { href: "/admin/tenant-settings",  label: "🔐 Tenant ayarları" },
    ...(platformAdmin ? [{ href: "/admin/tenants", label: "Tenant'lar (platform)" }] : []),
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3rem)]">
      <AdminMobileNav items={items} tenantSlug={session.tenantSlug ?? "—"} role={platformAdmin ? "platform_admin" : "tenant_admin"} />
      <aside className="hidden md:block w-56 shrink-0 border-r border-neutral-800 bg-neutral-950 px-3 py-6">
        <div className="mb-6 px-2">
          <h1 className="text-base font-semibold tracking-tight">Altaris Admin</h1>
          <p className="text-xs text-neutral-500">Tenant: <span className="font-mono">{session.tenantSlug ?? "—"}</span></p>
          <p className="text-[10px] text-neutral-600">Rol: {platformAdmin ? "platform_admin" : "tenant_admin"}</p>
          <p className="mt-1.5"><PresenceBadge /></p>
        </div>
        <nav className="space-y-1 text-sm">
          {items.map(i => (
            <Item key={i.href} href={i.href} label={i.label} />
          ))}
        </nav>
        <div className="mt-8 border-t border-neutral-900 pt-4">
          <Link href="/dashboard" className="block rounded-md px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900">← Panele dön</Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto bg-neutral-950">{children}</main>
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
