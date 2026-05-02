import { auth } from "@/auth";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { path } = await ctx.params;
  const target = `${API_BASE}/api/v1/admin/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  // Tenant override (platform_admin'in başka tenant'ı görüntülemesi için)
  // — frontend cookie veya header ile yollar; backend yalnız platform_admin
  // role'üne sahip kullanıcılar için uygular.
  const overrideHeader = req.headers.get("x-tenant-override");
  const overrideCookie = req.cookies.get("altaris_tenant_override")?.value;
  const override = overrideHeader || overrideCookie;
  if (override) headers["X-Tenant-Override"] = override;

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const upstream = await fetch(target, { method: req.method, headers, body });
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
