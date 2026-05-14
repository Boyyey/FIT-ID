import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="container">
      <section className="card">
        <h1>Authentication Failed</h1>
        <p>Google sign-in could not be completed. Please try again.</p>
        <Link href="/" className="button">
          Back to Home
        </Link>
      </section>
    </main>
  );
}
