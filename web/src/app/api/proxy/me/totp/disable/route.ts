import { auth } from "@/auth";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) return new Response("Unauthorized", { status: 401 });
  const r = await fetch(`${API_BASE}/api/v1/me/totp/disable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  return new Response(null, { status: r.status });
}
