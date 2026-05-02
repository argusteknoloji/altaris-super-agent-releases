// /setup endpoint is intentionally unauthenticated — install instructions
// are public. We just forward to the API which assembles the per-OS asset
// matrix from the GitHub release URLs.
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET(req: NextRequest) {
  const target = `${API_BASE}/api/v1/setup/cli${req.nextUrl.search}`;
  const upstream = await fetch(target, { headers: { Accept: "application/json" } });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}
