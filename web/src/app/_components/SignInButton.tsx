"use client";

import { useState } from "react";

/**
 * Auth.js v5 + Next.js 15 sign-in button.
 *
 * Server Component üzerinden Server Action ile signIn() çağrısı:
 *   ✗ fetch redirect cross-origin CORS engeli (Keycloak'a redirect blocked)
 *
 * HTML form POST ana sayfadan:
 *   ✗ CSRF cookie henüz set edilmemiş (home page Auth.js endpoint değil) → MissingCSRF
 *
 * Bu client component:
 *   1) Mount/click anında /api/auth/csrf'i fetch eder → cookie set + token alır
 *   2) Form'u programmatic submit eder (full page POST, redirect normal browser nav)
 *   3) Auth.js POST'u alır, CSRF eşleşir, 302 → Keycloak login sayfası → callback → dashboard
 */
export default function SignInButton({
  className,
  callbackUrl = "/dashboard",
  children,
}: {
  className?: string;
  callbackUrl?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      const { csrfToken } = (await r.json()) as { csrfToken: string };
      // Form'u dinamik üret + submit et — full page navigation (fetch değil),
      // 302 → cross-origin Keycloak'a normal browser navigation olur.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signin/keycloak";
      const csrf = document.createElement("input");
      csrf.type = "hidden"; csrf.name = "csrfToken"; csrf.value = csrfToken;
      const cb = document.createElement("input");
      cb.type = "hidden"; cb.name = "callbackUrl"; cb.value = callbackUrl;
      form.appendChild(csrf); form.appendChild(cb);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("[signin]", err);
      setBusy(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={busy} className={className} type="button">
      {children}
    </button>
  );
}
