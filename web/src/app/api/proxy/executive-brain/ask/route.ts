import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return new Response("Unauthorized", { status: 401 });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
  const override = (await cookies()).get("altaris_tenant_override")?.value;
  if (override) headers["X-Tenant-Override"] = override;
  const body = await req.text();
  const r = await fetch(`${API_BASE}/api/v1/executive-brain/ask`, { method: "POST", headers, body });
  return new Response(await r.text(), {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" }
  });
}
