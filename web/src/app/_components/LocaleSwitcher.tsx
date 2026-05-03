import { setLocaleAction } from "@/app/_actions/locale";
import type { Locale } from "@/lib/i18n";

const LOCALES: ReadonlyArray<Locale> = ["tr", "en", "de"];

export function LocaleSwitcher({
  current,
  path,
}: {
  current: Locale;
  path: string;
}) {
  return (
    <form action={setLocaleAction} className="flex items-center gap-1 text-[10px] uppercase tracking-[0.28em]">
      <input type="hidden" name="path" value={path} />
      {LOCALES.map((loc, i) => (
        <span key={loc} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-[#3a342d]">/</span>}
          <button
            type="submit"
            name="locale"
            value={loc}
            aria-pressed={current === loc}
            className={`rounded-sm px-1.5 py-0.5 transition-colors ${
              current === loc
                ? "text-[#f08c50]"
                : "text-[#6b6358] hover:text-[#ddd8d0]"
            }`}
          >
            {loc}
          </button>
        </span>
      ))}
    </form>
  );
}
