import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "placeholder-google-client-id";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "placeholder-google-client-secret";
const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

const providers = [
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
  }),
];

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "NEXTAUTH WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. Google sign-in will fail until these variables are provided."
  );
}

if (!process.env.NEXTAUTH_URL) {
  console.warn(
    "NEXTAUTH WARNING: NEXTAUTH_URL is not set. Set NEXTAUTH_URL to your public application URL for production deployments."
  );
}

// Runtime debug: log non-sensitive presence of important env vars (temporary)
try {
  console.log("NEXTAUTH_RUNTIME: NEXTAUTH_URL=", process.env.NEXTAUTH_URL || "<unset>");
  console.log(
    "NEXTAUTH_RUNTIME: GOOGLE_CLIENT_ID=",
    process.env.GOOGLE_CLIENT_ID ? "<set>" : "<unset>"
  );
} catch (e) {
  // ignore
}

const handler = NextAuth({
  providers,
  debug: true,
  secret: process.env.NEXTAUTH_SECRET ?? "development-nextauth-secret",
  session: {
    strategy: "jwt",
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

// Runtime hint: log the expected Google OAuth callback URL for debugging
try {
  const callbackUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/auth/callback/google`;
  console.log("NEXTAUTH_RUNTIME: Expected Google callback URL=", callbackUrl);
} catch (e) {
  // ignore
}

export { handler as GET, handler as POST };
