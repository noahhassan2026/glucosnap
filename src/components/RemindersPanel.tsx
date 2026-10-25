import { DAY_LETTERS, EVERY_DAY, nextReminder, toIcs, type Reminder } from "../reminders/reminders";
import type { Permission } from "../reminders/useReminders";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function downloadIcs(list: Reminder[]) {
  const url = URL.createObjectURL(new Blob([toIcs(list)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "glucosnap-meal-reminders.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PERM_TEXT: Record<Permission, string> = {
  granted: "Notifications are on. They arrive while GlucoSnap is open or running in the background.",
  default: "Turn on notifications to get reminders even when GlucoSnap isn't the tab you're looking at.",
  denied: "Notifications are blocked for this site, so reminders show inside the app. You can allow them in your browser's site settings.",
  unsupported: "This browser can't show notifications here, so reminders show inside the app. On iPhone, add GlucoSnap to your Home Screen first.",
};

export function RemindersPanel(props: {
  list: Reminder[];
  setList: (l: Reminder[]) => void;
  perm: Permission;
  onEnable: () => void;
  onTest: () => void;
  onClose: () => void;
}) {
  const { list } = props;
  const next = nextReminder(list, new Date());
  const anyOn = list.some((r) => r.on);

  const edit = (id: string, patch: Partial<Reminder>) => {
    props.setList(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (patch.on && props.perm === "default") props.onEnable();
  };
  const add = () => {
    const id = "r" + Date.now().toString(36);
    props.setList([...list, { id, label: "Snack", time: "15:30", days: EVERY_DAY, kind: "eat", on: true }]);
    if (props.perm === "default") props.onEnable();
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="rem-title">
        <div className="spread">
          <h2 id="rem-title">Meal reminders</h2>
          <button className="ghost small-btn" onClick={props.onClose}>Done</button>
        </div>
        <p className="small muted">Set your usual meal times. Choose a reminder to eat, or a nudge to log a meal you haven't snapped yet (skipped if you already logged one).</p>

        <ul className="reminders">
          {list.map((r) => (
            <li key={r.id} className={r.on ? "" : "off"}>
              <div className="rem-top">
                <input className="rem-label" aria-label="Reminder name" value={r.label} maxLength={24}
                  onChange={(e) => edit(r.id, { label: e.target.value })} />
                <label className="switch">
                  <input type="checkbox" checked={r.on} onChange={(e) => edit(r.id, { on: e.target.checked })} />
                  <span aria-hidden="true" />
                  <span className="sr">{r.label} reminder on</span>
                </label>
              </div>
              <div className="rem-bottom">
                <input type="time" aria-label={`${r.label} time`} value={r.time} required
                  onChange={(e) => e.target.value && edit(r.id, { time: e.target.value })} />
                <div className="seg" role="radiogroup" aria-label={`${r.label} reminder type`}>
                  <button role="radio" aria-checked={r.kind === "eat"} onClick={() => edit(r.id, { kind: "eat" })}>Time to eat</button>
                  <button role="radio" aria-checked={r.kind === "log"} onClick={() => edit(r.id, { kind: "log" })}>Log nudge</button>
                </div>
                <div className="days" role="group" aria-label={`${r.label} days`}>
                  {DAY_LETTERS.map((d, i) => (
                    <button key={i} aria-pressed={r.days.includes(i)} aria-label={DAY_NAMES[i]}
                      onClick={() => edit(r.id, { days: r.days.includes(i) ? r.days.filter((x) => x !== i) : [...r.days, i].sort() })}>{d}</button>
                  ))}
                </div>
                <button className="linkish" onClick={() => props.setList(list.filter((x) => x.id !== r.id))}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <button className="ghost" onClick={add}>+ Add a meal time</button>

        <div className="cgm-box">
          <p className="small">{PERM_TEXT[props.perm]}</p>
          {next && <p className="small muted">Next: {next.r.label} at {next.at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.</p>}
          <div className="row">
            {props.perm === "default" && <button onClick={props.onEnable}>Turn on notifications</button>}
            <button className="ghost" onClick={props.onTest}>Send a test</button>
            <button className="ghost" disabled={!anyOn} onClick={() => downloadIcs(list)}>Add to calendar</button>
          </div>
          <p className="small muted">Browsers can't wake a closed web app. Add to calendar puts these times in your phone's calendar so you're reminded even when GlucoSnap is closed.</p>
        </div>
      </div>
    </div>
  );
}
