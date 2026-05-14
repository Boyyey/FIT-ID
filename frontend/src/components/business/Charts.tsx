"use client";

import type { ReactNode } from "react";

const PALETTE = ["#14b8a6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b", "#94a3b8"];

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = angle - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

type PieSlice = { label: string; pct: number };

export function PieChartSvg({
  slices,
  title,
  size = 200
}: {
  slices: PieSlice[];
  title: string;
  size?: number;
}) {
  const total = slices.reduce((a, b) => a + Math.max(b.pct, 0), 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let cursor = 0;
  const nodes: ReactNode[] = [];
  slices.forEach((s, i) => {
    const frac = Math.max(0, s.pct) / total;
    const start = cursor * 2 * Math.PI;
    const end = (cursor + frac) * 2 * Math.PI;
    cursor += frac;
    if (frac < 0.002) return;
    const large = frac > 0.5 ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r, start);
    const [x1, y1] = polar(cx, cy, r, end);
    const d = [`M ${cx} ${cy}`, `L ${x0} ${y0}`, `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`, "Z"].join(" ");
    nodes.push(<path key={s.label + i} d={d} fill={PALETTE[i % PALETTE.length]} stroke="rgba(15,23,42,0.28)" strokeWidth={0.4} />);
  });
  return (
    <div className="chart-card">
      <p className="subtitle" style={{ margin: "0 0 0.4rem", fontWeight: 700 }}>
        {title}
      </p>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        {nodes}
        <circle cx={cx} cy={cy} r={r * 0.52} fill="var(--card, #fff)" className="pie-hole" />
      </svg>
      <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
        {slices.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--ink)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE[i % PALETTE.length] }} />
            <span>{s.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarChart({
  rows,
  title,
  barMax,
  suffix = "",
  formatter
}: {
  rows: { label: string; value: number }[];
  title: string;
  barMax: number;
  suffix?: string;
  formatter?: (v: number) => string;
}) {
  return (
    <div className="chart-card">
      <p className="subtitle" style={{ margin: "0 0 0.65rem", fontWeight: 700 }}>
        {title}
      </p>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        {rows.map((row, idx) => {
          const w = Math.min(100, Math.round((row.value / Math.max(barMax, 1e-6)) * 100));
          const text = formatter ? formatter(row.value) : `${row.value}${suffix}`;
          return (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", fontSize: "0.88rem" }}>
                <span>{row.label}</span>
                <strong>{text}</strong>
              </div>
              <div className="data-bar-track" style={{ marginTop: "0.2rem", height: 12 }}>
                <div
                  className="data-bar-fill"
                  style={{
                    width: `${w}%`,
                    background: PALETTE[idx % PALETTE.length]
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VerticalBarChartSvg({
  title,
  labels,
  values,
  valueLabel = "Score"
}: {
  title: string;
  labels: string[];
  values: number[];
  valueLabel?: string;
}) {
  const w = 320;
  const h = 200;
  const pad = { l: 40, r: 12, b: 36, t: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxV = Math.max(...values.map((v) => Math.abs(v)), 1);
  const barGap = innerW / (values.length * 1.4);
  const barW = innerW / values.length - barGap / 2;
  return (
    <div className="chart-card">
      <p className="subtitle" style={{ margin: "0 0 0.4rem", fontWeight: 700 }}>
        {title}
      </p>
      <svg width={w} height={h} role="img" aria-label={title}>
        <text x={pad.l} y={16} fill="currentColor" fontSize={11} opacity={0.8}>
          {valueLabel}: {Math.round(maxV)}
        </text>
        {values.map((v, i) => {
          const bh = (v / maxV) * innerH * 0.92;
          const x = pad.l + i * (barW + barGap / 2) + barGap / 4;
          const y = pad.t + innerH - bh;
          const col = PALETTE[i % PALETTE.length];
          return (
            <g key={labels[i] ?? i}>
              <rect x={x} y={y} width={barW} height={bh} fill={col} rx={4} />
              <text
                x={x + barW / 2}
                y={pad.t + innerH + 14}
                textAnchor="middle"
                fill="currentColor"
                fontSize={10}
                opacity={0.85}
              >
                {(labels[i] ?? "").slice(0, 6)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="subtitle" style={{ fontSize: "0.8rem", marginTop: "0.25rem", lineHeight: 1.4 }}>
        Bands: {(labels ?? []).join(" · ")}
      </div>
    </div>
  );
}

export function MultiLineTrendChart({
  title,
  series,
  legend
}: {
  title: string;
  series: { week: string; optInPct: number; scanPct: number }[];
  legend: [string, string];
}) {
  if (!series.length) return null;
  const w = 360;
  const h = 168;
  const pad = { l: 42, r: 18, t: 16, b: 32 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const ys = Math.max(...series.flatMap((p) => [p.optInPct, p.scanPct]), 40);
  const pointsA = series.map((p, i, arr) => {
    const x = pad.l + (i / Math.max(arr.length - 1, 1)) * iw;
    const ya = pad.t + ih - (p.optInPct / ys) * ih;
    return `${x},${ya}`;
  });
  const pointsB = series.map((p, i, arr) => {
    const x = pad.l + (i / Math.max(arr.length - 1, 1)) * iw;
    const yb = pad.t + ih - (p.scanPct / ys) * ih;
    return `${x},${yb}`;
  });
  return (
    <div className="chart-card">
      <p className="subtitle" style={{ margin: "0 0 0.4rem", fontWeight: 700 }}>
        {title}
      </p>
      <svg width={w} height={h} role="img" aria-label={title}>
        <line x1={pad.l} y1={pad.t + ih} x2={pad.l + iw} y2={pad.t + ih} stroke="currentColor" strokeOpacity={0.2} />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke="currentColor" strokeOpacity={0.2} />
        <polyline fill="none" stroke={PALETTE[0]} strokeWidth={2.4} strokeLinejoin="round" points={pointsA.join(" ")} />
        <polyline fill="none" stroke={PALETTE[1]} strokeWidth={2.4} strokeDasharray="5 6" strokeLinejoin="round" points={pointsB.join(" ")} />
        <g opacity={0.75} fontSize={10}>
          {series.map((p, i, arr) => {
            const x = pad.l + (i / Math.max(arr.length - 1, 1)) * iw;
            return (
              <text key={p.week} x={x - 14} y={h - 8} fill="currentColor">
                {p.week}
              </text>
            );
          })}
        </g>
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem 1.25rem",
          marginTop: "0.5rem",
          fontSize: "0.82rem",
          alignItems: "center"
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: PALETTE[0], fontWeight: 600 }}>
          <span style={{ width: 18, height: 3, background: PALETTE[0], borderRadius: 2 }} />
          {legend[0]} (solid)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: PALETTE[1], fontWeight: 600 }}>
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: `3px dashed ${PALETTE[1]}`,
              borderRadius: 1
            }}
          />
          {legend[1]} (dash)
        </span>
      </div>
      <div className="subtitle" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
        Shows consent opt-in versus average scan-confidence trend (sandbox cohort).
      </div>
    </div>
  );
}
