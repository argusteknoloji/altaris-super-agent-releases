"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(formData: FormData): Promise<void> {
  const next = String(formData.get("locale") ?? "");
  const path = String(formData.get("path") ?? "/");
  if (next !== "tr" && next !== "en" && next !== "de") return;

  const c = await cookies();
  c.set(LOCALE_COOKIE, next as Locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  redirect(path.startsWith("/") ? path : "/");
}
