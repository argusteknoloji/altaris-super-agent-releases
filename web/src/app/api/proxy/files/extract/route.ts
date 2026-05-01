import { auth } from "@/auth";
import { NextRequest } from "next/server";

const API_BASE = process.env.ALTARIS_API_BASE ?? "http://localhost:5000";

export async function POST(req: NextRequest) {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return new Response("Unauthorized", { status: 401 });

  // Forward the multipart body untouched. Next's edge fetch preserves the
  // Content-Type boundary when we pass through the original body stream.
  const upstream = await fetch(`${API_BASE}/api/v1/files/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": req.headers.get("content-type") ?? "application/octet-stream"
    },
    body: req.body,
    // @ts-expect-error - duplex required for streamed bodies in Node fetch
    duplex: "half"
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}
