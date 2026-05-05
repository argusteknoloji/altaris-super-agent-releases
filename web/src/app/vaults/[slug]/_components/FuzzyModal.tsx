"use client";

// Generic fuzzy-search modal — Quick Switcher (Cmd+O) ve Command Palette (Cmd+P)
// için ortak iskelet. Score'lama basit substring + word-boundary boost; küçük
// dataset'lere (vault dosyaları, ~50 komut) yeterli, ek bağımlılık yok.

import { useEffect, useMemo, useRef, useState } from "react";

export interface FuzzyItem {
  id: string;
  label: string;
  detail?: string;
  hint?: string;
  /** Tıklandığında / Enter'da çalışacak action. */
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  placeholder: string;
  items: FuzzyItem[];
  emptyHint?: string;
}

function score(item: FuzzyItem, query: string): number | null {
  if (!query) return 0; // empty query → original order
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const detail = (item.detail ?? "").toLowerCase();
  const labelIdx = label.indexOf(q);
  const detailIdx = detail.indexOf(q);
  if (labelIdx < 0 && detailIdx < 0) {
    // Subsequence match (Obsidian-tarzı): tüm karakterler sırayla geçiyor mu
    let i = 0, j = 0;
    while (i < q.length && j < label.length) {
      if (q[i] === label[j]) i++;
      j++;
    }
    if (i < q.length) return null;
    return -100; // weak match
  }
  let s = 0;
  if (labelIdx >= 0) {
    s += 100 - labelIdx; // başa yakın daha iyi
    // Word-boundary boost
    if (labelIdx === 0 || /[\/\s_-]/.test(label[labelIdx - 1])) s += 30;
    s += q.length * 2; // uzun match
  } else {
    s += 30 - detailIdx;
  }
  return s;
}

export default function FuzzyModal({ open, onClose, placeholder, items, emptyHint }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Modal açıldığında query reset + focus
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // RAF: dialog mount olduktan sonra focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Escape kapatır
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ranked = useMemo(() => {
    const scored = items
      .map((it) => ({ it, s: score(it, query) }))
      .filter((x): x is { it: FuzzyItem; s: number } => x.s !== null);
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 50).map((x) => x.it);
  }, [items, query]);

  // Active idx scroll
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, ranked]);

  if (!open) return null;

  function commitActive() {
    const item = ranked[activeIdx];
    if (!item) return;
    onClose();
    // run'u modal kapandıktan sonra tetikle ki action navigate ederse
    // modal state'i bozulmasın
    queueMicrotask(() => item.run());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 shadow-2xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(ranked.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commitActive();
            }
          }}
          placeholder={placeholder}
          className="w-full border-b border-neutral-800 bg-transparent px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
        />
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {ranked.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500">
              {emptyHint ?? "Eşleşme yok."}
            </p>
          ) : (
            ranked.map((it, idx) => (
              <button
                key={it.id}
                data-idx={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => commitActive()}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors " +
                  (idx === activeIdx ? "bg-neutral-800/80" : "hover:bg-neutral-900")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-neutral-100">{it.label}</div>
                  {it.detail && (
                    <div className="truncate text-[11px] text-neutral-500">{it.detail}</div>
                  )}
                </div>
                {it.hint && (
                  <span className="flex-shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                    {it.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
