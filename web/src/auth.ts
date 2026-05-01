import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export type AltarisSession = {
  accessToken?: string;
  tenantSlug?: string;
  user?: { name?: string | null; email?: string | null; image?: string | null };
  expires: string;
};

export const { handlers, signIn, signOut, auth: nextAuth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
      authorization: { params: { scope: "openid email profile tenant" } }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) (token as Record<string, unknown>).accessToken = account.access_token;
      const tid = (profile as { tid?: string } | undefined)?.tid;
      if (tid) (token as Record<string, unknown>).tenantSlug = tid;
      return token;
    },
    async session({ session, token }) {
      const t = token as Record<string, unknown>;
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = t.accessToken;
      s.tenantSlug = t.tenantSlug;
      return session;
    }
  },
  trustHost: true
});

export async function auth(): Promise<AltarisSession | null> {
  const s = await nextAuth();
  return s as AltarisSession | null;
}
