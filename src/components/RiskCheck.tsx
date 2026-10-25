import { useState, type ChangeEvent } from "react";
import { RISK_CUTOFF, RISK_MAX, adaRiskScore, bmiFrom, type RiskAnswers } from "../game/learn";
import type { Profile } from "../api/types";
import { Token } from "./ShopView";

type YesNo = boolean | undefined;

function Ask({ label, hint, value, onChange }: { label: string; hint?: string; value: YesNo; onChange: (v: boolean) => void }) {
  return (
    <div className="ask">
      <div><b className="small">{label}</b>{hint && <p className="note">{hint}</p>}</div>
      <div className="seg" role="radiogroup" aria-label={label}>
        <button role="radio" aria-checked={value === true} onClick={() => onChange(true)}>Yes</button>
        <button role="radio" aria-checked={value === false} onClick={() => onChange(false)}>No</button>
      </div>
    </div>
  );
}

const POINT_LABELS: Record<string, string> = {
  age: "Age", sex: "Being male", gestational: "Diabetes during pregnancy", family: "Family history",
  highBp: "High blood pressure", inactive: "Not physically active", weight: "Weight for your height",
};

export function RiskCheck(props: {
  profile: Profile;
  last: { score: number; date: string } | null;
  firstTime: boolean;
  onDone: (score: number) => number;
  onClose: () => void;
  onLesson: () => void;
}) {
  const p = props.profile;
  const [age, setAge] = useState(p.age?.toString() ?? "");
  const [sex, setSex] = useState<"M" | "F" | undefined>(p.sex);
  const [gestational, setGestational] = useState<YesNo>();
  const [family, setFamily] = useState<YesNo>();
  const [highBp, setHighBp] = useState<YesNo>();
  const [active, setActive] = useState<YesNo>();
  const [units, setUnits] = useState<"us" | "metric" | "bmi">(p.bmi ? "bmi" : "us");
  const [ft, setFt] = useState(""); const [inch, setInch] = useState(""); const [lb, setLb] = useState("");
  const [cm, setCm] = useState(""); const [kg, setKg] = useState("");
  const [bmiText, setBmiText] = useState(p.bmi?.toString() ?? "");
  const [result, setResult] = useState<{ score: number; parts: Record<string, number>; high: boolean; tokens: number } | null>(null);

  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const bmi = units === "bmi" ? n(bmiText)
    : units === "us" ? bmiFrom(n(lb) * 0.4536, (n(ft) * 12 + (n(inch) || 0)) * 2.54)
    : bmiFrom(n(kg), n(cm));
  const bmiOk = isFinite(bmi) && bmi > 10 && bmi < 80;
  const ageN = n(age);
  const ready = ageN >= 10 && ageN < 120 && sex && (sex === "M" || gestational != null) && family != null && highBp != null && active != null && bmiOk;

  function submit() {
    if (!ready) return;
    const a: RiskAnswers = { age: ageN, sex: sex!, gestational: !!gestational, family: family!, highBp: highBp!, active: active!, bmi };
    const r = adaRiskScore(a);
    const tokens = props.onDone(r.score);
    setResult({ ...r, tokens });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const digits = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^0-9.]/g, ""));

  if (result) {
    const contributors = Object.entries(result.parts).filter(([, v]) => v > 0);
    return (
      <div className="stack">
        <div><button className="ghost small-btn" onClick={props.onClose}>← Learning center</button></div>
        <section className="card" aria-live="polite">
          <span className="small muted">Your type 2 diabetes risk score</span>
          <div className="risk-score">
            <b className={result.high ? "hi" : "lo"}>{result.score}</b><span>out of {RISK_MAX}</span>
          </div>
          <div className="risk-meter" aria-hidden="true">
            <i style={{ width: `${(result.score / RISK_MAX) * 100}%` }} className={result.high ? "hi" : "lo"} />
            <span style={{ left: `${(RISK_CUTOFF / RISK_MAX) * 100}%` }} />
          </div>
          <div className="risk-scale small muted"><span>Lower risk</span><span>{RISK_CUTOFF}+ higher risk</span></div>
          {result.high ? (
            <>
              <h2>You may be at higher risk for type 2 diabetes</h2>
              <p className="small">A score of {RISK_CUTOFF} or more means it's worth getting a simple blood test (A1C or fasting glucose). Ask a doctor, a community health center, or a pharmacy. Many offer low-cost screening. Finding prediabetes early means you can often turn it around.</p>
            </>
          ) : (
            <>
              <h2>Your risk looks lower right now</h2>
              <p className="small">Keep it that way with regular activity and balanced meals. Risk grows with age and weight, so check again each year. The ADA still suggests a blood test for every adult from age 35.</p>
            </>
          )}
          {contributors.length > 0 && (
            <div className="stack-sm">
              <h3>What added to your score</h3>
              <ul className="items-found">
                {contributors.map(([k, v]) => <li key={k}><span>{POINT_LABELS[k]}</span><b>+{v}</b></li>)}
              </ul>
            </div>
          )}
          {result.tokens > 0 && <p className="reward">You earned +<Token n={result.tokens} /> tokens for checking in on your health</p>}
          <div className="spread">
            <button className="ghost" onClick={() => setResult(null)}>Change answers</button>
            <button onClick={props.onLesson}>Lesson: who is at risk?</button>
          </div>
          <p className="note">
            <b>This is not a diagnosis.</b> It is the American Diabetes Association's Type 2 Diabetes Risk Test (based on Bang et al., Annals of Internal Medicine, 2009). It does not screen for type 1 diabetes. Asian American adults can face higher risk at lower weights, so a lower score may still be worth a test. Your answers stay on this device.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <div><button className="ghost small-btn" onClick={props.onClose}>← Learning center</button></div>
      <section className="card">
        <h2>Type 2 diabetes risk check</h2>
        <p className="muted small">Seven questions from the American Diabetes Association. Answers stay on this device.</p>
        <div className="row">
          <label className="field"><span>How old are you?</span><input inputMode="numeric" value={age} onChange={digits(setAge)} /></label>
          <div className="field">
            <span>Sex</span>
            <div className="seg" role="radiogroup" aria-label="Sex">
              <button role="radio" aria-checked={sex === "F"} onClick={() => setSex("F")}>Female</button>
              <button role="radio" aria-checked={sex === "M"} onClick={() => setSex("M")}>Male</button>
            </div>
          </div>
        </div>
        {sex === "F" && <Ask label="Have you ever had diabetes during pregnancy?" hint="Called gestational diabetes." value={gestational} onChange={setGestational} />}
        <Ask label="Does a parent, brother or sister have diabetes?" value={family} onChange={setFamily} />
        <Ask label="Has a doctor ever said you have high blood pressure?" value={highBp} onChange={setHighBp} />
        <Ask label="Are you physically active?" hint="For example, a brisk walk, a sport or a workout most weeks." value={active} onChange={setActive} />
        <div className="stack-sm">
          <div className="spread">
            <b className="small">Height and weight</b>
            <div className="seg" role="radiogroup" aria-label="Units">
              {([["us", "ft / lb"], ["metric", "cm / kg"], ["bmi", "BMI"]] as const).map(([k, l]) => (
                <button key={k} role="radio" aria-checked={units === k} onClick={() => setUnits(k)}>{l}</button>
              ))}
            </div>
          </div>
          {units === "us" && (
            <div className="row">
              <label className="field"><span>Feet</span><input inputMode="numeric" value={ft} onChange={digits(setFt)} /></label>
              <label className="field"><span>Inches</span><input inputMode="numeric" value={inch} onChange={digits(setInch)} /></label>
              <label className="field"><span>Pounds</span><input inputMode="decimal" value={lb} onChange={digits(setLb)} /></label>
            </div>
          )}
          {units === "metric" && (
            <div className="row">
              <label className="field"><span>Height (cm)</span><input inputMode="decimal" value={cm} onChange={digits(setCm)} /></label>
              <label className="field"><span>Weight (kg)</span><input inputMode="decimal" value={kg} onChange={digits(setKg)} /></label>
            </div>
          )}
          {units === "bmi" && (
            <label className="field"><span>BMI</span><input inputMode="decimal" value={bmiText} onChange={digits(setBmiText)} /></label>
          )}
          {units !== "bmi" && bmiOk && <p className="note">BMI {bmi.toFixed(1)}</p>}
        </div>
        <button disabled={!ready} onClick={submit}>See my score</button>
        {props.firstTime && <p className="note">Free to take. You earn tokens the first time you finish, whatever your score.</p>}
        {props.last && <p className="note">Last time you scored {props.last.score} out of {RISK_MAX} ({props.last.date}).</p>}
      </section>
    </div>
  );
}
