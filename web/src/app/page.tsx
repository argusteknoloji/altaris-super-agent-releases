import Link from "next/link";
import { auth, signIn } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Altaris</h1>
          <p className="text-sm text-neutral-400">Argus Teknoloji — Kurumsal Agentic AI Platformu</p>
        </div>
        {session ? (
          <Link href="/dashboard" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            Panele git
          </Link>
        ) : (
          <form action={async () => { "use server"; await signIn("keycloak", { redirectTo: "/dashboard" }); }}>
            <button type="submit" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
              Giriş yap
            </button>
          </form>
        )}
      </header>

      <section className="mt-20 grid gap-6 md:grid-cols-3">
        <Card title="Terminal" desc="`altaris` komutu ile lokal LLM destekli agentik terminal. macOS, Linux, Windows tek binary." />
        <Card title="Web Chat" desc="Tarayıcıdan oturum aç, ekibinizle paylaşılan kurumsal hafızada sohbet et." />
        <Card title="Remote Control" desc="Lokal `altaris` oturumlarını web'den izle ve yönet. Mobil uygulama ileride." />
      </section>

      <section className="mt-16 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="text-lg font-medium">Hangi müşteri için?</h2>
        <p className="mt-2 text-sm text-neutral-300">
          Bulut isteyenler için doğrudan üst-tier modeller; kamu, savunma, finans gibi veri güvenliği hassasiyeti olan
          kurumlar için Altaris on-prem deploy edilir, lokal LLM'lere bağlanır, dışarıya hiçbir şey göndermez.
        </p>
      </section>
    </main>
  );
}

function Card({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <h3 className="text-base font-medium text-orange-400">{title}</h3>
      <p className="mt-2 text-sm text-neutral-300">{desc}</p>
    </div>
  );
}
