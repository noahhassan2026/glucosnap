import { useState } from "react";
import { mealIdeas, type Source } from "../api/client";
import type { Diet, MealIdea, MealIdeasResponse, MealType, Profile } from "../api/types";
import type { Task } from "../game/quest";
import type { LoggedMeal } from "./SnapView";

const BUDGETS = [2, 3, 5];
const DIETS: [Diet, string][] = [["any", "Anything"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"]];

function mealTypeNow(): MealType {
  const h = new Date().getHours();
  return h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : "dinner";
}

export const cookTask = (m: MealIdea): Task =>
  ({ id: "cook-" + m.id, title: `Cook ${m.name}`, why: `Predicted rise about +${Math.round(m.peak_delta_mg_dl)} mg/dL`, xp: 20, category: "cook" });

// Cheap, easy home meals that keep glucose steady. The AI proposes them, the curve model scores each one,
// and a built-in list answers when the AI isn't available.
export function MealsView(props: { profile: Profile; history: LoggedMeal[]; added: string[]; onAdd: (t: Task) => void }) {
  const [mealType, setMealType] = useState<MealType>(mealTypeNow);
  const [budget, setBudget] = useState(3);
  const [diet, setDiet] = useState<Diet>("any");
  const [pantry, setPantry] = useState("");
  const [resp, setResp] = useState<MealIdeasResponse | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the most recent logged meal of the same type, to compare against
  const last = props.history.find((h) => !h.mealType || h.mealType === mealType);

  async function find(more: boolean) {
    setBusy(true);
    setError(null);
    const exclude = more ? shown : [];
    try {
      const r = await mealIdeas({
        meal_type: mealType, diet, budget, pantry: pantry.trim(), count: 3, exclude,
        ...(Object.keys(props.profile).length ? { profile: props.profile } : {}),
      });
      setResp(r.data);
      setSource(r.source);
      setShown([...exclude, ...r.data.ideas.map((i) => i.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get meal ideas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Steady meals on a budget</h2>
        <p className="small muted">Cheap, easy home cooking that keeps your blood sugar from spiking. Every idea gets a predicted curve from the GlucoSnap model.</p>
        <div className="row">
          <label className="field">
            <span>Meal</span>
            <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
          <label className="field">
            <span>Ingredients you have (optional)</span>
            <input value={pantry} maxLength={200} placeholder="eggs, rice, frozen veggies" onChange={(e) => setPantry(e.target.value)} />
          </label>
        </div>
        <div className="spread">
          <div className="seg" role="radiogroup" aria-label="Budget per serving">
            {BUDGETS.map((b) => (
              <button key={b} role="radio" aria-checked={budget === b} onClick={() => setBudget(b)}>Under ${b}</button>
            ))}
          </div>
          <div className="seg" role="radiogroup" aria-label="Diet">
            {DIETS.map(([d, label]) => (
              <button key={d} role="radio" aria-checked={diet === d} onClick={() => setDiet(d)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <button disabled={busy} onClick={() => find(false)}>{busy && !resp ? "Finding meals…" : "Find meals"}</button>
          {resp && <button className="ghost" disabled={busy} onClick={() => find(true)}>{busy ? "Finding…" : "More ideas"}</button>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {resp && resp.ideas.length === 0 && <p className="note">No ideas fit those filters. Try a bigger budget or another diet.</p>}
      {resp?.ideas.map((m) => {
        const added = props.added.includes("cook-" + m.id);
        const lower = last && last.peak > m.peak_delta_mg_dl + 5 ? Math.round(last.peak - m.peak_delta_mg_dl) : 0;
        return (
          <article key={m.id} className="card idea">
            <div className="spread">
              <h2>{m.name}</h2>
              <span className={"rise" + (m.peak_delta_mg_dl < 30 ? " low" : "")}>+{Math.round(m.peak_delta_mg_dl)}<small> mg/dL</small></span>
            </div>
            <div className="pills">
              <span className="pill">${m.cost_usd.toFixed(2)} / serving</span>
              <span className="pill">{m.minutes} min</span>
              <span className="pill">{Math.round(m.macros.carbs)}g carbs · {Math.round(m.macros.protein)}g protein · {Math.round(m.macros.fiber)}g fiber</span>
            </div>
            <p className="small">{m.why}{lower ? ` About ${lower} mg/dL lower than your last ${last!.label.toLowerCase().replace(/^your /, "")}.` : ""}</p>
            <details>
              <summary>Ingredients and steps</summary>
              <ul className="small">{m.ingredients.map((i) => <li key={i}>{i}</li>)}</ul>
              <ol className="small">{m.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </details>
            <div className="spread">
              <span className="small muted">{m.source === "ai" ? "AI idea, checked by our glucose model" : "From the GlucoSnap kitchen"}</span>
              <button className={added ? "ghost" : ""} disabled={added} onClick={() => props.onAdd(cookTask(m))}>{added ? "In quests" : "Cook it · +Quest"}</button>
            </div>
          </article>
        );
      })}
      {resp && (
        <p className="note">
          {resp.source === "ai" ? `Ideas by AI (${resp.model}); ` : source === "demo" ? "Demo mode, built-in ideas; " : "Built-in ideas; "}
          the rise is the model's prediction (typical error about ±20 mg/dL). Costs are rough US grocery prices per serving.
        </p>
      )}
    </div>
  );
}
