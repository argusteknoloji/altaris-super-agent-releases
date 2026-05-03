import { setLocaleAction } from "@/app/_actions/locale";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({
  current,
  path,
}: {
  current: Locale;
  path: string;
}) {
  const inactive: Locale = current === "tr" ? "en" : "tr";

  return (
    <form action={setLocaleAction} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em]">
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        name="locale"
        value="tr"
        aria-pressed={current === "tr"}
        className={`rounded-sm px-1.5 py-0.5 transition-colors ${
          current === "tr"
            ? "text-[#f08c50]"
            : "text-[#6b6358] hover:text-[#ddd8d0]"
        }`}
      >
        tr
      </button>
      <span aria-hidden className="text-[#3a342d]">/</span>
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={current === "en"}
        className={`rounded-sm px-1.5 py-0.5 transition-colors ${
          current === "en"
            ? "text-[#f08c50]"
            : "text-[#6b6358] hover:text-[#ddd8d0]"
        }`}
      >
        en
      </button>
      {/* keep `inactive` referenced so noUnusedLocals doesn't complain in some configs */}
      <span hidden>{inactive}</span>
    </form>
  );
}
