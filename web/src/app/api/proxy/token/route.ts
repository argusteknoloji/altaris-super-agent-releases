import { auth } from "@/auth";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function GET() {
  const session = await auth();
  const token = (session as Record<string, unknown> | null)?.accessToken as string | undefined;
  if (!token) return new Response("Unauthorized", { status: 401 });
  return Response.json({ token, wsBase: API_BASE });
}
