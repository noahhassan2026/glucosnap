import { useEffect, useRef, useState, type CSSProperties } from "react";
import { predict, ApiError, type Source } from "../api/client";
import { lastHours } from "../api/mock";
import type { CgmPoint, Curve, Macros, MealType, PredictContext, PredictResponse, Profile, Suggestion } from "../api/types";
import type { Check } from "../history/match";
import { snapReward, type QuestState } from "../game/quest";
import { GlucoseChart } from "./GlucoseChart";
import { Pet } from "./Pet";

const TIER_TEXT = {
  sensor: "Using your recent sensor data",
  labs: "Using your profile and lab values",
  basic: "Population model. Add a profile or sensor data for a sharper curve",
};

function mealTypeFor(hour: number): MealType {
  if (hour < 10.5) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

export interface LoggedMeal {
  at: string;
  label: string;
  carbs: number;
  peak: number;
  peakMinute: number;
  thumb?: string;
  // Added with the History tab; meals logged before it only have the fields above.
  mealType?: MealType;
  macros?: Macros;
  curve?: Curve;
  demo?: boolean;
  checks?: Check[];
}

// Phone photos are often 3-5 MB, and some formats (like HEIC) aren't accepted by the
// vision model. Re-encode to a JPEG at most 1280 px on the long side when the browser
// can decode the image; otherwise send the original.
async function prepareUpload(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1.5e6) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "meal.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

async function thumbnail(file: File): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    const s = 96 / Math.max(bmp.width, bmp.height);
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}

export function SnapView(props: {
  profile: Profile;
  cgm: CgmPoint[];
  history: LoggedMeal[];
  onLogged: (m: LoggedMeal) => void;
  onAddSuggestion: (s: Suggestion) => void;
  addedSuggestions: string[];
  onOpenHistory?: () => void;
  quest: QuestState;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(() => mealTypeFor(new Date().getHours()));
  const [pre, setPre] = useState("");
  const [walk, setWalk] = useState(0);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [previous, setPrevious] = useState<PredictResponse | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [macros, setMacros] = useState<Macros | null>(null); // user-entered or corrected
  const [editing, setEditing] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [burst, setBurst] = useState(0); // bumps on each logged meal to replay the coin burst
  const q = props.quest;
  const reward = snapReward(q);
  const snapped = Math.min(3, q.mealsToday);
  // Sensor data only describes this meal if it runs up to now (an old upload doesn't).
  const sensorLive = props.cgm.length > 0 && Date.now() - Date.parse(props.cgm.at(-1)!.t) < 30 * 6e4;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setPrevious(null);
    setMacros(null);
    setEditing(false);
    setWalk(0);
    setError(null);
  }

  async function run(opts: { macros?: Macros | null; walk?: number; log?: boolean }) {
    const m = opts.macros === undefined ? macros : opts.macros;
    const w = opts.walk ?? walk;
    const now = new Date();
    const recent = sensorLive ? lastHours(props.cgm, 72) : [];
    const ctx: PredictContext = {
      meal_type: mealType,
      hour: now.getHours() + now.getMinutes() / 60,
      ...(pre && !recent.length ? { pre_glucose_mg_dl: Number(pre) } : {}),
      ...(Object.keys(props.profile).length ? { profile: props.profile } : {}),
      ...(m ? { macros: m } : {}),
      ...(recent.length ? { cgm_recent: recent } : {}),
      walk_after_meal_min: w,
    };
    setBusy(true);
    setError(null);
    try {
      const r = await predict(m || !photo ? null : await prepareUpload(photo), ctx);
      setPrevious(opts.log ? null : result);
      setResult(r.data);
      setSource(r.source);
      if (opts.log) {
        props.onLogged({
          at: now.toISOString(),
          label: r.data.meal.label,
          carbs: r.data.meal.carbs,
          peak: r.data.curve.peak_delta_mg_dl,
          peakMinute: r.data.curve.peak_minute,
          thumb: photo ? await thumbnail(photo) : undefined,
          mealType,
          macros: { carbs: r.data.meal.carbs, protein: r.data.meal.protein, fat: r.data.meal.fat, fiber: r.data.meal.fiber },
          curve: r.data.curve,
          demo: r.source === "demo",
        });
        setBurst((b) => b + 1);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setError("Photo analysis isn't available on the server right now. Enter the meal's macros instead.");
        setEditing(true);
      } else {
        setError(e instanceof Error ? e.message : "Prediction failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const meal = result?.meal;
  const draft: Macros = macros ?? (meal ? { carbs: meal.carbs, protein: meal.protein, fat: meal.fat, fiber: meal.fiber } : { carbs: 60, protein: 20, fat: 15, fiber: 5 });

  return (
    <div className="stack">
      <section className="card snap-hero">
        <div
          className={"snap-stage" + (preview ? " has" : "")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}
        >
          {preview ? <img src={preview} alt="Your meal" /> : <SnapArt />}
          <Pet stage={q.evo} path={q.petPath} equipped={q.equipped} pattern={q.look.petPattern} className="snap-pet" />
          {burst > 0 && <CoinBurst key={burst} />}
        </div>
        <div className="snap-copy">
          <h2>{preview ? "Looking tasty!" : "Snap a pic, earn tokens!"}</h2>
          <p className="small muted">{rewardLine(reward, q.petName)}</p>
          <div className="snap-progress" aria-label={`${snapped} of 3 meals snapped today`}>
            {[0, 1, 2].map((i) => <i key={i} className={i < snapped ? "on" : ""} />)}
            <span>{snapped}/3 snaps today</span>
          </div>
        </div>
        <div className="snap-actions">
          <button className="snap-btn" onClick={() => cameraRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
            Snap it
          </button>
          <button className="ghost" onClick={() => galleryRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M5 18l5-5 3 3 2.5-2.5L20 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            Upload
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} hidden />
          <input ref={galleryRef} type="file" accept="image/*" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} hidden />
        </div>
        <div className="row">
          <label className="field">
            <span>Meal</span>
            <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              <option value="breakfast">🍳 Breakfast</option>
              <option value="lunch">🥪 Lunch</option>
              <option value="dinner">🍝 Dinner</option>
              <option value="snack">🍎 Snack</option>
            </select>
          </label>
          <label className="field">
            <span>Glucose now (optional)</span>
            <input inputMode="numeric" placeholder={sensorLive ? "from sensor" : "mg/dL"} value={pre}
              disabled={sensorLive} onChange={(e) => setPre(e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
        </div>
        <div className="snap-go">
          <button className="cta" disabled={busy || (!photo && !macros)} onClick={() => run({ log: true })}>
            {busy && !result ? "Reading your plate…" : "✨ Reveal my spike"}
          </button>
          <button className="linkish" onClick={() => { setEditing(true); setResult(null); setMacros(macros ?? draft); }}>
            No pic? Type in the macros instead
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {editing && (
        <MacroForm
          initial={draft}
          busy={busy}
          onSubmit={(m) => { setMacros(m); setEditing(false); run({ macros: m, log: !result }); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {result && meal && (
        <section className="card" aria-live="polite">
          <div className="result-head">
            <div>
              <h2>{meal.label}</h2>
              <p className="muted small">
                {meal.calories} kcal · {Math.round(meal.carbs)}g carbs · {Math.round(meal.protein)}g protein · {Math.round(meal.fat)}g fat · {Math.round(meal.fiber)}g fiber
                {!macros && meal.confidence < 1 && <> · {Math.round(meal.confidence * 100)}% sure</>}
              </p>
            </div>
            <button className="ghost small-btn" onClick={() => setEditing(true)}>Fix macros</button>
          </div>
          {!macros && meal.items && meal.items.length > 0 && (
            <ul className="items-found">
              {meal.items.map((it) => (
                <li key={it.name}><span>{it.name} <small className="muted">· {it.portion}</small></span><span className="muted">{Math.round(it.carbs)}g carbs</span></li>
              ))}
            </ul>
          )}
          <div className="stats">
            <div className="stat">
              <span>Peak</span>
              <b>{result.curve.baseline_mg_dl != null ? Math.round(result.curve.baseline_mg_dl + result.curve.peak_delta_mg_dl) : `+${Math.round(result.curve.peak_delta_mg_dl)}`}<small> mg/dL</small></b>
            </div>
            <div className="stat"><span>When</span><b>{result.curve.peak_minute}<small> min</small></b></div>
            <div className="stat"><span>Typical error</span><b>±{Math.round(result.curve.mae_mg_dl)}<small> mg/dL</small></b></div>
          </div>
          <GlucoseChart curve={result.curve} previous={previous?.curve} />
          <div className="legend small muted">
            <span><i className="lg-line" /> Predicted</span>
            <span><i className="lg-band" /> Likely range (80%)</span>
            {previous && <span><i className="lg-prev" /> Before change</span>}
          </div>
          <div className="walk">
            <span className="small"><b>Walk after eating</b></span>
            <div className="seg" role="radiogroup" aria-label="Minutes walking after the meal">
              {[0, 10, 15, 30].map((w) => (
                <button key={w} role="radio" aria-checked={walk === w} disabled={busy}
                  onClick={() => { setWalk(w); run({ walk: w }); }}>{w ? `${w} min` : "None"}</button>
              ))}
            </div>
          </div>
          <p className="small muted">
            {TIER_TEXT[result.curve.tier]}.{" "}
            {source === "demo" ? <span className="badge">Demo model</span> : <span className="badge ok">{result.model_version}</span>}
          </p>
        </section>
      )}

      {result && result.suggestions.length > 0 && (
        <section className="stack-sm">
          <h2>Spike-busting power-ups</h2>
          {result.suggestions.map((s) => {
            const added = props.addedSuggestions.includes("sg-" + s.kind);
            return (
              <div key={s.id} className="task">
                <span className="t">{s.text}</span>
                <span className="why">Peak drops {s.peak_reduction_pct}% to +{Math.round(s.peak_delta_mg_dl)} mg/dL</span>
                <button className={added ? "ghost" : ""} disabled={added} onClick={() => props.onAddSuggestion(s)}>
                  {added ? "✓ In quests" : "+ Quest"}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {props.history.length > 0 && (
        <section className="card">
          <div className="spread">
            <h2>Your snap log</h2>
            {props.onOpenHistory && <button className="ghost small-btn" onClick={props.onOpenHistory}>See all</button>}
          </div>
          <ul className="history">
            {props.history.slice(0, 6).map((h) => (
              <li key={h.at}>
                {h.thumb ? <img src={h.thumb} alt="" /> : <span className="thumb-ph" />}
                <span className="h-label">{h.label}<small>{new Date(h.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</small></span>
                <span className="h-peak">+{Math.round(h.peak)}<small>mg/dL</small></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="note">GlucoSnap is a research demo, not medical advice. Predictions have typical errors of 15 to 24 mg/dL.</p>
    </div>
  );
}

function rewardLine(r: ReturnType<typeof snapReward>, pet: string) {
  if (r.xp > 0) return `This snap earns +${r.xp} XP and +${r.tokens} tokens for you and ${pet}.`;
  if (r.capped) return "Daily XP limit reached. Snaps still track your curves.";
  if (r.toBonus > 1) return `${r.toBonus} more snaps today unlock the 3-meal bonus. Every snap sharpens your predictions.`;
  return "Daily snap quests done! Keep snapping to see every curve.";
}

// Hero illustration: a camera snapping a plate while tokens pop out.
function SnapArt() {
  const coin = (x: number, y: number, r: number, d: number) => (
    <g className="coin-float" style={{ animationDelay: `${d}s` }} key={`${x}-${y}`}>
      <circle cx={x} cy={y} r={r} fill="var(--sun)" />
      <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="#b8860b" strokeWidth={r * 0.2} />
    </g>
  );
  const spark = (x: number, y: number, r: number) => (
    <path key={`${x}-${y}`} d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill="var(--sun)" className="twinkle" />
  );
  return (
    <svg viewBox="0 0 240 150" className="snap-art" role="img" aria-label="A camera snapping a plate of food while tokens pop out">
      <circle cx={120} cy={82} r={64} fill="var(--teal)" opacity={0.12} />
      <rect x={92} y={34} width={40} height={18} rx={6} fill="var(--teal)" />
      <rect x={58} y={44} width={124} height={82} rx={20} fill="var(--teal)" />
      <rect x={150} y={52} width={18} height={10} rx={3} fill="var(--sun)" />
      <circle cx={74} cy={58} r={4} fill="#fff" opacity={0.5} />
      <circle cx={120} cy={86} r={32} fill="#0b6d6f" />
      <circle cx={120} cy={86} r={26} fill="var(--surface)" />
      <circle cx={120} cy={86} r={20} fill="#fff" stroke="var(--line)" strokeWidth={2} />
      <path d="M106 88 q6 -10 14 -2 q6 -8 14 0 q2 8 -6 10 q-8 4 -16 0 q-8 -2 -6 -8 Z" fill="#e9b04a" />
      <circle cx={113} cy={84} r={4} fill="#a5442b" /><circle cx={125} cy={90} r={4.2} fill="#a5442b" /><circle cx={127} cy={81} r={3.5} fill="#a5442b" />
      <path d="M109 92 q3 -4 6 0" stroke="var(--leaf)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={108} cy={74} rx={6} ry={3} fill="#fff" opacity={0.6} transform="rotate(-30 108 74)" />
      {coin(38, 44, 12, 0)}{coin(200, 34, 10, 0.4)}{coin(216, 74, 10, 0.8)}{coin(30, 108, 9, 1.2)}
      {spark(62, 22, 6)}{spark(186, 112, 5)}{spark(18, 76, 4)}{spark(224, 40, 4)}
    </svg>
  );
}

function CoinBurst() {
  return (
    <div className="burst" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={{ "--a": `${i * 36}deg`, "--d": `${(i % 3) * 0.05}s` } as CSSProperties} />
      ))}
    </div>
  );
}

function MacroForm({ initial, busy, onSubmit, onCancel }: { initial: Macros; busy: boolean; onSubmit: (m: Macros) => void; onCancel: () => void }) {
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(Math.round(v))])));
  const m: Macros = { carbs: +text.carbs || 0, protein: +text.protein || 0, fat: +text.fat || 0, fiber: +text.fiber || 0 };
  const field = (k: keyof Macros, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={text[k] ?? ""} onChange={(e) => setText({ ...text, [k]: e.target.value.replace(/[^0-9.]/g, "") })} />
    </label>
  );
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); onSubmit(m); }}>
      <h2>Type in your meal (grams)</h2>
      <div className="grid4">
        {field("carbs", "Carbs")}
        {field("protein", "Protein")}
        {field("fat", "Fat")}
        {field("fiber", "Fiber")}
      </div>
      <div className="row">
        <button type="submit" disabled={busy}>✨ Reveal my spike</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
