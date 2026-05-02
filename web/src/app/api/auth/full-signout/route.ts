import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const PUBLIC_ISSUER = process.env.AUTH_KEYCLOAK_ISSUER!;             // browser → localhost:8081
const POST_LOGOUT   = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Hem Next.js session cookie'lerini siler hem de Keycloak SSO session'ını sonlandırır.
// Sırasıyla:
//  1) Local cookie'leri silen Set-Cookie header'larını ekler
//  2) Keycloak end_session_endpoint'e id_token_hint + post_logout_redirect_uri ile redirect
export async function GET(_req: NextRequest) {
  const session = await auth();
  const idToken = session?.idToken;

  const url = new URL(`${PUBLIC_ISSUER}/protocol/openid-connect/logout`);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", POST_LOGOUT);

  const res = NextResponse.redirect(url.toString());

  // Auth.js cookie'lerini sil (HTTP modu, Secure prefix yok)
  for (const name of [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
    "authjs.pkce.code_verifier",
    "authjs.state",
  ]) {
    res.cookies.set(name, "", { path: "/", expires: new Date(0) });
  }

  return res;
}
