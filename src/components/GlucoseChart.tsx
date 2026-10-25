import type { Curve } from "../api/types";
import type { ActualPoint } from "../history/match";

const W = 340, H = 200, L = 40, R = 12, T = 14, B = 30;

// 2-hour post-meal curve with its 80% band. Shows absolute mg/dL when a baseline is known,
// otherwise the rise above the pre-meal level. An optional previous curve is drawn dashed,
// and measured readings (as a rise from before the meal) are drawn on top.
export function GlucoseChart({ curve, previous, actual, nowMinute }: {
  curve: Curve;
  previous?: Curve | null;
  actual?: ActualPoint[];
  nowMinute?: number | null;
}) {
  const base = curve.baseline_mg_dl ?? 0;
  const abs = curve.baseline_mg_dl != null;
  const seen = (actual ?? []).filter((p) => p.minute >= 0 && p.minute <= 120);
  const vals = [...curve.delta_high, ...(previous?.delta_mg_dl ?? []), ...seen.map((p) => p.delta)].map((v) => v + base);
  const lo = Math.min(base, ...[...curve.delta_low, ...seen.map((p) => p.delta)].map((v) => v + base));
  const hiRaw = Math.max(...vals, base + 40);
  const step = 20;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hiRaw / step) * step;
  const x = (m: number) => L + (m / 120) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const line = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(curve.minutes[i]).toFixed(1)},${y(v + base).toFixed(1)}`).join(" ");
  const band =
    curve.delta_high.map((v, i) => `${i ? "L" : "M"}${x(curve.minutes[i]).toFixed(1)},${y(v + base).toFixed(1)}`).join(" ") +
    " " +
    [...curve.delta_low].reverse().map((v, j) => `L${x(curve.minutes[curve.minutes.length - 1 - j]).toFixed(1)},${y(v + base).toFixed(1)}`).join(" ") +
    " Z";
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);
  const pv = curve.peak_delta_mg_dl + base;
  const showLimit = abs && yMax >= 180 && yMin <= 180;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
      aria-label={`Predicted glucose ${abs ? "" : "rise "}peaks at ${Math.round(pv)} mg/dL around ${curve.peak_minute} minutes after eating`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{abs ? v : (v > 0 ? "+" : "") + v}</text>
        </g>
      ))}
      {[0, 30, 60, 90, 120].map((m) => (
        <text key={m} x={x(m)} y={H - 10} className="axis" textAnchor="middle">{m === 0 ? "meal" : `${m}m`}</text>
      ))}
      {showLimit && (
        <>
          <line x1={L} x2={W - R} y1={y(180)} y2={y(180)} className="limit" />
          <text x={W - R} y={y(180) - 4} className="axis" textAnchor="end">180</text>
        </>
      )}
      <path d={band} className="band" />
      {previous && <path d={line(previous.delta_mg_dl)} className="prev" />}
      <path d={line(curve.delta_mg_dl)} className="curve" />
      {nowMinute != null && nowMinute > 0 && nowMinute < 120 && (
        <g>
          <line x1={x(nowMinute)} x2={x(nowMinute)} y1={T} y2={H - B} className="now" />
          <text x={x(nowMinute)} y={T - 3} className="axis" textAnchor="middle">now</text>
        </g>
      )}
      {seen.length > 1 && (
        <path d={seen.map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)},${y(p.delta + base).toFixed(1)}`).join(" ")} className="actual" />
      )}
      {seen.filter((p) => p.minute > 0).map((p) => (
        <circle key={p.minute} cx={x(p.minute)} cy={y(p.delta + base)} r={3} className="actual-dot" />
      ))}
      <circle cx={x(curve.peak_minute)} cy={y(pv)} r={4.5} className="peak" />
      <text x={x(curve.peak_minute)} y={y(pv) - 9} className="peaklabel" textAnchor="middle">
        {abs ? Math.round(pv) : `+${Math.round(curve.peak_delta_mg_dl)}`}
      </text>
    </svg>
  );
}
