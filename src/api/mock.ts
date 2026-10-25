// Stand-in for the model server so the app runs with no backend.
// Same response shape as the real API; numbers come from a simple physiological
// curve, not the trained model.
import type { CgmPoint, Macros, Meal, PredictContext, PredictResponse, RiskRequest, RiskResponse, Suggestion } from "./types";
import { ApiError } from "./errors";

const MINUTES = [0, 15, 30, 45, 60, 75, 90, 105, 120];
const MAE = { sensor: 15.6, labs: 20.1, basic: 24.0 };

// The mock can't see the photo, so every photo is read as the hackathon demo meal:
// a typical plate of spaghetti and meatballs with marinara.
const DEMO_MEAL: Omit<Meal, "confidence"> = {
  label: "Spaghetti and meatballs", calories: 750, carbs: 85, protein: 34, fat: 28, fiber: 7, source: "photo",
  items: [
    { name: "Spaghetti", portion: "2 cups", carbs: 74 },
    { name: "Beef meatballs", portion: "3 medium", carbs: 4 },
    { name: "Marinara sauce", portion: "1/2 cup", carbs: 7 },
  ],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kcal(m: Macros) {
  return m.calories ?? Math.round(4 * m.carbs + 4 * m.protein + 9 * m.fat);
}

export function curveFor(m: Macros, walkMin = 0, preGlucose?: number) {
  const netCarbs = Math.max(0, m.carbs - m.fiber);
  // Fat and protein slow absorption: later, flatter peak.
  const tp = 40 + Math.min(30, m.fat * 0.35 + m.protein * 0.2);
  const blunt = 1 - Math.min(0.35, m.fat * 0.003 + m.protein * 0.004 + m.fiber * 0.012);
  const walk = 1 - Math.min(0.3, walkMin * 0.012);
  const high = preGlucose && preGlucose > 120 ? 1.15 : 1;
  const amp = Math.min(140, netCarbs * 0.95 * blunt * walk * high);
  return MINUTES.map((t) => {
    if (t === 0) return 0;
    const x = t / tp;
    return Math.round(amp * x * Math.exp(1 - x) * 10) / 10;
  });
}

function peak(delta: number[]) {
  let i = 0;
  delta.forEach((v, j) => { if (v > delta[i]) i = j; });
  return { peak_delta_mg_dl: delta[i], peak_minute: MINUTES[i] };
}

function suggestionsFor(m: Macros, walk: number, pre?: number): Suggestion[] {
  const base = peak(curveFor(m, walk, pre)).peak_delta_mg_dl;
  const opts: [Suggestion["kind"], string, string, Macros, number][] = [];
  if (walk < 15) opts.push(["walk", "walk15", "Walk 15 minutes right after eating", m, 15]);
  if (m.carbs > 40)
    opts.push(["swap", "halfcarb", "Swap half the rice, bread or pasta for beans or vegetables",
      { ...m, carbs: m.carbs * 0.7, fiber: m.fiber + 5 }, walk]);
  if (m.fiber < 8)
    opts.push(["add_fiber", "fiber", "Add a side of beans, lentils or a big salad",
      { ...m, carbs: m.carbs + 8, protein: m.protein + 4, fiber: m.fiber + 7 }, walk]);
  if (m.protein < 25)
    opts.push(["add_protein", "protein", "Add a protein side, like eggs, yogurt or chicken",
      { ...m, protein: m.protein + 15, fat: m.fat + 4 }, walk]);
  return opts
    .map(([kind, id, text, mm, w]) => {
      const p = peak(curveFor(mm, w, pre)).peak_delta_mg_dl;
      return { id, kind, text, peak_delta_mg_dl: p, peak_reduction_pct: base > 0 ? Math.round((1 - p / base) * 100) : 0 };
    })
    .filter((s) => s.peak_reduction_pct > 0)
    .sort((a, b) => b.peak_reduction_pct - a.peak_reduction_pct);
}

export async function mockPredict(photo: File | null, ctx: PredictContext): Promise<PredictResponse> {
  await sleep(900);
  let meal: Meal;
  if (ctx.macros) {
    meal = { label: "Your meal", ...ctx.macros, calories: kcal(ctx.macros), confidence: 1, source: "user" };
  } else if (photo) {
    meal = { ...DEMO_MEAL, confidence: 0.92 };
  } else {
    throw new ApiError(422, "Send a photo or macros.");
  }
  const cgm = ctx.cgm_recent ?? ctx.cgm_last_6h;
  const last = cgm?.at(-1)?.mg_dl;
  const pre = last ?? ctx.pre_glucose_mg_dl;
  const tier = cgm?.length ? "sensor" : ctx.profile?.a1c != null ? "labs" : "basic";
  const walk = ctx.walk_after_meal_min ?? 0;
  const delta = curveFor(meal, walk, pre);
  const mae = MAE[tier];
  const band = delta.map((_, i) => (i === 0 ? 0 : mae * 1.28 * Math.min(1, MINUTES[i] / 45)));
  return {
    meal,
    curve: {
      minutes: MINUTES,
      delta_mg_dl: delta,
      delta_low: delta.map((v, i) => Math.round((v - band[i]) * 10) / 10),
      delta_high: delta.map((v, i) => Math.round((v + band[i]) * 10) / 10),
      baseline_mg_dl: pre ?? null,
      ...peak(delta),
      mae_mg_dl: mae,
      tier,
    },
    suggestions: suggestionsFor(meal, walk, pre),
    model_version: "mock-0.1",
  };
}

export async function mockRisk(req: RiskRequest): Promise<RiskResponse> {
  await sleep(700);
  const g = req.cgm.map((p) => p.mg_dl);
  const t = req.cgm.map((p) => Date.parse(p.t));
  const days = g.length ? (Math.max(...t) - Math.min(...t)) / 864e5 : 0;
  if (days < 3) throw new ApiError(422, `Need at least 3 days of CGM data (got ${days.toFixed(1)}).`);
  const mean = g.reduce((a, b) => a + b, 0) / g.length;
  // ADAG relationship between mean glucose and HbA1c.
  const a1c = Math.round(((mean + 46.7) / 28.7) * 10) / 10;
  const soft = (x: number, c: number) => 1 / (1 + Math.exp(-(x - c) * 5));
  const pPre = soft(a1c, 5.7), pT2d = soft(a1c, 6.5);
  const probs = { normal: 1 - pPre, prediabetes: pPre - pT2d, t2d: pT2d };
  const status = (Object.keys(probs) as (keyof typeof probs)[]).reduce((a, b) => (probs[a] >= probs[b] ? a : b));
  return { a1c_estimate: a1c, a1c_mae: 0.43, status, status_probs: probs, days_of_data: Math.round(days * 10) / 10 };
}

// Four days of synthetic 15-minute CGM readings for the "try sample data" button.
export function sampleCgm(meanTarget = 112, days = 4): CgmPoint[] {
  const out: CgmPoint[] = [];
  const start = Date.now() - days * 864e5;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i <= days * 96; i++) {
    const ts = start + i * 9e5;
    const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    let v = meanTarget - 12;
    for (const meal of [8, 13, 19]) {
      const dt = (h - meal) * 60;
      if (dt > 0 && dt < 180) v += 45 * (dt / 50) * Math.exp(1 - dt / 50);
    }
    out.push({ t: new Date(ts).toISOString(), mg_dl: Math.round(v + rnd() * 10) });
  }
  return out;
}

export function lastHours(cgm: CgmPoint[], hours = 6) {
  const end = Date.parse(cgm.at(-1)?.t ?? "");
  return cgm.filter((p) => Date.parse(p.t) >= end - hours * 36e5);
}
