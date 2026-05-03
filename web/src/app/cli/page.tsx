import { detectLocale } from "@/lib/i18n";
import { getCliDict } from "@/lib/cli-content";
import CliClient from "./Client";

export const metadata = {
  title: "Altaris CLI — argus teknoloji",
  description:
    "Altaris CLI — local-first, multi-provider, multi-tenant agentic AI terminal. One signed binary across macOS, Linux, Windows.",
};

export default async function CliPage() {
  const locale = await detectLocale();
  const d = getCliDict(locale);

  return <CliClient d={d} locale={locale} />;
}
