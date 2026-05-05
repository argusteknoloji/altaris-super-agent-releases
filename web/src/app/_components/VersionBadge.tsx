"use client";

// Build sürümünü TopNav'da gösteren küçük rozet. Versiyon formatı:
//   MAJOR.MINOR  → package.json'dan (manuel kontrol)
//   PATCH        → CI run number'dan (her push otomatik +1)
// Yani her deploy v1.0.85 → v1.0.86 → v1.0.87 şeklinde ilerler. Tooltip'te
// tam SHA + build zamanı.

export default function VersionBadge() {
  const ver  = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "?";
  const sha  = process.env.NEXT_PUBLIC_BUILD_SHA     ?? "?";
  const time = process.env.NEXT_PUBLIC_BUILD_TIME    ?? "";
  const timeFmt = time
    ? new Date(time).toLocaleString("tr-TR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      })
    : "?";
  const tooltip = `Sürüm v${ver}\nSHA ${sha}\nBuild ${timeFmt}`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-400"
    >
      <span className="text-orange-400">v{ver}</span>
      <span className="text-neutral-600">·</span>
      <span>{sha}</span>
    </span>
  );
}
