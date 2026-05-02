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

  // Auth.js cookie'lerini sil. Production HTTPS'de cookie isimleri __Secure- /
  // __Host- prefix'li olur (Auth.js v5 default). Dev HTTP'de prefix yok. İkisini
  // de silelim. __Host-/__Secure- cookie sadece secure=true ile silinebilir
  // (browser bu kuralı zorlar — eksikse Set-Cookie sessizce drop eder).
  const dev  = ["authjs.session-token", "authjs.csrf-token", "authjs.callback-url",
                "authjs.pkce.code_verifier", "authjs.state"];
  const prod = ["__Secure-authjs.session-token", "__Host-authjs.csrf-token",
                "__Secure-authjs.callback-url", "__Secure-authjs.pkce.code_verifier",
                "__Secure-authjs.state"];
  for (const name of dev) {
    res.cookies.set(name, "", { path: "/", expires: new Date(0) });
  }
  for (const name of prod) {
    res.cookies.set(name, "", { path: "/", expires: new Date(0), secure: true, httpOnly: true, sameSite: "lax" });
  }

  return res;
}
