import { auth } from "@/auth";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET() {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const r = await fetch(`${API_BASE}/api/v1/remote-control/sessions`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store"
  });
  return new Response(await r.text(), {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" }
  });
}
