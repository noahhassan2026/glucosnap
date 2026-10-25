import { useEffect, useState } from "react";
import { coachQuests, type Source } from "../api/client";
import type { CoachQuest, Profile, QuestCategory, QuestsResponse } from "../api/types";
import { isoDate, type Task } from "../game/quest";
import { load, save } from "../storage";
import type { LoggedMeal } from "./SnapView";

const KEY = "glucosnap-coach";

export const CATEGORY_LABEL: Record<QuestCategory, string> = {
  move: "Move", order: "Food order", pair: "Pair it", swap: "Swap", hydrate: "Water",
  sleep: "Sleep", stress: "Stress", plan: "Plan ahead", cook: "Cook",
};

export const coachTask = (q: CoachQuest): Task =>
  ({ id: "cq-" + q.id, title: q.title, why: q.why, xp: q.xp, category: q.category });

// Custom anti-spike quests from the AI coach, tailored to the latest meals. Asks the server once per
// new meal (and when the player wants new ideas) and keeps the answer for the day.
export function CoachQuests(props: {
  active: boolean;
  history: LoggedMeal[];
  profile: Profile;
  have: string[]; // titles already on today's list
  added: string[]; // task ids on today's list
  onAdd: (t: Task) => void;
}) {
  const today = isoDate(new Date());
  const latest = props.history[0]?.at ?? "none";
  const [saved, setSaved] = useState(() => load<{ key: string; resp: QuestsResponse | null; source: Source | null; shown: string[] }>(
    KEY, { key: "", resp: null, source: null, shown: [] }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = today + "|" + latest;

  async function fetchQuests(fresh: boolean) {
    setBusy(true);
    setError(null);
    const now = new Date();
    const shown = fresh && saved.key === key ? saved.shown : [];
    try {
      const r = await coachQuests({
        meals: props.history.slice(0, 6).map((h) => ({
          label: h.label, carbs: h.carbs, protein: h.macros?.protein, fat: h.macros?.fat, fiber: h.macros?.fiber, peak: h.peak, meal_type: h.mealType,
        })),
        ...(Object.keys(props.profile).length ? { profile: props.profile } : {}),
        hour: now.getHours() + now.getMinutes() / 60,
        count: 3,
        have: props.have,
        exclude: shown,
        seed: key + shown.length,
      });
      const next = { key, resp: r.data, source: r.source, shown: [...shown, ...r.data.quests.map((q) => q.id)] };
      setSaved(next);
      save(KEY, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  // Ask again when the quest tab opens after a new meal or on a new day.
  useEffect(() => {
    if (props.active && saved.key !== key && !busy) fetchQuests(false);
  }, [props.active, key]);

  const resp = saved.key === key ? saved.resp : null;
  return (
    <section className="card coach">
      <div className="spread">
        <h2>Coach quests</h2>
        <button className="ghost small-btn" disabled={busy} onClick={() => fetchQuests(true)}>{busy ? "Thinking…" : "New ideas"}</button>
      </div>
      {resp && <p className="small coach-note">{resp.coach_note}</p>}
      {!resp && busy && <p className="small muted">The coach is reading your meals…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {resp?.quests.map((q) => {
        const added = props.added.includes("cq-" + q.id);
        return (
          <div key={q.id} className="task">
            <span className="t">{q.title}</span>
            <span className="why">{q.why}</span>
            <span className="rw"><span className="tag">{CATEGORY_LABEL[q.category] ?? q.category}</span> +{q.xp} XP</span>
            <button className={added ? "ghost" : ""} disabled={added} onClick={() => props.onAdd(coachTask(q))}>{added ? "In quests" : "+ Quest"}</button>
          </div>
        );
      })}
      {resp && (
        <p className="note">
          {resp.source === "ai" ? <>Made for you by AI ({resp.model}). </> : <>From GlucoSnap's built-in list{saved.source === "demo" ? " (demo mode)" : ""}. </>}
          Quests reward moving, food order and adding fiber or protein, never eating less.
        </p>
      )}
    </section>
  );
}
