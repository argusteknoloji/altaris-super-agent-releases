import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altaris Portal",
  description: "Argus Teknoloji — Altaris Agentic AI Platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-neutral-950 text-neutral-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
