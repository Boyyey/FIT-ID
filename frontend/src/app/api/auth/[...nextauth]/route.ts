import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";

const providers = [];
if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
      idToken: true,
    })
  );
} else {
  console.warn(
    "NEXTAUTH WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. Google sign-in will fail until these variables are provided."
  );
}

if (!nextAuthUrl) {
  console.warn(
    "NEXTAUTH WARNING: NEXTAUTH_URL is not set. Set NEXTAUTH_URL to your public application URL for production deployments."
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
