import { auth } from "@/auth";

const API_BASE        = process.env.ALTARIS_API_BASE        ?? "http://localhost:5000";
// wsBase tarayıcıdan ulaşılır olmalı — server-side container DNS (api:5000)
// burada işe yaramaz. Public host:port'a düşer.
const PUBLIC_API_BASE = process.env.ALTARIS_PUBLIC_API_BASE ?? API_BASE;

export async function GET() {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return new Response("Unauthorized", { status: 401 });
  return Response.json({ token, wsBase: PUBLIC_API_BASE });
}
