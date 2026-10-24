import { describe, expect, it } from "vitest";
import { DAILY_CAP, complete, fresh, logMeal, multiplier, rollover, type QuestState } from "./quest";

const D1 = "2026-10-24";

function withExtra(s: QuestState, xp: number, n: number): QuestState {
  return { ...s, extraTasks: Array.from({ length: n }, (_, i) => ({ id: "t" + i, title: "t", why: "", xp })) };
}

describe("quest rules", () => {
  it("starts a streak and awards XP on the first task of the day", () => {
    const { state, events } = logMeal(fresh(D1));
    expect(state.streak).toBe(1);
    expect(state.xp).toBe(10);
    expect(events[0]).toEqual({ kind: "xp", gained: 10, mult: 1 });
  });

  it("does not award a task twice", () => {
    const a = complete(fresh(D1), "beat").state;
    const b = complete(a, "beat");
    expect(b.events).toEqual([]);
    expect(b.state.xp).toBe(a.xp);
  });

  it("applies streak multipliers at 3, 7 and 14 days", () => {
    expect([0, 2, 3, 6, 7, 13, 14, 30].map(multiplier)).toEqual([1, 1, 1.25, 1.25, 1.5, 1.5, 2, 2]);
  });

  it("caps base XP per day", () => {
    let s = withExtra(fresh(D1), 30, 5);
    for (let i = 0; i < 5; i++) s = complete(s, "t" + i).state;
    expect(s.todayBase).toBe(DAILY_CAP);
    expect(complete(withExtra(s, 30, 6), "t5").events).toContainEqual({ kind: "capped" });
  });

  it("keeps the streak across consecutive active days", () => {
    let s = logMeal(fresh(D1)).state;
    s = rollover(s, "2026-10-25").state;
    s = logMeal(s).state;
    expect(s.streak).toBe(2);
  });

  it("uses a shield for a missed day, then resets, but never drops level or pet", () => {
    let s: QuestState = { ...fresh(D1), streak: 9, shields: 1, level: 6, evo: 2, activeToday: true };
    const r1 = rollover(s, "2026-10-26"); // one full day missed
    expect(r1.events).toEqual([{ kind: "shield-used" }]);
    expect(r1.state.streak).toBe(9);
    s = r1.state; // nothing done on the 26th
    const r2 = rollover(s, "2026-10-27");
    expect(r2.events).toEqual([{ kind: "streak-reset" }]);
    expect(r2.state).toMatchObject({ streak: 0, level: 6, evo: 2 });
  });

  it("evolves the pet only when level and streak both qualify", () => {
    let s: QuestState = { ...withExtra(fresh(D1), 10, 1), level: 5, streak: 1, evo: 1 };
    s = complete(s, "t0").state; // streak becomes 2: not enough for Sprite
    expect(s.evo).toBe(1);
    s = { ...withExtra(rollover(s, "2026-10-25").state, 10, 1) };
    const r = complete(s, "t0"); // streak 3
    expect(r.state.evo).toBe(2);
    expect(r.events).toContainEqual({ kind: "evolve", stage: "Sprite" });
  });

  it("earns a shield every 7 streak days", () => {
    const s: QuestState = { ...fresh(D1), streak: 6 };
    const r = logMeal(s);
    expect(r.state.shields).toBe(1);
  });
});
