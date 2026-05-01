import { auth } from "@/auth";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

// /api/v1/vaults köküne (list + create) erişim için ayrı route, çünkü
// /api/proxy/vaults/[...path]/route.ts boş path kabul etmiyor.
async function forward(req: NextRequest) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return new Response("Unauthorized", { status: 401 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const upstream = await fetch(`${API_BASE}/api/v1/vaults`, { method: req.method, headers, body });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}

export const GET = forward;
export const POST = forward;
