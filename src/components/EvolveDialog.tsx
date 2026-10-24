import { ELEMENTS, FORMS, choiceFor, speciesName, type Element, type Form } from "../game/pets";
import { TIER_NAMES } from "../game/pets";
import type { QuestState } from "../game/quest";
import { Pet } from "./Pet";

export function EvolveDialog({ s, onPick, onLater }: { s: QuestState; onPick: (p: Element | Form) => void; onLater: () => void }) {
  const next = s.evo + 1;
  const choice = choiceFor(next, s.petPath);
  if (!choice) return null;
  const options = choice === "element"
    ? (Object.keys(ELEMENTS) as Element[]).map((k) => ({ id: k, name: ELEMENTS[k].name, blurb: ELEMENTS[k].blurb, path: { ...s.petPath, element: k } }))
    : (Object.keys(FORMS) as Form[]).map((k) => ({ id: k, name: FORMS[k].name, blurb: FORMS[k].blurb, path: { ...s.petPath, form: k } }));
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="evoTitle">
      <div className="dialog">
        <h2 id="evoTitle">{s.petName} is ready to become a {TIER_NAMES[next]}!</h2>
        <p className="small muted">
          {choice === "element" ? "Pick an element. It decides how your pet looks from now on." : "Pick a form for the next two evolutions."} This choice is permanent.
        </p>
        <div className="choices">
          {options.map((o) => (
            <button key={o.id} className="choice" onClick={() => onPick(o.id)}>
              <span className="choice-art"><Pet stage={next} path={o.path} /></span>
              <b>{speciesName(next, o.path)}</b>
              <span className="small muted">{o.name}{choice === "form" && next < 4 ? ` · becomes ${speciesName(4, o.path)}` : ""}</span>
              <span className="small">{o.blurb}</span>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={onLater}>Decide later</button>
      </div>
    </div>
  );
}
