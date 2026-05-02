import { auth } from "@/auth";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) return new Response("Unauthorized", { status: 401 });
  const target = `${API_BASE}/api/v1/me/totp/setup-url${req.nextUrl.search}`;
  const r = await fetch(target, {
    headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store",
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
