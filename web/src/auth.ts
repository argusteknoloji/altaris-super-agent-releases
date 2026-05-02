import NextAuth from "next-auth";
import { decode } from "@auth/core/jwt";
import { cookies } from "next/headers";

export type AltarisSession = {
  accessToken?: string;
  idToken?: string;
  tenantSlug?: string;
  user?: { name?: string | null; email?: string | null; image?: string | null };
  expires: string;
};

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
      if (account?.access_token) (token as Record<string, unknown>).accessToken = account.access_token;
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
      return session;
    }
  },
  trustHost: true
});

// auth() fonksiyonu OIDC discovery yapmadan session cookie'yi doğrudan decode eder.
// Bu, web container içinden localhost:8081'e erişilememesi sorununu bypass eder.
export async function auth(): Promise<AltarisSession | null> {
  try {
    const cookieStore = await cookies();
    const cookieName = "authjs.session-token";
    const raw = cookieStore.get(cookieName)?.value;
    if (!raw) return null;

    const token = await decode({ token: raw, secret: process.env.AUTH_SECRET!, salt: cookieName });
    if (!token) return null;

    const t = token as Record<string, unknown>;
    return {
      accessToken:  t.accessToken  as string | undefined,
      idToken:      t.idToken      as string | undefined,
      tenantSlug:   t.tenantSlug   as string | undefined,
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
