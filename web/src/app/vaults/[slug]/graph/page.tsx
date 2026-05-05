"use client";

// Vault graph view — Cytoscape.js + cytoscape-fcose. The canvas-based
// custom force simulation that lived here before was the source of repeated
// black-screen regressions; this rewrite delegates layout, hit-testing,
// pan/zoom, and animation to a battle-tested library and wraps it with
// the Obsidian feature set.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

type Node = { id: string; label: string; path: string | null; group: string };
type Edge = { source: string; target: string };

// Cytoscape only runs in the browser — dynamic import + ssr: false so the
// page shell renders instantly and the heavy graph engine streams in.
const VaultGraph = dynamic(() => import("../_components/VaultGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
      Graph yükleniyor…
    </div>
  ),
});

export default function VaultGraphPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/proxy/vaults/${slug}/graph`, { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setError(await r.text());
          return;
        }
        const json = (await r.json()) as { nodes: Node[]; edges: Edge[] };
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/vaults/${slug}`}
            className="text-xs text-neutral-400 hover:text-orange-400"
          >
            ← Dosyalar
          </Link>
          <h1 className="text-base font-semibold">{slug} · graph</h1>
          {data && (
            <span className="text-xs text-neutral-500">
              {data.nodes.length} node · {data.edges.length} edge
            </span>
          )}
        </div>
        <div className="text-[10px] text-neutral-600">
          tap = aç · sağ tık = local graph · scroll = zoom · drag = pan
        </div>
      </header>
      <div className="relative flex-1">
        {error && (
          <p className="absolute left-4 top-4 rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400">
            {error}
          </p>
        )}
        {data && (
          <VaultGraph
            nodes={data.nodes}
            edges={data.edges}
            onNodeOpen={(path) => {
              // Vault dosya görüntüleyicisine yönlendir; orada ilgili dosya açılır.
              // path null olan synthetic node'lar (kategoriler vb.) onNodeOpen'a
              // gönderilmeden önce VaultGraph'ta filtrelenir.
              router.push(`/vaults/${slug}?file=${encodeURIComponent(path)}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
