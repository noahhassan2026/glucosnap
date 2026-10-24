// GlucoSnap Quest rules. Pure functions over a plain state object so they are easy to test.
// Guardrails: XP rewards logging, balance and movement, never eating less; base XP is
// capped per day; a missed day can cost a streak, never a level or a pet stage.

export const TIERS = [
  { days: 0, mult: 1, label: "Start" },
  { days: 3, mult: 1.25, label: "3 days" },
  { days: 7, mult: 1.5, label: "7 days" },
  { days: 14, mult: 2, label: "14 days" },
];

export const RANKS: [number, string][] = [[1, "Rookie"], [4, "Explorer"], [8, "Pathfinder"], [12, "Champion"]];

export const GEAR = [
  { lvl: 2, id: "band", name: "Headband" },
  { lvl: 4, id: "shoes", name: "Running shoes" },
  { lvl: 6, id: "pack", name: "Backpack" },
  { lvl: 9, id: "jacket", name: "Trail jacket" },
  { lvl: 12, id: "cape", name: "Champion cape" },
] as const;

export const EVO = [
  { name: "Egg", lvl: 1, streak: 0 },
  { name: "Hatchling", lvl: 2, streak: 0 },
  { name: "Sprite", lvl: 5, streak: 3 },
  { name: "Guardian", lvl: 9, streak: 7 },
  { name: "Legendary", lvl: 14, streak: 14 },
];

export const DAILY_CAP = 80;
export const MAX_SHIELDS = 2;

export interface Task {
  id: string;
  title: string;
  why: string;
  xp: number;
  check?: string; // what would verify it in the full app
  auto?: boolean; // completed by an action elsewhere in the app, not a button
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
}

export type QuestEvent =
  | { kind: "xp"; gained: number; mult: number }
  | { kind: "capped" }
  | { kind: "level"; level: number }
  | { kind: "evolve"; stage: string }
  | { kind: "shield-earned" }
  | { kind: "shield-used" }
  | { kind: "streak-reset" };

export const xpToNext = (level: number) => 40 + 20 * (level - 1);
export const multiplier = (streak: number) => TIERS.filter((t) => streak >= t.days).at(-1)!.mult;
export const rankFor = (level: number) => RANKS.filter((r) => level >= r[0]).at(-1)![1];
export const hasGear = (level: number, id: string) => GEAR.some((g) => g.id === id && level >= g.lvl);

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
  };
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

export function allTasks(s: QuestState) {
  return [...baseTasks(s), ...s.extraTasks];
}

function evolve(s: QuestState, events: QuestEvent[]) {
  let next = EVO[s.evo + 1];
  while (next && s.level >= next.lvl && s.streak >= next.streak) {
    s.evo += 1;
    events.push({ kind: "evolve", stage: next.name });
    next = EVO[s.evo + 1];
  }
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
  if (base === 0) events.push({ kind: "capped" });
  else events.push({ kind: "xp", gained, mult: m });
  s.xp += gained;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
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
