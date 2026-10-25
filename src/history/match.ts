import type { CgmPoint, Curve } from "../api/types";

// A glucose reading the user typed in for a logged meal (finger-stick or a sensor app
// that can't export). minute 0 means just before eating.
export interface Check {
  minute: number;
  mg_dl: number;
}

export interface ActualPoint {
  minute: number;
  mg_dl: number;
  delta: number; // rise above the pre-meal level
}

export interface Actual {
  pre: number | null;
  points: ActualPoint[];
  source: "sensor" | "manual" | "both" | null;
}

const MINUTES = [0, 15, 30, 45, 60, 75, 90, 105, 120];

function nearest(cgm: CgmPoint[], t: number, before: number, after: number) {
  let best: CgmPoint | null = null;
  let bestGap = Infinity;
  for (const p of cgm) {
    const dt = (Date.parse(p.t) - t) / 6e4;
    if (dt < -before || dt > after) continue;
    if (Math.abs(dt) < bestGap) { best = p; bestGap = Math.abs(dt); }
  }
  return best;
}

// What really happened after a meal: sensor readings matched to the predicted curve's
// 15-minute grid, plus any readings the user entered by hand (which win over the sensor at
// the same minute). The pre-meal level comes from a typed "before eating" reading, then the
// sensor, then the prediction's own baseline.
export function actualCurve(at: string, cgm: CgmPoint[], checks: Check[] = [], baseline: number | null = null): Actual {
  const t0 = Date.parse(at);
  const window = cgm.filter((p) => { const d = (Date.parse(p.t) - t0) / 6e4; return d >= -20 && d <= 128; });
  const sensorPre = nearest(window, t0, 20, 5)?.mg_dl ?? null;
  const manualPre = checks.find((c) => c.minute === 0)?.mg_dl ?? null;
  const pre = manualPre ?? sensorPre ?? baseline;

  const byMinute = new Map<number, number>();
  for (const m of MINUTES) {
    if (m === 0 && sensorPre != null) { byMinute.set(0, sensorPre); continue; }
    const p = nearest(window, t0 + m * 6e4, 8, 8);
    if (p) byMinute.set(m, p.mg_dl);
  }
  const typed = checks.filter((c) => c.minute >= 0 && c.minute <= 120);
  const fromSensor = [...byMinute.keys()].some((m) => !typed.some((c) => c.minute === m));
  const fromManual = typed.length > 0;
  for (const c of typed) byMinute.set(c.minute, c.mg_dl);
  if (pre == null) return { pre: null, points: [], source: null };
  if (!byMinute.has(0)) byMinute.set(0, pre);
  // Only the pre-meal level is known: nothing to compare yet.
  if (byMinute.size === 1) return { pre, points: [], source: null };
  const points = [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minute, mg_dl]) => ({ minute, mg_dl, delta: mg_dl - pre }));
  return { pre, points, source: fromSensor && fromManual ? "both" : fromSensor ? "sensor" : "manual" };
}

// Predicted rise at any minute, linearly between the curve's grid points.
export function predictedAt(curve: Curve, minute: number) {
  const m = curve.minutes;
  if (minute <= m[0]) return curve.delta_mg_dl[0];
  for (let i = 1; i < m.length; i++) {
    if (minute <= m[i]) {
      const f = (minute - m[i - 1]) / (m[i] - m[i - 1]);
      return curve.delta_mg_dl[i - 1] + f * (curve.delta_mg_dl[i] - curve.delta_mg_dl[i - 1]);
    }
  }
  return curve.delta_mg_dl.at(-1)!;
}

export interface Comparison {
  mae: number;
  actualPeak: number;
  actualPeakMinute: number;
  n: number; // points after the meal that were compared
  withinTypical: boolean;
}

export function compare(curve: Curve, actual: Actual): Comparison | null {
  const after = actual.points.filter((p) => p.minute > 0);
  if (!after.length) return null;
  const mae = after.reduce((a, p) => a + Math.abs(p.delta - predictedAt(curve, p.minute)), 0) / after.length;
  const top = after.reduce((a, p) => (p.delta > a.delta ? p : a));
  return { mae, actualPeak: top.delta, actualPeakMinute: top.minute, n: after.length, withinTypical: mae <= curve.mae_mg_dl };
}
