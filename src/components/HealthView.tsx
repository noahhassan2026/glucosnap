import { useState } from "react";
import { risk, type Source } from "../api/client";
import { sampleCgm } from "../api/mock";
import type { CgmPoint, Profile, RiskResponse, RiskStatus } from "../api/types";

const STATUS: Record<RiskStatus, string> = { normal: "Normal range", prediabetes: "Prediabetes range", t2d: "Type 2 diabetes range" };

// Accepts a CSV with a timestamp column and a glucose column (Libre/Dexcom exports or t,mg_dl).
export function parseCgmCsv(text: string): CgmPoint[] {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.trim().replace(/"/g, ""));
  const ti = head.findIndex((h) => /time|^t$|date/.test(h));
  const gi = head.findIndex((h) => /glucose|mg_dl|mg\/dl|gl$|^gl|sgv/.test(h));
  if (ti < 0 || gi < 0) throw new Error("Couldn't find timestamp and glucose columns.");
  const out: CgmPoint[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(/[,;\t]/).map((v) => v.trim().replace(/"/g, ""));
    const t = Date.parse(c[ti]);
    const g = Number(c[gi]);
    if (!isNaN(t) && g > 20 && g < 600) out.push({ t: new Date(t).toISOString(), mg_dl: g });
  }
  if (!out.length) throw new Error("No glucose readings found in that file.");
  return out.sort((a, b) => a.t.localeCompare(b.t));
}

export function HealthView(props: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  cgm: CgmPoint[];
  setCgm: (c: CgmPoint[]) => void;
  onSnapshot: () => void;
}) {
  const [result, setResult] = useState<RiskResponse | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = props.profile;
  const days = props.cgm.length ? (Date.parse(props.cgm.at(-1)!.t) - Date.parse(props.cgm[0].t)) / 864e5 : 0;
  const mean = props.cgm.length ? props.cgm.reduce((a, b) => a + b.mg_dl, 0) / props.cgm.length : 0;

  function num(k: keyof Profile, v: string) {
    const n = Number(v);
    const next = { ...p };
    if (v === "" || isNaN(n)) delete next[k];
    else (next as Record<string, number>)[k] = n;
    props.setProfile(next);
  }
  const numField = (k: keyof Profile, label: string) => (
    <label className="field"><span>{label}</span><NumInput value={p[k] as number | undefined} onChange={(v) => num(k, v)} /></label>
  );

  async function upload(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      props.setCgm(parseCgmCsv(await f.text()));
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await risk({ cgm: props.cgm, ...(Object.keys(p).length ? { profile: p } : {}) });
      setResult(r.data);
      setSource(r.source);
      props.onSnapshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Health snapshot</h2>
        <p className="muted small">A few days of sensor data are enough to estimate your HbA1c and diabetes risk band.</p>
        <div className="cgm-box">
          {props.cgm.length ? (
            <p className="small"><b>{props.cgm.length} readings</b> over {days.toFixed(1)} days · average {Math.round(mean)} mg/dL</p>
          ) : (
            <p className="small muted">No sensor data yet.</p>
          )}
          <div className="row">
            <label className="btn ghost">
              Upload CGM CSV
              <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            <button className="ghost" onClick={() => { props.setCgm(sampleCgm()); setResult(null); }}>Use sample data</button>
            {props.cgm.length > 0 && <button className="ghost" onClick={() => { props.setCgm([]); setResult(null); }}>Clear</button>}
          </div>
        </div>
        <button disabled={busy || !props.cgm.length} onClick={run}>{busy ? "Analyzing…" : "Run snapshot"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && (
        <section className="card" aria-live="polite">
          <div className="stats">
            <div className="stat"><span>Estimated HbA1c</span><b>{result.a1c_estimate.toFixed(1)}<small>% ±{result.a1c_mae}</small></b></div>
            <div className="stat"><span>Risk band</span><b className={"status " + result.status}>{STATUS[result.status]}</b></div>
          </div>
          <div className="probs" aria-label="Probability of each risk band">
            {(Object.keys(STATUS) as RiskStatus[]).map((k) => (
              <div key={k} className="prob">
                <span>{STATUS[k]}</span>
                <div className="bar"><i className={k} style={{ width: `${Math.round(result.status_probs[k] * 100)}%` }} /></div>
                <b>{Math.round(result.status_probs[k] * 100)}%</b>
              </div>
            ))}
          </div>
          {result.homa_ir_estimate != null && <p className="small">Insulin resistance (HOMA-IR) estimate: {result.homa_ir_estimate.toFixed(1)}</p>}
          <p className="small muted">
            Based on {result.days_of_data} days of data. This is a screening estimate, not a diagnosis; confirm with a lab HbA1c test.{" "}
            {source === "demo" ? <span className="badge">Demo model</span> : <span className="badge ok">Model</span>}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Your profile</h2>
        <p className="muted small">Optional. Used to personalize predictions; stays on this device and is sent only to the model.</p>
        <div className="grid4">
          {numField("age", "Age")}
          <label className="field">
            <span>Sex</span>
            <select value={p.sex ?? ""} onChange={(e) => { const n = { ...p }; if (e.target.value) n.sex = e.target.value as "M" | "F"; else delete n.sex; props.setProfile(n); }}>
              <option value="">—</option><option value="F">Female</option><option value="M">Male</option>
            </select>
          </label>
          {numField("bmi", "BMI")}
          {numField("a1c", "Lab HbA1c %")}
        </div>
      </section>
    </div>
  );
}

// Keeps the typed text (so "6." can become "6.5") while reporting it upward.
function NumInput({ value, onChange }: { value: number | undefined; onChange: (v: string) => void }) {
  const [text, setText] = useState(value?.toString() ?? "");
  return (
    <input inputMode="decimal" value={text}
      onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setText(v); onChange(v); }} />
  );
}
