import { describe, expect, it } from "vitest";
import { ALL_DONE_BONUS, LESSONS, LESSON_TOKENS, PERFECT_BONUS, RISK_TOKENS, adaRiskScore, finishLesson, finishRiskCheck, passMark } from "./learn";
import { START_TOKENS, buy, fresh, migrate, type QuestState } from "./quest";
import { DEFAULT_LOOK } from "./shop";

const D1 = "2026-10-25";

describe("learning center", () => {
  it("pays a passed lesson once, with a bonus for a perfect score", () => {
    const first = finishLesson(fresh(D1), "blood-sugar", 2);
    expect(first.passed).toBe(true);
    expect(first.tokens).toBe(LESSON_TOKENS);
    const again = finishLesson(first.state, "blood-sugar", 2);
    expect(again.tokens).toBe(0);
    const perfect = finishLesson(again.state, "blood-sugar", 3);
    expect(perfect.tokens).toBe(PERFECT_BONUS);
    expect(finishLesson(perfect.state, "blood-sugar", 3).tokens).toBe(0);
    expect(perfect.state.tokens).toBe(START_TOKENS + LESSON_TOKENS + PERFECT_BONUS);
  });

  it("pays nothing for a failed quiz", () => {
    const r = finishLesson(fresh(D1), "blood-sugar", 1);
    expect(r.passed).toBe(false);
    expect(r.tokens).toBe(0);
    expect(r.state.lessons).toEqual({});
  });

  it("unlocks and equips the starter sensor from the monitor lesson", () => {
    const s = fresh(D1);
    expect(buy(s, "starter").error).toBeTruthy();
    const r = finishLesson(s, "cgm", 3);
    expect(r.unlocked).toBe("starter");
    expect(r.state.owned).toContain("starter");
    expect(r.state.equipped.monitor).toBe("starter");
  });

  it("adds the bonus when the last lesson is passed", () => {
    let s: QuestState = fresh(D1);
    let last = finishLesson(s, LESSONS[0].id, passMark(LESSONS[0].quiz.length));
    for (const l of LESSONS) {
      last = finishLesson(s, l.id, passMark(l.quiz.length));
      s = last.state;
    }
    expect(last.allDone).toBe(true);
    expect(last.tokens).toBe(LESSON_TOKENS + ALL_DONE_BONUS);
  });

  it("pays the risk check once, whatever the score", () => {
    const a = finishRiskCheck(fresh(D1), 7, D1);
    expect(a.tokens).toBe(RISK_TOKENS);
    expect(finishRiskCheck(a.state, 2, D1).tokens).toBe(0);
  });

  it("fills new look and learning fields on old saves", () => {
    const old = { ...fresh(D1), look: { skin: 2, hair: 1, hairColor: 0, shirt: 3 } } as unknown as QuestState;
    delete (old as Partial<QuestState>).lessons;
    const s = migrate(old);
    expect(s.look).toEqual({ ...DEFAULT_LOOK, skin: 2, hair: 1, shirt: 3 });
    expect(s.lessons).toEqual({});
  });
});

describe("ADA risk test", () => {
  const base = { age: 30, sex: "F" as const, gestational: false, family: false, highBp: false, active: true, bmi: 22 };

  it("scores a young, active, lean woman as 0", () => {
    expect(adaRiskScore(base)).toMatchObject({ score: 0, high: false });
  });

  it("scores each factor as in the ADA test", () => {
    expect(adaRiskScore({ ...base, age: 45 }).score).toBe(1);
    expect(adaRiskScore({ ...base, age: 55 }).score).toBe(2);
    expect(adaRiskScore({ ...base, age: 65 }).score).toBe(3);
    expect(adaRiskScore({ ...base, sex: "M" }).score).toBe(1);
    expect(adaRiskScore({ ...base, sex: "M", gestational: true }).score).toBe(1);
    expect(adaRiskScore({ ...base, gestational: true }).score).toBe(1);
    expect(adaRiskScore({ ...base, active: false }).score).toBe(1);
    expect([26, 32, 41].map((bmi) => adaRiskScore({ ...base, bmi }).score)).toEqual([1, 2, 3]);
  });

  it("flags 5 or more as higher risk", () => {
    const r = adaRiskScore({ ...base, age: 52, sex: "M", family: true, bmi: 27 });
    expect(r.score).toBe(5);
    expect(r.high).toBe(true);
    expect(adaRiskScore({ age: 70, sex: "M", gestational: false, family: true, highBp: true, active: false, bmi: 45 }).score).toBe(10);
  });
});
