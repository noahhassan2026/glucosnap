// GlucoSnap Quest rules. Pure functions over a plain state object so they are easy to test.
// Guardrails: XP rewards logging, balance and movement, never eating less; base XP is
// capped per day; a missed day can cost a streak, never a level or a pet stage.
// Tokens follow XP (so the same cap and guardrails apply) and only buy cosmetics.
import { choiceFor, speciesName, type Element, type Form, type PetPath } from "./pets";
import { DEFAULT_LOOK, itemById, type Look, type Slot } from "./shop";

export const TIERS = [
  { days: 0, mult: 1, label: "Start" },
  { days: 3, mult: 1.25, label: "3 days" },
  { days: 7, mult: 1.5, label: "7 days" },
  { days: 14, mult: 2, label: "14 days" },
];

export const RANKS: [number, string][] = [[1, "Rookie"], [4, "Explorer"], [8, "Pathfinder"], [12, "Champion"]];

export const EVO = [
  { name: "Egg", lvl: 1, streak: 0 },
  { name: "Hatchling", lvl: 2, streak: 0 },
  { name: "Sprite", lvl: 5, streak: 3 },
  { name: "Guardian", lvl: 9, streak: 7 },
  { name: "Legendary", lvl: 14, streak: 14 },
];

export const DAILY_CAP = 80;
export const MAX_SHIELDS = 2;
export const START_TOKENS = 50;
export const LEVEL_BONUS = 20;
export const EVOLVE_BONUS = 30;
export const tokensFor = (xp: number) => Math.round(xp / 5);
export const MAX_ADDED_XP = 20; // quests from suggestions, the AI coach or meal ideas
export const MAX_ADDED = 8; // added quests per day

export interface Task {
  id: string;
  title: string;
  why: string;
  xp: number;
  check?: string; // what would verify it in the full app
  auto?: boolean; // completed by an action elsewhere in the app, not a button
  category?: string; // coach quests: move, order, pair, swap, cook, ...
}

export interface QuestState {
  playerName: string;
  petName: string;
  date: string; // YYYY-MM-DD of the current quest day
  level: number;
  xp: number;
  streak: number;
  best: number;
  shields: number;
  evo: number;
  todayBase: number;
  activeToday: boolean;
  mealsToday: number;
  done: Record<string, boolean>;
  extraTasks: Task[]; // turned from the latest prediction's suggestions
  lastWeekly: string | null;
  tokens: number;
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  look: Look;
  petPath: PetPath;
  evoReady: boolean; // qualifies for the next stage but needs the player's choice
  lessons: Record<string, number>; // best quiz score per Learn lesson
  riskCheck: { score: number; date: string } | null;
}

export type QuestEvent =
  | { kind: "xp"; gained: number; mult: number; tokens: number }
  | { kind: "capped" }
  | { kind: "level"; level: number }
  | { kind: "evolve"; stage: string }
  | { kind: "evolve-ready"; choice: "element" | "form" }
  | { kind: "shield-earned" }
  | { kind: "shield-used" }
  | { kind: "streak-reset" };

export const xpToNext = (level: number) => 40 + 20 * (level - 1);
export const multiplier = (streak: number) => TIERS.filter((t) => streak >= t.days).at(-1)!.mult;
export const rankFor = (level: number) => RANKS.filter((r) => level >= r[0]).at(-1)![1];

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 864e5);
}

export function fresh(date: string, playerName = "You"): QuestState {
  return {
    playerName, petName: "Glimmer", date,
    level: 1, xp: 0, streak: 0, best: 0, shields: 0, evo: 0,
    todayBase: 0, activeToday: false, mealsToday: 0, done: {}, extraTasks: [], lastWeekly: null,
    tokens: START_TOKENS, owned: [], equipped: {}, look: { ...DEFAULT_LOOK }, petPath: {}, evoReady: false,
    lessons: {}, riskCheck: null,
  };
}

// Fill fields added after a player's state was first saved.
export function migrate(saved: QuestState): QuestState {
  const s = { ...fresh(saved.date), ...saved };
  s.petPath = { ...saved.petPath };
  s.look = { ...DEFAULT_LOOK, ...saved.look };
  if (s.evo >= 2 && !s.petPath.element) s.petPath.element = "leaf";
  if (s.evo >= 3 && !s.petPath.form) s.petPath.form = "wing";
  return s;
}

export function baseTasks(s: QuestState): Task[] {
  const tasks: Task[] = [
    { id: "log1", title: "Snap your first meal today", why: "Every photo helps GlucoSnap learn your meals", xp: 10, auto: true },
    { id: "log3", title: "Snap 3 meals today", why: `${Math.min(3, s.mealsToday)} of 3 logged`, xp: 15, auto: true },
    { id: "beat", title: "Beat your predicted spike", why: "Your sensor compares the real curve to the prediction", xp: 30, check: "CGM" },
  ];
  const weeklyDue = !s.lastWeekly || daysBetween(s.lastWeekly, s.date) >= 7;
  if (weeklyDue || s.done.weekly)
    tasks.push({ id: "weekly", title: "Weekly health snapshot", why: "Run the Health tab with your recent sensor data", xp: 25, auto: true });
  return tasks;
}

// Add a quest to today's list (from a suggestion, the coach or a meal idea). Its XP is clamped so
// no generated quest outweighs the built-in ones, and the daily cap still applies when it's done.
export function addTask(prev: QuestState, task: Task): QuestState {
  if (prev.extraTasks.length >= MAX_ADDED || allTasks(prev).some((t) => t.id === task.id)) return prev;
  const t: Task = { ...task, xp: Math.max(5, Math.min(MAX_ADDED_XP, Math.round(task.xp))) };
  return { ...prev, extraTasks: [...prev.extraTasks, t] };
}

export function allTasks(s: QuestState) {
  return [...baseTasks(s), ...s.extraTasks];
}

function evolve(s: QuestState, events: QuestEvent[]) {
  let next = EVO[s.evo + 1];
  while (next && s.level >= next.lvl && s.streak >= next.streak) {
    const choice = choiceFor(s.evo + 1, s.petPath);
    if (choice) {
      if (!s.evoReady) events.push({ kind: "evolve-ready", choice });
      s.evoReady = true;
      return;
    }
    s.evo += 1;
    s.tokens += EVOLVE_BONUS;
    events.push({ kind: "evolve", stage: speciesName(s.evo, s.petPath) });
    next = EVO[s.evo + 1];
  }
}

// The player picks an element (at Sprite) or a form (at Guardian); the pet then evolves.
export function chooseEvolution(prev: QuestState, pick: Element | Form): { state: QuestState; events: QuestEvent[] } {
  const choice = choiceFor(prev.evo + 1, prev.petPath);
  if (!prev.evoReady || !choice) return { state: prev, events: [] };
  const isElement = pick === "leaf" || pick === "ember" || pick === "tide";
  if ((choice === "element") !== isElement) return { state: prev, events: [] };
  const s: QuestState = { ...prev, evoReady: false, petPath: { ...prev.petPath, [choice]: pick } };
  const events: QuestEvent[] = [];
  evolve(s, events);
  return { state: s, events };
}

export type ShopResult = { state: QuestState; error?: string };

export function buy(prev: QuestState, id: string): ShopResult {
  const item = itemById(id);
  if (!item) return { state: prev, error: "That item isn't in the shop." };
  if (prev.owned.includes(id)) return { state: prev, error: "You already own it." };
  if (item.lesson) return { state: prev, error: "Pass the lesson in Learn to unlock it." };
  if (item.minLevel && prev.level < item.minLevel) return { state: prev, error: `Unlocks at level ${item.minLevel}.` };
  if (prev.tokens < item.price) return { state: prev, error: `You need ${item.price - prev.tokens} more tokens.` };
  return {
    state: { ...prev, tokens: prev.tokens - item.price, owned: [...prev.owned, id], equipped: { ...prev.equipped, [item.slot]: id } },
  };
}

export function toggleEquip(prev: QuestState, id: string): QuestState {
  const item = itemById(id);
  if (!item || !prev.owned.includes(id)) return prev;
  const equipped = { ...prev.equipped };
  if (equipped[item.slot] === id) delete equipped[item.slot];
  else equipped[item.slot] = id;
  return { ...prev, equipped };
}

export function complete(prev: QuestState, taskId: string): { state: QuestState; events: QuestEvent[] } {
  const task = allTasks(prev).find((t) => t.id === taskId);
  if (!task || prev.done[taskId]) return { state: prev, events: [] };
  const s: QuestState = { ...prev, done: { ...prev.done, [taskId]: true } };
  const events: QuestEvent[] = [];
  if (!s.activeToday) {
    s.activeToday = true;
    s.streak += 1;
    s.best = Math.max(s.best, s.streak);
    if (s.streak % 7 === 0 && s.shields < MAX_SHIELDS) {
      s.shields += 1;
      events.push({ kind: "shield-earned" });
    }
  }
  if (taskId === "weekly") s.lastWeekly = s.date;
  const base = Math.min(task.xp, Math.max(0, DAILY_CAP - s.todayBase));
  s.todayBase += base;
  const m = multiplier(s.streak);
  const gained = Math.round(base * m);
  const tokens = tokensFor(gained);
  if (base === 0) events.push({ kind: "capped" });
  else events.push({ kind: "xp", gained, mult: m, tokens });
  s.xp += gained;
  s.tokens += tokens;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    s.tokens += LEVEL_BONUS;
    events.push({ kind: "level", level: s.level });
  }
  evolve(s, events);
  return { state: s, events };
}

// Called when a meal is snapped: counts it and completes the logging tasks.
export function logMeal(prev: QuestState) {
  let state: QuestState = { ...prev, mealsToday: prev.mealsToday + 1 };
  const events: QuestEvent[] = [];
  for (const id of ["log1", "log3"]) {
    if (id === "log3" && state.mealsToday < 3) continue;
    const r = complete(state, id);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

// What the next snap would earn, for the Snap screen. Mirrors logMeal + complete, including the
// streak that today's first completed quest starts and the daily XP cap.
export function snapReward(s: QuestState): { xp: number; tokens: number; toBonus: number; capped: boolean } {
  const toBonus = s.done.log3 ? 0 : Math.max(0, 3 - s.mealsToday);
  const due = baseTasks(s).filter((t) => (t.id === "log1" || (t.id === "log3" && s.mealsToday + 1 >= 3)) && !s.done[t.id]);
  const m = multiplier(s.activeToday ? s.streak : s.streak + 1);
  let room = Math.max(0, DAILY_CAP - s.todayBase);
  const capped = room === 0;
  let xp = 0, tokens = 0;
  for (const t of due) {
    const base = Math.min(t.xp, room);
    room -= base;
    const gained = Math.round(base * m);
    xp += gained;
    tokens += tokensFor(gained);
  }
  return { xp, tokens, toBonus, capped };
}

// Move the quest to a new calendar day. Each fully missed day uses a shield or resets the streak.
export function rollover(prev: QuestState, today: string): { state: QuestState; events: QuestEvent[] } {
  const gap = daysBetween(prev.date, today);
  if (gap <= 0) return { state: prev, events: [] };
  const s: QuestState = { ...prev, date: today, todayBase: 0, activeToday: false, mealsToday: 0, done: {}, extraTasks: [] };
  const events: QuestEvent[] = [];
  // Yesterday counts as missed if nothing was done on it; days in between are missed too.
  let missed = gap - 1 + (prev.activeToday ? 0 : 1);
  if (s.streak === 0) missed = 0;
  while (missed > 0 && s.streak > 0) {
    if (s.shields > 0) {
      s.shields -= 1;
      events.push({ kind: "shield-used" });
    } else {
      s.streak = 0;
      events.push({ kind: "streak-reset" });
    }
    missed -= 1;
  }
  return { state: s, events };
}
