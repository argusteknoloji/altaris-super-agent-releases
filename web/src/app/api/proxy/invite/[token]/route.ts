// Public proxy — no auth required for invite lookup.
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const r = await fetch(`${API_BASE}/api/v1/invite/${encodeURIComponent(token)}`, { cache: "no-store" });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
