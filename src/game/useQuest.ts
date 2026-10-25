import { useCallback, useEffect, useRef, useState } from "react";
import { load, save } from "../storage";
import { addTask, buy, chooseEvolution, complete, fresh, isoDate, logMeal, migrate, rollover, toggleEquip, type QuestEvent, type QuestState, type Task } from "./quest";
import type { Element, Form } from "./pets";
import type { Look } from "./shop";
import { finishLesson, finishRiskCheck, type LessonResult } from "./learn";
import type { Suggestion } from "../api/types";

const KEY = "glucosnap-quest";
const OFFSET_KEY = "glucosnap-day-offset";

// The demo "Next day" button shifts the quest clock forward without touching the real date.
function today(offset: number) {
  return isoDate(new Date(Date.now() + offset * 864e5));
}

export function useQuest(onEvents: (e: QuestEvent[], s: QuestState) => void, defaultName?: string) {
  const [offset, setOffset] = useState(() => load(OFFSET_KEY, { days: 0 }).days);
  const [state, setState] = useState<QuestState>(() => {
    const d = today(offset);
    const saved = migrate(load<QuestState>(KEY, fresh(d, defaultName)));
    return rollover(saved, d).state;
  });
  const notify = useRef(onEvents);
  notify.current = onEvents;

  useEffect(() => save(KEY, state), [state]);
  useEffect(() => save(OFFSET_KEY, { days: offset }), [offset]);

  const apply = useCallback((fn: (s: QuestState) => { state: QuestState; events: QuestEvent[] }) => {
    setState((s) => {
      const r = fn(s);
      if (r.events.length) queueMicrotask(() => notify.current(r.events, r.state));
      return r.state;
    });
  }, []);

  // Pick up a new calendar day if the tab stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => apply((s) => rollover(s, today(offset))), 60_000);
    return () => clearInterval(id);
  }, [apply, offset]);

  return {
    state,
    completeTask: (id: string) => apply((s) => complete(s, id)),
    logMeal: () => apply(logMeal),
    addSuggestion: (sg: Suggestion) =>
      setState((s) => addTask(s, {
        id: "sg-" + sg.kind,
        title: sg.text,
        why: `Predicted peak drops ${sg.peak_reduction_pct}% to +${Math.round(sg.peak_delta_mg_dl)} mg/dL`,
        xp: 20,
        check: sg.kind === "walk" ? "steps" : undefined,
      })),
    addTask: (task: Task) => setState((s) => addTask(s, task)),
    nextDay: (skip: boolean) => {
      const n = offset + (skip ? 2 : 1);
      setOffset(n);
      apply((s) => rollover(s, today(n)));
    },
    reset: (name: string) => {
      setOffset(0);
      setState(fresh(today(0), name));
    },
    rename: (playerName: string, petName: string) => setState((s) => ({ ...s, playerName, petName })),
    chooseEvolution: (pick: Element | Form) => apply((s) => chooseEvolution(s, pick)),
    // Returns an error message when the purchase isn't possible.
    buy: (id: string): string | undefined => {
      const r = buy(state, id);
      if (!r.error) setState(r.state);
      return r.error;
    },
    finishLesson: (id: string, correct: number): LessonResult => {
      const r = finishLesson(state, id, correct);
      if (r.state !== state) setState(r.state);
      return r;
    },
    // Returns the tokens paid (only the first check pays).
    finishRiskCheck: (score: number): number => {
      const r = finishRiskCheck(state, score, state.date);
      setState(r.state);
      return r.tokens;
    },
    toggleEquip: (id: string) => setState((s) => toggleEquip(s, id)),
    setLook: (look: Look) => setState((s) => ({ ...s, look })),
  };
}
