"use client";

// Build sürümünü TopNav'da gösteren küçük rozet. Her deploy sonrası build
// numarası otomatik artar (CI: GITHUB_RUN_NUMBER, lokal: git commit count) →
// kullanıcı hangi sürümün canlı olduğunu anında görür. Tooltip'te tam SHA +
// build zamanı.

export default function VersionBadge() {
  const ver  = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "?";
  const num  = process.env.NEXT_PUBLIC_BUILD_NUMBER  ?? "?";
  const sha  = process.env.NEXT_PUBLIC_BUILD_SHA     ?? "?";
  const time = process.env.NEXT_PUBLIC_BUILD_TIME    ?? "";
  // package.json sürümünü "+build.X" suffix'inden ayır — rozet sadece base
  // sürümü ve build numarasını gösterir, geri kalan tooltip'te.
  const baseVer = ver.split("+")[0];
  const timeFmt = time
    ? new Date(time).toLocaleString("tr-TR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      })
    : "?";
  const tooltip = `Sürüm ${ver}\nSHA ${sha}\nBuild ${timeFmt}`;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-400"
    >
      <span className="text-orange-400">v{baseVer}</span>
      <span className="text-neutral-600">·</span>
      <span>#{num}</span>
    </span>
  );
}
