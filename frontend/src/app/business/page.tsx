"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  HorizontalBarChart,
  MultiLineTrendChart,
  PieChartSvg,
  VerticalBarChartSvg
} from "@/components/business/Charts";
import { fetchBusinessInsights, type BusinessInsights } from "@/lib/api";
import { getFitIdSession } from "@/lib/auth";

type Tab = "intelligence" | "trends" | "partnership";

function formatKpiValue(key: string, v: number): string {
  if (key.includes("registered") || key.includes("users_30") || key.includes("sessions")) {
    return Math.round(v).toLocaleString();
  }
  if (key.includes("completeness") && v <= 1 && v >= 0) return `${Math.round(v * 100)}%`;
  if (key.includes("reduction") || key.includes("measurements_block") || key.endsWith("_pct"))
    return `${Math.round(v * 10) / 10}%`;
  if (Number.isInteger(v)) return Math.round(v).toLocaleString();
  return `${Math.round(v * 1000) / 1000}`;
}

export default function BusinessPortalPage() {
  const session = useMemo(() => getFitIdSession(), []);
  const [tab, setTab] = useState<Tab>("intelligence");
  const [data, setData] = useState<BusinessInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchBusinessInsights(session?.accessToken)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load insights.");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  const trendSeries =
    data?.weekly_trend.map((w) => ({
      week: w.week,
      optInPct: Math.round(w.consent_opt_in_rate * 100),
      scanPct: Math.round(w.avg_scan_confidence * 100)
    })) ?? [];

  const datasetBadge = () => {
    if (!data) return "";
    if (data.dataset === "sandbox_live") return "Sandbox live aggregates (profiles in your FitID deployment)";
    return "Demonstration projections (authenticate with a Business account + JWT to unlock sandbox live)";
  };

  return (
    <main className="dashboard-app fade-in">
      <header className="dashboard-top">
        <div>
          <p className="badge" style={{ margin: 0 }}>
            FitID for Business
          </p>
          <h1 className="title" style={{ margin: "0.45rem 0 0" }}>
            Partner analytics &amp; integrations
          </h1>
          <p className="subtitle">{datasetBadge()}</p>
          {data?.dataset === "sandbox_live" && data.live_meta && (
            <p className="subtitle" style={{ marginTop: "0.35rem" }}>
              Profiles observed this run: {(data.live_meta as { source_profiles_observed?: number }).source_profiles_observed ?? "—"}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/" className="button secondary">
            FitID overview
          </Link>
          <Link href="/partner/console" className="button secondary">
            OAuth console
          </Link>
          <Link href="/partner/demo" className="button secondary">
            Reference storefront
          </Link>
          <Link href="/dashboard" className="badge" style={{ padding: "0.55rem 0.95rem", cursor: "pointer" }}>
            Shopper dashboard
          </Link>
        </div>
      </header>

      <nav className="dashboard-tabs" aria-label="Business sections">
        {(
          [
            ["intelligence", "Intelligence"],
            ["trends", "Market signals"],
            ["partnership", "Partnership"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`dashboard-tab ${tab === id ? "dashboard-tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <p style={{ color: "#b91c1c" }} role="alert">
          {error}
        </p>
      )}

      {!data && !error && <p className="subtitle">Loading datasets…</p>}

      {data && tab === "intelligence" && (
        <div className="lift" style={{ display: "grid", gap: "1rem" }}>
          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>Executive KPIs</h2>
            <p className="subtitle">Numerical rails update automatically when shopper profiles ingest into this sandbox.</p>
            <div className="grid grid-2" style={{ marginTop: "0.85rem" }}>
              {Object.entries(data.kpis).map(([k, v]) => (
                <div key={k} className="business-kpi lift">
                  <p className="subtitle" style={{ margin: 0, textTransform: "capitalize" }}>
                    {k.replace(/_/g, " ")}
                  </p>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>
                    {typeof v === "number" ? formatKpiValue(k, v) : String(v)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-2">
            <div className="card lift" style={{ borderRadius: "16px", padding: "1rem" }}>
              <PieChartSvg title="Gender mix (tagged shopper cohort)" slices={data.gender_split.map((g) => ({ label: g.label, pct: g.pct }))} />
            </div>
            <div className="card lift" style={{ borderRadius: "16px" }}>
              <HorizontalBarChart
                title="Silhouette preferences"
                rows={data.silhouette_preferences.map((s) => ({ label: s.label, value: s.pct }))}
                barMax={100}
                suffix="%"
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card lift" style={{ borderRadius: "16px" }}>
              <HorizontalBarChart
                title="Reported sensitivities (material mentions)"
                rows={data.top_allergens.map((a) => ({ label: a.material, value: a.share_pct }))}
                barMax={100}
                suffix="%"
              />
            </div>
            <div className="card lift" style={{ borderRadius: "16px" }}>
              <VerticalBarChartSvg
                title="Size demand index bands"
                labels={data.size_demand_index.map((s) => s.band)}
                values={data.size_demand_index.map((s) => s.index)}
              />
            </div>
          </div>
        </div>
      )}

      {data && tab === "trends" && (
        <div className="lift" style={{ display: "grid", gap: "1rem" }}>
          <div className="card lift" style={{ borderRadius: "16px" }}>
            <MultiLineTrendChart
              title="Multi-line telemetry"
              legend={["Consent opt-in (%)", "Scan confidence proxy (%)"]}
              series={trendSeries}
            />
          </div>

          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>Body-shape cluster cards</h2>
            <p className="subtitle">Sizing priors synthesized from torso + hip deltas in this cohort — use them to bias pattern blocks.</p>
            <div className="grid grid-2" style={{ marginTop: "0.85rem" }}>
              {data.chest_waist_clusters.map((c) => (
                <article key={c.cluster} className="card" style={{ borderRadius: "14px" }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{c.cluster}</p>
                  <p className="subtitle">{c.share_pct}% modeled share</p>
                  <p style={{ margin: "0.45rem 0 0", lineHeight: 1.55 }}>{c.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>Heuristic retailer guidance</h2>
            <p className="subtitle">
              Deterministic narratives derived from aggregates today — swap for an LLM with signed evidence packs when deploying to VPC.
            </p>
            <div className="grid grid-2" style={{ marginTop: "0.75rem" }}>
              {data.ai_recommendations.map((rec) => (
                <article key={rec.title} className="business-ai-card lift">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{rec.title}</h3>
                    <span className="badge">{rec.impact}</span>
                  </div>
                  <p style={{ margin: "0.65rem 0 0", lineHeight: 1.55 }}>{rec.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {data && tab === "partnership" && (
        <div className="lift" style={{ display: "grid", gap: "1rem" }}>
          <section className="panel" style={{ borderRadius: "18px", boxShadow: "none" }}>
            <h2 style={{ marginTop: 0 }}>{data.partnership.headline}</h2>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.65 }}>
              {data.partnership.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>

          <section className="card lift" style={{ borderRadius: "16px" }}>
            <h3 style={{ marginTop: 0 }}>Operational workflow</h3>
            <ol style={{ paddingLeft: "1.25rem", lineHeight: 1.65, marginBottom: "0.75rem" }}>
              <li>Create a FitID account with Business role credentials.</li>
              <li>Launch the OAuth console below to whitelist redirect URIs and capture client_secret once.</li>
              <li>Send shoppers to `{process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1"}/oauth/authorize?...`.</li>
              <li>Exchange authorization codes ONLY on your server with `grant_type=authorization_code`.</li>
              <li>Cache partner bearer tokens and refresh using your own policy — FitID rotates scopes per consent snapshot.</li>
            </ol>
            <Link href="/partner/console" className="button" style={{ display: "inline-block" }}>
              Open OAuth application console
            </Link>
            <Link href="/partner/demo" className="button secondary" style={{ marginLeft: "0.65rem", display: "inline-block" }}>
              Try reference storefront
            </Link>
          </section>

          <section className="card lift" style={{ borderRadius: "16px" }}>
            <h3 style={{ marginTop: 0 }}>Why account types coexist</h3>
            <p style={{ lineHeight: 1.65 }}>
              FitID isolates shopper identity ergonomics from partner integration paperwork. Consumers never see OAuth secret management;
              businesses never touch raw passports — only negotiated profile slices surfaced through consent.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
