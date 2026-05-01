import type { Metadata } from "next";
import { auth } from "@/auth";
import TopNav from "./_components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altaris Portal",
  description: "Argus Teknoloji — Altaris Agentic AI Platform"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showNav = !!session;

  return (
    <html lang="tr">
      <body className="bg-neutral-950 text-neutral-100 antialiased min-h-screen">
        {showNav && <TopNav email={session?.user?.email ?? null} tenantSlug={session?.tenantSlug ?? null} />}
        {children}
      </body>
    </html>
  );
}
