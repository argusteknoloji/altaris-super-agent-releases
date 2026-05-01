"use client";

import { useEffect, useState } from "react";

/**
 * Global connection indicator. Periodically calls /api/proxy/me to confirm
 * the API is reachable; flips red on failure.
 */
export default function PresenceBadge() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const r = await fetch("/api/proxy/me", { cache: "no-store" });
        if (!alive) return;
        setStatus(r.ok ? "ok" : "down");
      } catch {
        if (alive) setStatus("down");
      }
    }
    check();
    const id = setInterval(check, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const color = status === "ok" ? "text-emerald-400" : status === "down" ? "text-red-400" : "text-neutral-500";
  const dot = status === "ok" ? "bg-emerald-400 animate-pulse" : status === "down" ? "bg-red-400" : "bg-neutral-500";
  const label = status === "ok" ? "connected" : status === "down" ? "not connected" : "checking";

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`}></span>
      {label}
    </span>
  );
}
