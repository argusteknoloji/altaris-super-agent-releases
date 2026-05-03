"use client";

import { useEffect, useState } from "react";

/**
 * Cronos 6-field cron string üreten + parse eden human-friendly schedule picker.
 * Format:  "sec min hour day month day-of-week"
 *   günlük 06:30          → "0 30 6 * * *"
 *   haftalık Pzt 09:00    → "0 0 9 * * MON"
 *   aylık ayın 1'i 09:00  → "0 0 9 1 * *"
 *   yıllık 1 Oca 09:00    → "0 0 9 1 1 *"
 *   her 6 saatte bir      → "0 0 *(slash)6 * * *"
 *   her 30 dakikada bir   → "0 *(slash)30 * * * *"
 *   (yorum içinde slash-asterisk yazılmıyor — JSDoc terminator çakışması)
 *
 * Mevcut cron string'i parse edip mod'u tahmin eder (reverse mapping). Tanınmayan
 * şekiller "Özel (cron)" moduna düşer ve raw input gösterir.
 */

type Mode = "off" | "daily" | "weekly" | "monthly" | "yearly" | "everyHours" | "everyMinutes" | "custom";

const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;
const DAY_LABELS_TR = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

interface Props {
  value: string;        // mevcut cron string ("" = off)
  onChange: (cron: string) => void;
}

interface State {
  mode: Mode;
  hour: number;
  minute: number;
  weekDay: number;       // 0=Sun
  monthDay: number;      // 1-28
  month: number;         // 1-12
  intervalHours: number;
  intervalMinutes: number;
  custom: string;
}

function parseCron(cron: string): State {
  const def: State = {
    mode: "off", hour: 9, minute: 0, weekDay: 1, monthDay: 1, month: 1,
    intervalHours: 6, intervalMinutes: 30, custom: cron,
  };
  if (!cron.trim()) return def;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 6) return { ...def, mode: "custom" };
  const [sec, min, hr, day, mon, dow] = parts;
  if (sec !== "0") return { ...def, mode: "custom" };

  // Her N dakikada
  if (/^\*\/\d+$/.test(min) && hr === "*" && day === "*" && mon === "*" && dow === "*") {
    return { ...def, mode: "everyMinutes", intervalMinutes: Number(min.slice(2)) };
  }
  // Her N saatte
  if (min === "0" && /^\*\/\d+$/.test(hr) && day === "*" && mon === "*" && dow === "*") {
    return { ...def, mode: "everyHours", intervalHours: Number(hr.slice(2)) };
  }
  // Numeric only check
  const isNum = (s: string) => /^\d+$/.test(s);
  if (!isNum(min) || !isNum(hr)) return { ...def, mode: "custom" };
  const m = Number(min), h = Number(hr);

  // Yıllık: gün+ay set, dow=*
  if (isNum(day) && isNum(mon) && dow === "*") {
    return { ...def, mode: "yearly", hour: h, minute: m, monthDay: Number(day), month: Number(mon) };
  }
  // Aylık: gün set, ay=*, dow=*
  if (isNum(day) && mon === "*" && dow === "*") {
    return { ...def, mode: "monthly", hour: h, minute: m, monthDay: Number(day) };
  }
  // Haftalık: gün=*, dow set
  if (day === "*" && mon === "*" && dow !== "*") {
    let wd = 1;
    if (isNum(dow)) wd = Number(dow);
    else { const i = DAYS.indexOf(dow.toUpperCase() as typeof DAYS[number]); if (i >= 0) wd = i; }
    return { ...def, mode: "weekly", hour: h, minute: m, weekDay: wd };
  }
  // Günlük
  if (day === "*" && mon === "*" && dow === "*") {
    return { ...def, mode: "daily", hour: h, minute: m };
  }
  return { ...def, mode: "custom" };
}

function buildCron(s: State): string {
  const pad = (n: number) => String(Math.max(0, n));
  switch (s.mode) {
    case "off":          return "";
    case "daily":        return `0 ${pad(s.minute)} ${pad(s.hour)} * * *`;
    case "weekly":       return `0 ${pad(s.minute)} ${pad(s.hour)} * * ${DAYS[s.weekDay]}`;
    case "monthly":      return `0 ${pad(s.minute)} ${pad(s.hour)} ${pad(s.monthDay)} * *`;
    case "yearly":       return `0 ${pad(s.minute)} ${pad(s.hour)} ${pad(s.monthDay)} ${pad(s.month)} *`;
    case "everyHours":   return `0 0 */${Math.max(1, s.intervalHours)} * * *`;
    case "everyMinutes": return `0 */${Math.max(1, s.intervalMinutes)} * * * *`;
    case "custom":       return s.custom;
  }
}

function describe(s: State): string {
  const t = (h: number, m: number) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  switch (s.mode) {
    case "off":          return "Otomatik tetiklenmez (manuel çalıştır)";
    case "daily":        return `Her gün saat ${t(s.hour, s.minute)}`;
    case "weekly":       return `Her ${DAY_LABELS_TR[s.weekDay]} saat ${t(s.hour, s.minute)}`;
    case "monthly":      return `Her ayın ${s.monthDay}. günü saat ${t(s.hour, s.minute)}`;
    case "yearly":       return `Her yıl ${s.monthDay} ${MONTHS_TR[s.month-1]} saat ${t(s.hour, s.minute)}`;
    case "everyHours":   return `Her ${s.intervalHours} saatte bir`;
    case "everyMinutes": return `Her ${s.intervalMinutes} dakikada bir`;
    case "custom":       return "Özel cron ifadesi";
  }
}

export default function ScheduleBuilder({ value, onChange }: Props) {
  const [s, setS] = useState<State>(() => parseCron(value));

  // value dışarıdan değişirse re-parse (form reset için)
  useEffect(() => { setS(parseCron(value)); }, [value]);

  function update(patch: Partial<State>) {
    const next = { ...s, ...patch };
    setS(next);
    onChange(buildCron(next));
  }

  const showTime  = ["daily","weekly","monthly","yearly"].includes(s.mode);
  const showDow   = s.mode === "weekly";
  const showDay   = s.mode === "monthly" || s.mode === "yearly";
  const showMonth = s.mode === "yearly";

  return (
    <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-neutral-500">Sıklık</span>
        <select value={s.mode} onChange={e => update({ mode: e.target.value as Mode })}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs">
          <option value="off">Kapalı (manuel)</option>
          <option value="daily">Günlük</option>
          <option value="weekly">Haftalık</option>
          <option value="monthly">Aylık</option>
          <option value="yearly">Yıllık</option>
          <option value="everyHours">Her N saatte</option>
          <option value="everyMinutes">Her N dakikada</option>
          <option value="custom">Özel (cron)</option>
        </select>

        {showDow && (
          <select value={s.weekDay} onChange={e => update({ weekDay: Number(e.target.value) })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs">
            {DAY_LABELS_TR.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        )}

        {showDay && (
          <input type="number" min={1} max={28} value={s.monthDay}
            onChange={e => update({ monthDay: Math.min(28, Math.max(1, Number(e.target.value))) })}
            className="w-16 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs"
            title="Ayın günü (1-28)" />
        )}

        {showMonth && (
          <select value={s.month} onChange={e => update({ month: Number(e.target.value) })}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs">
            {MONTHS_TR.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        )}

        {showTime && (
          <span className="flex items-center gap-1">
            <input type="number" min={0} max={23} value={s.hour}
              onChange={e => update({ hour: Math.min(23, Math.max(0, Number(e.target.value))) })}
              className="w-14 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs" />
            <span className="text-neutral-500">:</span>
            <input type="number" min={0} max={59} value={s.minute}
              onChange={e => update({ minute: Math.min(59, Math.max(0, Number(e.target.value))) })}
              className="w-14 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs" />
          </span>
        )}

        {s.mode === "everyHours" && (
          <input type="number" min={1} max={23} value={s.intervalHours}
            onChange={e => update({ intervalHours: Math.min(23, Math.max(1, Number(e.target.value))) })}
            className="w-16 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs" />
        )}

        {s.mode === "everyMinutes" && (
          <input type="number" min={1} max={59} value={s.intervalMinutes}
            onChange={e => update({ intervalMinutes: Math.min(59, Math.max(1, Number(e.target.value))) })}
            className="w-16 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs" />
        )}

        {s.mode === "custom" && (
          <input value={s.custom}
            onChange={e => update({ custom: e.target.value })}
            placeholder="0 30 6 * * *  (sec min hour day mon dow)"
            className="flex-1 min-w-[200px] rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs font-mono" />
        )}
      </div>

      <p className="text-[10px] text-neutral-500">
        {describe(s)}
        {s.mode !== "off" && s.mode !== "custom" && (
          <span className="ml-2 font-mono text-neutral-600">cron: {buildCron(s)}</span>
        )}
      </p>
    </div>
  );
}
