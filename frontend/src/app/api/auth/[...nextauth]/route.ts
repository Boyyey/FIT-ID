import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables for NextAuth Google OAuth."
  );
}

if (!nextAuthUrl) {
  throw new Error(
    "Missing NEXTAUTH_URL environment variable for NextAuth. Set NEXTAUTH_URL to your public app URL, e.g. https://your-render-service.onrender.com"
  );
}

const handler = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account"
        }
      },
      idToken: true
    })
  ],
  secret: process.env.NEXTAUTH_SECRET ?? "development-nextauth-secret",
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
