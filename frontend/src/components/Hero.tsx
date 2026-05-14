import Link from "next/link";

export default function Hero() {
  return (
    <section className="card">
      <h1>FitID</h1>
      <p>Create your universal digital fit profile in under 60 seconds.</p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Link className="button" href="/dashboard">
          Continue to Dashboard
        </Link>
        <Link className="button" href="/scan" style={{ background: "#0284c7" }}>
          Start Scan
        </Link>
      </div>
    </section>
  );
}
