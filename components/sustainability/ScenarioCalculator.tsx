"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Period } from "@/lib/sustainability-analytics";
import CampusEnergyDemo from "@/components/sustainability/CampusEnergyDemo";

type Measure = { unit: string; current: number | null; previous: number | null };
type Summary = {
  period: Period;
  timezone: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  electricity: Measure;
  water: Measure;
  wasteGenerated: Measure;
  wasteDiverted: Measure;
};
type Reading = {
  id: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string;
  location: string;
  recordedAt: string;
  readingType: string;
};
type PageResult = { period: Period; data: Summary | null; readings: Reading[]; error: string };

const PAGE_SIZE = 25;
const NO_READINGS: Reading[] = [];
const titles: Record<Period, string> = { today: "Today", week: "This week", month: "This month", all: "All data" };
const comparisonMetrics = [
  { key: "electricity", title: "Electricity", unit: "kWh" },
  { key: "water", title: "Water use", unit: "L" },
  { key: "wasteGenerated", title: "Waste generated", unit: "kg" },
  { key: "wasteDiverted", title: "Waste diverted", unit: "kg" },
] as const;

export default function ScenarioCalculator({ role }: { role: string }) {
  const [period, setPeriod] = useState<Period>("today");
  const [result, setResult] = useState<PageResult | null>(null);
  const [page, setPage] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sustainability?period=${period}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
      .then(async (response) => {
        const text = await response.text();
        let body: { error?: string; data?: Summary; readings?: Reading[] };
        try {
          body = JSON.parse(text) as typeof body;
        } catch {
          throw new Error("Sustainability service returned an unreadable response.");
        }
        if (!response.ok) throw new Error(body.error ?? "Sustainability data could not be loaded.");
        if (!body.data) throw new Error("Supabase did not return the sustainability summary.");
        return body as { data: Summary; readings: Reading[] };
      })
      .then((body) => {
        if (!cancelled) {
          setResult({ period, data: body.data, readings: body.readings ?? [], error: "" });
          setPage(0);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ period, data: null, readings: [], error: cause instanceof DOMException && cause.name === "TimeoutError" ? "The sustainability request timed out. Please retry." : cause instanceof Error ? cause.message : "Sustainability data could not be loaded." });
      });
    return () => { cancelled = true; };
  }, [period, reloadToken]);

  const current = result?.period === period ? result : null;
  const data = current?.data ?? null;
  const readings = current?.readings ?? NO_READINGS;
  const error = current?.error ?? "";
  const loading = current === null;
  const pageCount = Math.max(1, Math.ceil(readings.length / PAGE_SIZE));
  const pageReadings = readings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const availableMetrics = useMemo(() => [...new Set(readings.map((reading) => reading.metric))].sort(), [readings]);
  const activeMetric = availableMetrics.includes(selectedMetric) ? selectedMetric : (availableMetrics[0] ?? "");
  const trendReadings = readings
    .filter((reading) => reading.metric === activeMetric)
    .slice(0, 14)
    .reverse();

  return (
    <main className="sustainability-page">
      <Link className="back-link" href={`/workspace/${role}`}>← Workspace</Link>
      <CampusEnergyDemo role={role}/>
      <header>
        <p className="eyebrow">SUSTAINABILITY · MEASURED CAMPUS DATA</p>
        <h1>Campus resource dashboard</h1>
        <p>Measured Supabase sensor data, period comparisons, and recent device readings.</p>
      </header>

      <div className="period-tabs" role="group" aria-label="Reporting period">
        {(["today", "week", "month", "all"] as const).map((item) => (
          <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)} aria-pressed={period === item}>{titles[item]}</button>
        ))}
      </div>
      {error && <div className="auth-notice" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={() => setReloadToken((token) => token + 1)}>Retry</button></div>}

      {loading ? <section className="sustainability-grid"><article className="panel glass-panel"><p>Loading measured readings…</p></article></section> : data && <>
        <section className="sustainability-grid">
          <MeasureCard title="Electricity" value={data.electricity.current} previous={data.electricity.previous} unit="kWh" />
          <MeasureCard title="Water use" value={data.water.current} previous={data.water.previous} unit="L" />
          <MeasureCard title="Waste generated" value={data.wasteGenerated.current} previous={data.wasteGenerated.previous} unit="kg" />
          <MeasureCard title="Waste diverted" value={data.wasteDiverted.current} previous={data.wasteDiverted.previous} unit="kg" />
          <ComparisonChart data={data} period={period} />
          <WasteChart data={data} period={period} />
        </section>

        <section className="panel glass-panel sustainability-dataset">
          <div className="panel-heading">
            <div><p className="eyebrow">SUPABASE · SENSOR DATASET</p><h2>Imported sensor readings</h2>
              <p className="muted">Showing {readings.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, readings.length)} of ` : ""}{readings.length.toLocaleString()} newest readings loaded (up to 10,000).</p>
            </div>
            <span className="dataset-count">{readings.length.toLocaleString()} rows</span>
          </div>
          {readings.length === 0 ? <p className="empty-state">No sensor readings were returned from Supabase.</p> : <>
            <div className="dataset-table-wrap"><table className="dataset-table">
              <thead><tr><th>Recorded</th><th>Device</th><th>Metric</th><th>Value</th><th>Type</th><th>Location</th></tr></thead>
              <tbody>{pageReadings.map((reading) => <tr key={reading.id}>
                <td>{new Date(reading.recordedAt).toLocaleString()}</td><td>{reading.deviceId}</td><td>{reading.metric.replaceAll("_", " ")}</td>
                <td>{reading.value.toLocaleString(undefined, { maximumFractionDigits: 3 })} {reading.unit}</td><td>{reading.readingType.replaceAll("_", " ")}</td><td>{reading.location}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="dataset-pagination"><span>Page {page + 1} of {pageCount}</span><div>
              <button type="button" className="button button-outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
              <button type="button" className="button button-outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</button>
            </div></div>
          </>}
        </section>

        {availableMetrics.length > 0 && <section className="panel glass-panel sustainability-dataset trend-card">
          <div className="panel-heading"><div><p className="eyebrow">RECENT SENSOR TREND</p><h2>Latest readings over time</h2></div>
            <label className="trend-select">Metric<select value={activeMetric} onChange={(event) => setSelectedMetric(event.target.value)}>{availableMetrics.map((metric) => <option key={metric} value={metric}>{metric.replaceAll("_", " ")}</option>)}</select></label>
          </div>
          <ReadingTrend readings={trendReadings} />
        </section>}

        <p className="muted small">Campus time zone: {data.timezone}. {period === "all" ? `Totals include all returned readings through ${new Date(data.end).toLocaleString()}.` : `${titles[period]} window: ${new Date(data.start).toLocaleString()} – ${new Date(data.end).toLocaleString()}. Comparison uses the matching elapsed time in the previous period.`}</p>
      </>}
    </main>
  );
}

function MeasureCard({ title, value, previous, unit }: { title: string; value: number | null; previous: number | null; unit: string }) {
  const delta = value !== null && previous !== null ? previous - value : null;
  return <article className="panel glass-panel sustainability-measure">
    <p className="eyebrow">{title.toUpperCase()}</p><strong>{value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`}</strong>
    <p>{value === null ? "No measured readings in this period" : delta === null ? "No matching prior-period readings" : `${delta >= 0 ? "↓" : "↑"} ${Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit} vs prior period`}</p>
    <small>{previous === null ? "Comparison unavailable" : `Prior period: ${previous.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`}</small>
  </article>;
}

function ComparisonChart({ data, period }: { data: Summary; period: Period }) {
  const rows = comparisonMetrics.map((metric) => ({ ...metric, current: data[metric.key].current, previous: data[metric.key].previous }));
  return <article className="panel glass-panel sustainability-chart comparison-chart">
    <div className="chart-heading"><div><p className="eyebrow">{period === "all" ? "FULL DATASET COMPARISON" : "PERIOD COMPARISON"}</p><h2>{period === "all" ? "Totals across all imported data" : `${titles[period]} vs previous`}</h2></div><div className="chart-legend"><span><i className="legend-current"/>{period === "all" ? "All data" : "Current"}</span>{period !== "all" && <span><i className="legend-previous"/>Previous</span>}</div></div>
    <div className="comparison-rows">{rows.map((row) => {
      const max = Math.max(row.current ?? 0, row.previous ?? 0);
      return <div className="comparison-row" key={row.key}>
        <div className="comparison-label"><strong>{row.title}</strong><span>{row.unit}</span></div>
        {row.current === null && (period === "all" || row.previous === null) ? <p className="chart-no-data">No data for this measure</p> : <div className="comparison-bars" aria-label={`${row.title}: current ${row.current ?? "unavailable"} ${row.unit}, previous ${row.previous ?? "unavailable"} ${row.unit}`}>
          <div className="comparison-bar-line"><span className="comparison-current" style={{ width: `${max ? Math.max(2, ((row.current ?? 0) / max) * 100) : 2}%` }}/><b>{row.current === null ? "—" : row.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div>
          {period !== "all" && <div className="comparison-bar-line"><span className="comparison-previous" style={{ width: `${max ? Math.max(2, ((row.previous ?? 0) / max) * 100) : 2}%` }}/><b>{row.previous === null ? "—" : row.previous.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div>}
        </div>}
      </div>;
    })}</div>
  </article>;
}

function WasteChart({ data, period }: { data: Summary; period: Period }) {
  const generated = data.wasteGenerated.current;
  const diverted = data.wasteDiverted.current;
  return <article className="panel glass-panel sustainability-chart">
    <p className="eyebrow">WASTE COMPOSITION · {titles[period].toUpperCase()}</p><h2>Diverted vs remaining</h2>
    {generated === null || diverted === null ? <p className="empty-state">Insufficient measured waste data for a proportion chart.</p> : diverted > generated ? <p className="empty-state">Waste readings conflict: diverted mass exceeds generated mass.</p> : <>
      <div className="waste-bar"><span style={{ width: `${generated === 0 ? 0 : 100 * diverted / generated}%` }}/></div>
      <p>{diverted.toLocaleString()} kg diverted · {(generated - diverted).toLocaleString()} kg remaining of {generated.toLocaleString()} kg measured</p>
    </>}
  </article>;
}

function ReadingTrend({ readings }: { readings: Reading[] }) {
  if (readings.length === 0) return <p className="empty-state">No readings are available for this metric yet.</p>;
  const width = 720;
  const height = 230;
  const padding = { top: 20, right: 18, bottom: 48, left: 54 };
  const values = readings.map((reading) => reading.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(1, Math.abs(max) * 0.1);
  const points = readings.map((reading, index) => {
    const x = readings.length === 1 ? width / 2 : padding.left + (index / (readings.length - 1)) * (width - padding.left - padding.right);
    const y = height - padding.bottom - ((reading.value - min) / range) * (height - padding.top - padding.bottom);
    return { x, y, reading };
  });
  return <div className="trend-plot-wrap"><svg className="trend-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Latest ${readings.length} ${readings[0].metric.replaceAll("_", " ")} readings over time`}>
    {[0, 1, 2, 3].map((step) => { const y = padding.top + step * (height - padding.top - padding.bottom) / 3; return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="trend-grid-line"/>; })}
    <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="trend-line"/>
    {points.map((point) => <g key={point.reading.id}><circle cx={point.x} cy={point.y} r="4" className="trend-point"><title>{`${point.reading.value} ${point.reading.unit} · ${new Date(point.reading.recordedAt).toLocaleString()} · ${point.reading.location}`}</title></circle></g>)}
    <text x={padding.left} y={height - 12} className="trend-axis-label">{new Date(readings[0].recordedAt).toLocaleDateString()}</text>
    <text x={width - padding.right} y={height - 12} textAnchor="end" className="trend-axis-label">{new Date(readings[readings.length - 1].recordedAt).toLocaleDateString()}</text>
    <text x="8" y={padding.top + 4} className="trend-axis-label">{max.toLocaleString(undefined, { maximumFractionDigits: 2 })} {readings[0].unit}</text>
    <text x="8" y={height - padding.bottom} className="trend-axis-label">{min.toLocaleString(undefined, { maximumFractionDigits: 2 })} {readings[0].unit}</text>
  </svg><p className="trend-caption">Plotted in time order from the latest 14 readings. Hover a point for its value, time, and location.</p></div>;
}
