// Demo-mode coach: the same built-in library the server falls back to (api/coach_library.json),
// with the same picking rules as api/coach.py. Meal ideas are scored with the mock curve.
import library from "../../api/coach_library.json";
import { curveFor } from "./mock";
import type { CoachMeal, CoachQuest, MealIdea, MealIdeasRequest, MealIdeasResponse, QuestCategory, QuestsRequest, QuestsResponse } from "./types";

interface LibQuest { id: string; category: QuestCategory; fits: string[]; title: string; why: string }
interface LibMeal extends Omit<MealIdea, "peak_delta_mg_dl" | "peak_minute" | "tier" | "source"> { meal_types: string[]; diet: string[] }

const QUESTS = library.quests as LibQuest[];
const MEALS = library.meals as LibMeal[];
export const XP: Record<QuestCategory, number> = { move: 15, order: 15, pair: 15, swap: 15, cook: 20, plan: 10, hydrate: 10, sleep: 10, stress: 10 };
const MINUTES = [0, 15, 30, 45, 60, 75, 90, 105, 120];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mealTags(meal: CoachMeal | undefined, hour: number) {
  const tags = new Set(["any"]);
  if (hour >= 17) tags.add("evening");
  if (meal) {
    if (meal.carbs >= 60) tags.add("high_carb");
    if ((meal.fiber ?? 0) < 6) tags.add("low_fiber");
    if ((meal.protein ?? 0) < 20) tags.add("low_protein");
    if ((meal.peak ?? 0) >= 45) tags.add("high_peak");
  }
  return tags;
}

export function libraryQuests(meal: CoachMeal | undefined, hour: number, count: number, exclude: string[], seed: string): CoachQuest[] {
  const tags = mealTags(meal, hour);
  const fit = (q: LibQuest) => q.fits.filter((f) => f !== "any" && tags.has(f)).length;
  const pool = QUESTS.filter((q) => !exclude.includes("lib-" + q.id))
    .sort((a, b) => fit(b) - fit(a) || hash(seed + a.id) - hash(seed + b.id));
  const out: LibQuest[] = [];
  for (const q of pool) {
    if (!out.some((o) => o.category === q.category)) out.push(q);
    if (out.length === count) break;
  }
  return out.map((q) => ({ id: "lib-" + q.id, title: q.title, why: q.why, category: q.category, xp: XP[q.category] }));
}

function note(meal?: CoachMeal) {
  if (!meal) return "Snap a meal and the coach will tailor these to what you ate.";
  const name = meal.label.toLowerCase().replace(/^your /, "");
  if (meal.carbs >= 60) return `Your ${name} was carb-heavy, so moving after eating and adding fiber help most.`;
  if ((meal.fiber ?? 0) < 6) return `Your ${name} was low in fiber. Beans, veggies or whole grains would steady it.`;
  return `Your ${name} looked balanced. These keep the streak going.`;
}

export async function mockQuests(req: QuestsRequest): Promise<QuestsResponse> {
  await sleep(500);
  return {
    quests: libraryQuests(req.meals[0], req.hour, req.count ?? 3, req.exclude ?? [], req.seed ?? ""),
    coach_note: note(req.meals[0]),
    source: "library",
    model: null,
  };
}

export async function mockMealIdeas(req: MealIdeasRequest): Promise<MealIdeasResponse> {
  await sleep(500);
  const budget = req.budget ?? 3, diet = req.diet ?? "any", exclude = req.exclude ?? [];
  const words = (req.pantry ?? "").toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const ideas = MEALS
    .filter((m) => m.meal_types.includes(req.meal_type) && m.cost_usd <= budget && (diet === "any" || m.diet.includes(diet)))
    .map((m) => {
      const delta = curveFor(m.macros);
      const k = delta.indexOf(Math.max(...delta));
      const hits = words.filter((w) => m.ingredients.some((i) => i.toLowerCase().includes(w))).length;
      const { meal_types: _t, diet: _d, ...rest } = m;
      return { idea: { ...rest, peak_delta_mg_dl: delta[k], peak_minute: MINUTES[k], tier: "basic" as const, source: "library" as const }, hits };
    })
    .sort((a, b) => Number(exclude.includes(a.idea.id)) - Number(exclude.includes(b.idea.id)) || b.hits - a.hits || a.idea.peak_delta_mg_dl - b.idea.peak_delta_mg_dl)
    .slice(0, req.count ?? 3)
    .map((x) => x.idea);
  return { ideas, source: "library", model: null, model_version: "mock-0.1" };
}
