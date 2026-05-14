"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchPersonalizedCatalog, type PersonalizedProduct } from "@/lib/api";

const categories = ["shirts", "tshirts", "pants", "jackets", "hoodies", "formal"] as const;

/** Neutral apparel still if a remote URL fails (never random shapes). */
const FALLBACK_APPAREL =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=640&h=900&q=82";

function HubProductPhoto({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const url = broken ? FALLBACK_APPAREL : src;
  return (
    <Image
      src={url}
      alt={alt}
      width={420}
      height={560}
      unoptimized={broken}
      onError={() => setBroken(true)}
      style={{ width: "100%", height: "240px", objectFit: "cover", background: "#0f172a" }}
    />
  );
}

export function FashionHubPanel({
  email,
  showFooterLink = false,
  embedded = false
}: {
  email: string;
  showFooterLink?: boolean;
  /** When true, use heading levels suitable inside the dashboard (h2). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("shirts");
  const [items, setItems] = useState<PersonalizedProduct[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetchPersonalizedCatalog(email, activeCategory, 72)
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
            if (process.env.NODE_ENV === "development") {
              console.info("[FitID FashionHub]", email, activeCategory, rows[0]?.personalized_score);
            }
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not load personalized catalog.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [email, activeCategory]);

  return (
    <>
      <section className="card lift">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.7rem"
          }}
        >
          {embedded ? (
            <h2 className="title" style={{ margin: 0 }}>
              Fashion Hub
            </h2>
          ) : (
            <h1 style={{ margin: 0 }}>Fashion Hub</h1>
          )}
          <span className="badge">Your catalog — ranked by FitID</span>
        </div>
        <p className="subtitle" style={{ marginTop: "0.65rem" }}>
          Every row is scored on the server from your profile (measurements, gender, allergies, preferences, posture, scan
          confidence, and 3D avatar scale when present). Product photos are curated fashion stills. Shop links open each
          brand&apos;s category browse page with the same style of search hint as Gap (stable PLP, not a bare search-only URL).
        </p>
        <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`hub-cat-btn ${activeCategory === cat ? "hub-cat-btn-active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="card lift" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          {embedded ? (
            <h3 className="subtitle" style={{ margin: 0, fontWeight: 700 }}>
              {loading ? "Loading…" : `${items.length} picks for you`}
            </h3>
          ) : (
            <h2 style={{ margin: 0 }}>{loading ? "Loading…" : `${items.length} picks for you`}</h2>
          )}
        </div>
        {error && <p style={{ color: "#b91c1c", marginTop: "0.6rem" }}>{error}</p>}
        <div className="grid grid-3" style={{ marginTop: "0.8rem" }}>
          {items.map((item) => (
            <article
              key={item.sku}
              className="panel lift"
              style={{ borderRadius: "16px", boxShadow: "none", overflow: "hidden", padding: 0 }}
            >
              <HubProductPhoto src={item.image_url} alt={item.title} />
              <div style={{ padding: "0.85rem" }}>
                <p className="subtitle" style={{ marginTop: 0 }}>
                  {item.brand} · {item.merchant.toUpperCase()}
                </p>
                <p style={{ margin: "0.2rem 0", fontWeight: 700 }}>{item.title}</p>
                <p className="subtitle">AED {item.price_aed}</p>
                <p className="subtitle">Size suggestion: {item.recommended_size}</p>
                <p className="subtitle">Material: {item.material}</p>
                <p className="badge">
                  {item.fit_label} · {item.personalized_score}% · {item.fit_profile}
                </p>
                <ul className="subtitle" style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.45 }}>
                  {item.reasons.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  <a
                    className="button secondary"
                    href={item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textAlign: "center" }}
                  >
                    {`Browse on ${item.brand} (category + search hint)`}
                  </a>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      const q = new URLSearchParams({
                        sku: item.sku,
                        title: item.title,
                        category: item.category,
                        color: item.color
                      });
                      router.push(`/try-on?${q.toString()}`);
                    }}
                  >
                    Try On Me
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showFooterLink && (
        <div style={{ marginTop: "1rem" }}>
          <Link href="/dashboard" className="button secondary">
            Back to Dashboard
          </Link>
        </div>
      )}
    </>
  );
}
