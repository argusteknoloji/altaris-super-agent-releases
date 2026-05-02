/**
 * Tarih/saat formatlaması — Altaris portal Türkiye saatinde gösterir.
 *
 * Backend her zaman UTC (`DateTimeOffset.UtcNow`) yollar. Bazı route'larda
 * ISO string'in TZ suffix'i kaybolduğu için Date constructor "naive" parse
 * edip browser TZ'ye göre yorumluyordu. Burada explicit Europe/Istanbul
 * verince hem UTC hem ofsetli string'ler doğru gösterilir.
 *
 * Kullanıcı başka bir TZ'deyse (örn. Berlin'de operatör) yine
 * Europe/Istanbul gösteririz — kurum içi kayıtların tutarlı olması için
 * tek bir referans saat dilimi tercih edildi (TR kuruluşuyuz).
 */

const TZ = "Europe/Istanbul";
const LOCALE = "tr-TR";

/**
 * Backend'den gelen string'i normalize et: TZ suffix yoksa UTC say (Z ekle).
 * Bu C# default JSON serialization'da nadiren olur ama defensive.
 */
function parse(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  // ISO 8601 with no Z and no ±HH:MM offset → assume UTC
  const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTz ? value : value + "Z");
}

/** "02.05.2026 12:35:42" — kart ve liste rows için */
export function fmtDateTimeTR(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, { timeZone: TZ });
}

/** "12:35:42" — message timestamp gibi yer için */
export function fmtTimeTR(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(LOCALE, { timeZone: TZ });
}

/** "02.05.2026" — sadece tarih */
export function fmtDateTR(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, { timeZone: TZ });
}

/** "5 dk önce", "3 saat önce", "dün" — relative format */
export function fmtRelativeTR(value: string | Date | null | undefined): string {
  const d = parse(value);
  if (!d || isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60)        return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60)        return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24)         return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day === 1)       return "dün";
  if (day < 7)         return `${day} gün önce`;
  return fmtDateTR(d);
}
