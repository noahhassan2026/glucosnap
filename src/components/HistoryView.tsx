import { useEffect, useMemo, useState } from "react";
import type { CgmPoint, Curve } from "../api/types";
import { actualCurve, compare, predictedAt, type Actual, type Check, type Comparison } from "../history/match";
import { GlucoseChart } from "./GlucoseChart";
import type { LoggedMeal } from "./SnapView";

const CHECK_MINUTES = [0, 15, 30, 45, 60, 90, 120];

function sinceMin(at: string, now: number) {
  return (now - Date.parse(at)) / 6e4;
}

function dayLabel(d: Date, now: Date) {
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

const signed = (v: number) => (Math.round(v) < 0 ? "−" : "+") + Math.abs(Math.round(v));

function peakText(curve: Curve | undefined, delta: number) {
  return curve?.baseline_mg_dl != null ? `${Math.round(curve.baseline_mg_dl + delta)}` : signed(delta);
}

interface Row {
  m: LoggedMeal;
  actual: Actual | null;
  cmp: Comparison | null;
}

export function HistoryView(props: {
  history: LoggedMeal[];
  cgm: CgmPoint[];
  onChange: (h: LoggedMeal[]) => void;
  onSnap: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const live = props.history.some((m) => sinceMin(m.at, now) < 125);

  // Meals still inside their 2-hour window update as time passes.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [live]);

  const rows: Row[] = useMemo(() => props.history.map((m) => {
    if (!m.curve) return { m, actual: null, cmp: null };
    const actual = actualCurve(m.at, props.cgm, m.checks, m.curve.baseline_mg_dl);
    return { m, actual, cmp: compare(m.curve, actual) };
  }), [props.history, props.cgm]);

  const scored = rows.filter((r) => r.cmp && r.cmp.n >= 2);
  const avgPeak = props.history.length ? props.history.reduce((a, m) => a + m.peak, 0) / props.history.length : 0;
  const avgErr = scored.length ? scored.reduce((a, r) => a + r.cmp!.mae, 0) / scored.length : null;

  const groups: [string, Row[]][] = [];
  for (const r of rows) {
    const label = dayLabel(new Date(r.m.at), new Date(now));
    const g = groups.at(-1);
    if (g && g[0] === label) g[1].push(r);
    else groups.push([label, [r]]);
  }

  function update(at: string, f: (m: LoggedMeal) => LoggedMeal | null) {
    props.onChange(props.history.flatMap((m) => (m.at === at ? (f(m) ?? []) : [m])));
  }

  if (!props.history.length) {
    return (
      <section className="card">
        <h2>History</h2>
        <p className="muted small">Every meal you snap is saved here with its predicted curve. Add sensor data or a finger-stick reading and you'll see how your body actually responded next to the prediction.</p>
        <button onClick={props.onSnap}>Snap your first meal</button>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>History</h2>
        <div className="stats">
          <div className="stat"><span>Meals</span><b>{props.history.length}</b></div>
          <div className="stat"><span>Avg predicted rise</span><b>+{Math.round(avgPeak)}<small> mg/dL</small></b></div>
          <div className="stat">
            <span>Prediction error</span>
            {avgErr != null ? <b>±{Math.round(avgErr)}<small> mg/dL</small></b> : <b className="muted">—</b>}
          </div>
        </div>
        <p className="small muted">
          {scored.length
            ? `Error is the average gap between predicted and measured glucose over ${scored.length} meal${scored.length > 1 ? "s" : ""} with readings.`
            : "Upload sensor data on the Health tab, or add a reading to a meal, to see how close the predictions are."}
        </p>
      </section>

      {groups.map(([label, list]) => (
        <section key={label} className="stack-sm">
          <h3>{label}</h3>
          {list.map((r) => (
            <MealEntry key={r.m.at} row={r} now={now} open={open === r.m.at}
              onToggle={() => setOpen(open === r.m.at ? null : r.m.at)}
              onAddCheck={(c) => update(r.m.at, (m) => ({ ...m, checks: [...(m.checks ?? []).filter((x) => x.minute !== c.minute), c] }))}
              onRemoveChecks={() => update(r.m.at, (m) => ({ ...m, checks: [] }))}
              onDelete={() => { update(r.m.at, () => null); setOpen(null); }} />
          ))}
        </section>
      ))}
      <p className="note">Measured lines show the rise from your pre-meal level, so they can be compared directly with the prediction.</p>
    </div>
  );
}

function MealEntry({ row, now, open, onToggle, onAddCheck, onRemoveChecks, onDelete }: {
  row: Row;
  now: number;
  open: boolean;
  onToggle: () => void;
  onAddCheck: (c: Check) => void;
  onRemoveChecks: () => void;
  onDelete: () => void;
}) {
  const { m, actual, cmp } = row;
  const since = sinceMin(m.at, now);
  const inProgress = !!m.curve && since >= 0 && since < 120;
  const time = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const verdict = cmp && (cmp.withinTypical ? "on" : "off");

  return (
    <article className={"meal" + (open ? " open" : "")}>
      <button className="meal-head" onClick={onToggle} aria-expanded={open}>
        {m.thumb ? <img src={m.thumb} alt="" /> : <span className="thumb-ph" />}
        <span className="h-label">
          {m.label}
          <small>
            {time}{m.mealType ? ` · ${m.mealType}` : ""}
            {inProgress && <> · <span className="live-dot" aria-hidden="true" /> {Math.round(since)} min in</>}
          </small>
        </span>
        <span className="h-peak">
          {peakText(m.curve, m.peak)}<small>predicted</small>
          {cmp && <span className={"measured " + verdict}>{peakText(m.curve, cmp.actualPeak)} measured</span>}
        </span>
      </button>

      {open && (
        <div className="meal-body">
          {!m.curve ? (
            <p className="small muted">Logged before history tracking, so only the peak was saved. Predicted rise +{Math.round(m.peak)} mg/dL at {m.peakMinute} min.</p>
          ) : (
            <>
              {inProgress && (
                <p className="live small">
                  Right now you should be around <b>{peakText(m.curve, predictedAt(m.curve, since))} mg/dL</b>
                  {m.curve.baseline_mg_dl == null && " above your pre-meal level"}.{" "}
                  {since < m.peakMinute ? `Peak expected in about ${Math.round(m.peakMinute - since)} min.` : "The peak should be behind you."}
                </p>
              )}
              <GlucoseChart curve={m.curve} actual={actual?.points} nowMinute={inProgress ? since : null} />
              <div className="legend small muted">
                <span><i className="lg-line" /> Predicted</span>
                <span><i className="lg-band" /> Likely range</span>
                {actual && actual.points.length > 1 && <span><i className="lg-actual" /> Measured</span>}
              </div>
              {cmp ? (
                <p className="small">
                  Measured peak <b>{signed(cmp.actualPeak)} mg/dL</b> at {cmp.actualPeakMinute} min vs predicted {signed(m.curve.peak_delta_mg_dl)} at {m.curve.peak_minute} min.
                  Average gap ±{Math.round(cmp.mae)} mg/dL over {cmp.n} reading{cmp.n > 1 ? "s" : ""}
                  {cmp.withinTypical ? ", within the model's typical error." : `, more than the model's typical ±${Math.round(m.curve.mae_mg_dl)}.`}
                  {actual?.source && <span className="muted"> From {actual.source === "both" ? "sensor and typed readings" : actual.source === "sensor" ? "your sensor data" : "your typed readings"}.</span>}
                </p>
              ) : (
                <p className="small muted">
                  {since < 15 ? "Readings will appear here as the next two hours unfold." : "No readings for this meal yet."} Upload sensor data on the Health tab, or type in a finger-stick reading below.
                </p>
              )}
              <CheckForm since={since} hasBaseline={actual?.pre != null} onAdd={onAddCheck} />
              {m.checks && m.checks.length > 0 && (
                <p className="small muted">
                  Your readings: {[...m.checks].sort((a, b) => a.minute - b.minute).map((c) => `${c.mg_dl} at ${c.minute ? c.minute + " min" : "start"}`).join(", ")}.{" "}
                  <button className="linkish" onClick={onRemoveChecks}>Clear</button>
                </p>
              )}
              {m.macros && (
                <p className="small muted">
                  {Math.round(m.macros.carbs)}g carbs · {Math.round(m.macros.protein)}g protein · {Math.round(m.macros.fat)}g fat · {Math.round(m.macros.fiber)}g fiber
                  {m.demo && <> · <span className="badge">Demo model</span></>}
                </p>
              )}
            </>
          )}
          <div className="row">
            <button className="ghost small-btn" onClick={onDelete}>Delete meal</button>
          </div>
        </div>
      )}
    </article>
  );
}

function CheckForm({ since, hasBaseline, onAdd }: { since: number; hasBaseline: boolean; onAdd: (c: Check) => void }) {
  const guess = since > 0 && since < 130 ? CHECK_MINUTES.reduce((a, b) => (Math.abs(b - since) < Math.abs(a - since) ? b : a)) : 60;
  const [minute, setMinute] = useState(hasBaseline ? guess : 0);
  const [value, setValue] = useState("");
  const n = Number(value);
  const ok = value !== "" && n > 20 && n < 600;
  return (
    <form className="check-form" onSubmit={(e) => { e.preventDefault(); if (ok) { onAdd({ minute, mg_dl: n }); setValue(""); } }}>
      <label className="field">
        <span>Add a reading</span>
        <input inputMode="numeric" placeholder="mg/dL" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} />
      </label>
      <label className="field">
        <span>Taken</span>
        <select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>
          {CHECK_MINUTES.map((mm) => <option key={mm} value={mm}>{mm ? `${mm} min after` : "Before eating"}</option>)}
        </select>
      </label>
      <button type="submit" disabled={!ok}>Add</button>
    </form>
  );
}
