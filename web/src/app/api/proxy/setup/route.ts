// /setup endpoint is intentionally unauthenticated — install instructions
// are public. CLI veya Desktop matrix'i ?kind=cli|desktop ile seç.
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") === "desktop" ? "desktop" : "cli";
  const target = `${API_BASE}/api/v1/setup/${kind}${req.nextUrl.search}`;
  const upstream = await fetch(target, { headers: { Accept: "application/json" } });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}
