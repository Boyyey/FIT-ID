import { PRODUCTS } from "@/data/products";

export function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <h1>New season essentials</h1>
        <p>
          Curated apparel and accessories. Connect FitID from the <strong>Fit ID</strong> button top-right for sizing
          and profile-aware personalization in partner integrations.
        </p>
      </section>

      <div className="grid">
        {PRODUCTS.map((p) => (
          <article key={p.id} className="card-product">
            <img src={p.img} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer-when-downgrade" />
            <div className="meta">
              <span className="title">{p.title}</span>
              <span className="price">{p.price}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
