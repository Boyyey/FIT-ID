import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "set-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "set-google-client-secret",
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account"
        }
      },
      idToken: true
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.id_token) {
        (token as any).googleIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).googleIdToken = (token as any).googleIdToken;
      return session;
    }
  },
  pages: {
    error: "/auth/error"
  }
});

export { handler as GET, handler as POST };
