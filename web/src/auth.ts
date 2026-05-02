import NextAuth from "next-auth";
import { decode } from "@auth/core/jwt";
import { cookies } from "next/headers";

export type AltarisSession = {
  accessToken?: string;
  idToken?: string;
  tenantSlug?: string;
  /** Keycloak realm rolleri — örn ["tenant_member"] veya ["platform_admin","tenant_admin"]. */
  roles?: string[];
  user?: { name?: string | null; email?: string | null; image?: string | null };
  expires: string;
};

/** Access token'dan realm_access.roles çıkar — ham JWT olarak verilen string'i parse eder. */
function extractRolesFromAccessToken(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    const payload = accessToken.split(".")[1];
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    ) as { realm_access?: { roles?: string[] } };
    return decoded.realm_access?.roles ?? [];
  } catch {
    return [];
  }
}

/** Tenant admin / platform admin kısa-yol kontrolü. */
export function isAdmin(s: AltarisSession | null | undefined): boolean {
  const r = s?.roles ?? [];
  return r.includes("tenant_admin") || r.includes("platform_admin");
}
export function isPlatformAdmin(s: AltarisSession | null | undefined): boolean {
  return (s?.roles ?? []).includes("platform_admin");
}

// Browser redirect için public issuer (localhost), server-side için container DNS
const publicIssuer  = process.env.AUTH_KEYCLOAK_ISSUER!;         // http://localhost:8081/realms/altaris
const serverIssuer  = process.env.AUTH_KEYCLOAK_SERVER_ISSUER     // http://keycloak:8080/realms/altaris
                   ?? publicIssuer;

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth({
  providers: [
    {
      id: "keycloak",
      name: "Keycloak",
      type: "oauth",
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
      authorization: {
        url: `${publicIssuer}/protocol/openid-connect/auth`,
        params: { scope: "openid" },
      },
      token:    `${serverIssuer}/protocol/openid-connect/token`,
      userinfo: `${serverIssuer}/protocol/openid-connect/userinfo`,
      checks: ["pkce", "state"],
      profile(profile: Record<string, unknown>) {
        return {
          id:    profile.sub as string,
          name:  (profile.name  as string) ?? null,
          email: (profile.email as string) ?? null,
          image: (profile.picture as string) ?? null,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        (token as Record<string, unknown>).accessToken = account.access_token;
        (token as Record<string, unknown>).roles = extractRolesFromAccessToken(account.access_token);
      }
      if (account?.id_token)     (token as Record<string, unknown>).idToken     = account.id_token;
      const tid = (profile as { tid?: string } | undefined)?.tid;
      if (tid) (token as Record<string, unknown>).tenantSlug = tid;
      return token;
    },
    async session({ session, token }) {
      const t = token as Record<string, unknown>;
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = t.accessToken;
      s.idToken     = t.idToken;
      s.tenantSlug  = t.tenantSlug;
      s.roles       = t.roles ?? [];
      return session;
    }
  },
  trustHost: true
});

// auth() fonksiyonu OIDC discovery yapmadan session cookie'yi doğrudan decode eder.
// Bu, web container içinden localhost:8081'e erişilememesi sorununu bypass eder.
//
// Auth.js v5 cookie naming:
//   HTTP  (dev) : "authjs.session-token"
//   HTTPS (prod): "__Secure-authjs.session-token"  ← __Secure- prefix zorunlu
// JWT decode salt'ı da aktif cookie name'iyle eşleşmeli, aksi halde token decode fail.
export async function auth(): Promise<AltarisSession | null> {
  try {
    const cookieStore = await cookies();
    // Önce production cookie'sine bak, yoksa dev cookie'sine düş.
    const prodName = "__Secure-authjs.session-token";
    const devName  = "authjs.session-token";
    const prod = cookieStore.get(prodName)?.value;
    const dev  = cookieStore.get(devName)?.value;
    const raw       = prod ?? dev;
    const cookieName = prod ? prodName : devName;
    if (!raw) return null;

    const token = await decode({ token: raw, secret: process.env.AUTH_SECRET!, salt: cookieName });
    if (!token) return null;

    const t = token as Record<string, unknown>;
    return {
      accessToken:  t.accessToken  as string | undefined,
      idToken:      t.idToken      as string | undefined,
      tenantSlug:   t.tenantSlug   as string | undefined,
      roles:        (t.roles as string[] | undefined) ?? extractRolesFromAccessToken(t.accessToken as string | undefined),
      user: {
        name:  (t.name  as string | null) ?? null,
        email: (t.email as string | null) ?? null,
        image: (t.picture as string | null) ?? null,
      },
      expires: new Date(((t.exp as number) ?? 0) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
