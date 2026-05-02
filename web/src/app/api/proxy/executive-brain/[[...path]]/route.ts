import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

async function forward(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const session = await auth();
  if (!session?.accessToken) return new Response("Unauthorized", { status: 401 });
  const { path } = await ctx.params;
  const tail = path?.length ? "/" + path.join("/") : "";
  const target = `${API_BASE}/api/v1/executive-brain${tail}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "application/json",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  const override = (await cookies()).get("altaris_tenant_override")?.value;
  if (override) headers["X-Tenant-Override"] = override;

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const upstream = await fetch(target, { method: req.method, headers, body });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}

export const GET    = forward;
export const POST   = forward;
export const PUT    = forward;
export const PATCH  = forward;
export const DELETE = forward;
