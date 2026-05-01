import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile && (profile as Record<string, unknown>).tid) {
        token.tenantSlug = (profile as Record<string, unknown>).tid as string;
      }
      return token;
    },
    async session({ session, token }) {
      (session as Record<string, unknown>).accessToken = token.accessToken;
      (session as Record<string, unknown>).tenantSlug = token.tenantSlug;
      return session;
    }
  },
  trustHost: true
});
