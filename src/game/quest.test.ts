import { describe, expect, it } from "vitest";
import { DAILY_CAP, EVOLVE_BONUS, MAX_ADDED, MAX_ADDED_XP, START_TOKENS, addTask, buy, chooseEvolution, complete, fresh, logMeal, migrate, multiplier, rollover, snapReward, toggleEquip, type QuestState } from "./quest";

const D1 = "2026-10-24";

function withExtra(s: QuestState, xp: number, n: number): QuestState {
  return { ...s, extraTasks: Array.from({ length: n }, (_, i) => ({ id: "t" + i, title: "t", why: "", xp })) };
}

describe("quest rules", () => {
  it("starts a streak and awards XP on the first task of the day", () => {
    const { state, events } = logMeal(fresh(D1));
    expect(state.streak).toBe(1);
    expect(state.xp).toBe(10);
    expect(events[0]).toEqual({ kind: "xp", gained: 10, mult: 1, tokens: 2 });
    expect(state.tokens).toBe(START_TOKENS + 2);
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

  it("asks for an element before evolving into a Sprite, then evolves on the choice", () => {
    let s: QuestState = { ...withExtra(fresh(D1), 10, 1), level: 5, streak: 1, evo: 1 };
    s = complete(s, "t0").state; // streak becomes 2: not enough for Sprite
    expect(s.evoReady).toBe(false);
    s = withExtra(rollover(s, "2026-10-25").state, 10, 1);
    const r = complete(s, "t0"); // streak 3: qualifies, needs a choice
    expect(r.state).toMatchObject({ evo: 1, evoReady: true });
    expect(r.events).toContainEqual({ kind: "evolve-ready", choice: "element" });
    expect(chooseEvolution(r.state, "wing").state).toBe(r.state); // a form is the wrong kind of choice
    const c = chooseEvolution(r.state, "ember");
    expect(c.state).toMatchObject({ evo: 2, evoReady: false, petPath: { element: "ember" } });
    expect(c.state.tokens).toBe(r.state.tokens + EVOLVE_BONUS);
    expect(c.events).toEqual([{ kind: "evolve", stage: "Emberling" }]);
  });

  it("names the Legendary from the element and form", () => {
    let s: QuestState = { ...fresh(D1), level: 14, streak: 14, evo: 2, petPath: { element: "tide" }, evoReady: true };
    const r = chooseEvolution(s, "horn");
    expect(r.state.evo).toBe(4);
    expect(r.events.map((e) => e.kind === "evolve" && e.stage)).toEqual(["Coralhorn", "Abyss Leviathan"]);
    s = r.state;
    expect(s.evoReady).toBe(false);
  });

  it("buys an item only with enough tokens and the required level, and equips it", () => {
    const s: QuestState = { ...fresh(D1), tokens: 100, level: 3 };
    expect(buy(s, "crown").error).toMatch(/level 10/);
    expect(buy({ ...s, tokens: 10 }, "cap").error).toMatch(/20 more/);
    const r = buy(s, "cap");
    expect(r.error).toBeUndefined();
    expect(r.state).toMatchObject({ tokens: 70, owned: ["cap"], equipped: { hat: "cap" } });
    expect(buy(r.state, "cap").error).toMatch(/already/);
    expect(toggleEquip(r.state, "cap").equipped.hat).toBeUndefined();
    expect(toggleEquip(s, "cap")).toBe(s); // not owned
  });

  it("migrates saved state from before tokens and pet paths", () => {
    const old = { ...fresh(D1), evo: 3 } as Partial<QuestState>;
    delete old.tokens; delete old.petPath; delete old.owned;
    const m = migrate(old as QuestState);
    expect(m).toMatchObject({ tokens: START_TOKENS, owned: [], petPath: { element: "leaf", form: "wing" } });
  });

  it("earns a shield every 7 streak days", () => {
    const s: QuestState = { ...fresh(D1), streak: 6 };
    const r = logMeal(s);
    expect(r.state.shields).toBe(1);
  });

  it("adds coach quests once, clamps their XP and limits how many a day", () => {
    let s = addTask(fresh(D1), { id: "ai-1", title: "Walk after dinner", why: "", xp: 500 });
    expect(s.extraTasks[0].xp).toBe(MAX_ADDED_XP);
    expect(addTask(s, { id: "ai-1", title: "again", why: "", xp: 10 })).toBe(s);
    for (let i = 0; i < 20; i++) s = addTask(s, { id: "x" + i, title: "x", why: "", xp: 10 });
    expect(s.extraTasks.length).toBe(MAX_ADDED);
    expect(rollover(s, "2026-10-25").state.extraTasks).toEqual([]);
  });

  it("previews what the next snap earns, matching logMeal", () => {
    let s: QuestState = { ...fresh(D1), streak: 2 }; // the first quest today makes it a 3-day streak (x1.25)
    for (let i = 0; i < 4; i++) {
      const preview = snapReward(s);
      const r = logMeal(s);
      const xp = r.events.reduce((a, e) => a + (e.kind === "xp" ? e.gained : 0), 0);
      const tokens = r.events.reduce((a, e) => a + (e.kind === "xp" ? e.tokens : 0), 0);
      expect(preview).toMatchObject({ xp, tokens });
      s = r.state;
    }
    expect(snapReward(s)).toEqual({ xp: 0, tokens: 0, toBonus: 0, capped: false });
    expect(snapReward({ ...fresh(D1), todayBase: DAILY_CAP })).toMatchObject({ xp: 0, capped: true });
  });
});
