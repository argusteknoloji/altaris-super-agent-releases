import { auth } from "@/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET() {
  try {
    const session = await auth();
    const token = session?.accessToken;
    if (!token) {
      console.log("[proxy/me] no token → 401");
      return new Response("Unauthorized", { status: 401 });
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const override = (await cookies()).get("altaris_tenant_override")?.value;
    if (override) headers["X-Tenant-Override"] = override;
    const r = await fetch(`${API_BASE}/api/v1/me`, { headers, cache: "no-store" });
    const body = await r.text();
    if (!r.ok) {
      console.log(`[proxy/me] api→ ${r.status} body=${body.slice(0, 200)}`);
    }
    return new Response(body, { status: r.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[proxy/me] EXCEPTION:", e);
    return new Response(`proxy error: ${(e as Error).message}`, { status: 500 });
  }
}
