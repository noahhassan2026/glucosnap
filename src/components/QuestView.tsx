import { useState } from "react";
import { DAILY_CAP, EVO, GEAR, TIERS, allTasks, multiplier, rankFor, xpToNext, type QuestState } from "../game/quest";
import { Avatar } from "./Avatar";
import { Pet } from "./Pet";

// Example players. The leaderboard deliberately carries no health data.
const OTHERS = [
  { n: "Maya", lvl: 9, streak: 12, evo: 3 },
  { n: "Jordan", lvl: 7, streak: 21, evo: 2 },
  { n: "Priya", lvl: 6, streak: 4, evo: 2 },
  { n: "Alex", lvl: 5, streak: 9, evo: 2 },
  { n: "Sam", lvl: 3, streak: 2, evo: 1 },
];

export function QuestView(props: {
  s: QuestState;
  petAnim: string;
  onComplete: (id: string) => void;
  onNextDay: (skip: boolean) => void;
  onReset: () => void;
  onRename: (player: string, pet: string) => void;
}) {
  const { s } = props;
  const [tab, setTab] = useState<"level" | "streak">("level");
  const m = multiplier(s.streak);
  const cur = TIERS.filter((t) => s.streak >= t.days).at(-1)!;
  const rows = OTHERS.map((o) => ({ ...o, me: false }))
    .concat({ n: s.playerName || "You", lvl: s.level, streak: s.streak, evo: s.evo, me: true })
    .sort(tab === "level" ? (a, b) => b.lvl - a.lvl || b.streak - a.streak : (a, b) => b.streak - a.streak || b.lvl - a.lvl);

  return (
    <div className="stack">
      <section className="card">
        <div className="hero">
          <div className="avatar"><Avatar level={s.level} /></div>
          <div className="who">
            <input className="name" aria-label="Your name" value={s.playerName} onChange={(e) => props.onRename(e.target.value, s.petName)} />
            <span className="muted small">{rankFor(s.level)}</span>
            <div className="lvl"><span>Level {s.level}</span><span>{s.xp} / {xpToNext(s.level)} XP</span></div>
            <div className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.xp / xpToNext(s.level)) * 100)}%` }} /></div>
            <div className="pills">
              <span className={"pill" + (s.streak > 0 ? " hot" : "")}>
                <svg className="flame" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 0C7 3 11 5 11 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3C5 6 4 3 6 0z" fill="currentColor" /></svg>
                {s.streak}-day streak
              </span>
              <span className="pill">×{m} XP</span>
              <span className="pill">{s.shields} streak shield{s.shields === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
        <div className="tiers" aria-label="Streak bonus tiers">
          {TIERS.map((t) => (
            <div key={t.days} className={"tier" + (t === cur ? " on" : "")}><b>×{t.mult}</b><span>{t.label}</span></div>
          ))}
        </div>
        <div className="gear" aria-label="Character upgrades">
          {GEAR.map((g) => (
            <span key={g.id} className={s.level >= g.lvl ? "got" : ""}>{s.level >= g.lvl ? g.name : `${g.name} · Lv ${g.lvl}`}</span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="petrow">
          <div className="petbox"><Pet stage={s.evo} className={props.petAnim} /></div>
          <div className="who">
            <input className="name" aria-label="Pet name" value={s.petName} onChange={(e) => props.onRename(s.playerName, e.target.value)} />
            <span className="muted small">{EVO[s.evo].name}</span>
            <ol className="evo">
              {EVO.map((e, i) => (
                <li key={e.name} className={i <= s.evo ? "got" : i === s.evo + 1 ? "next" : ""}>
                  <span className="mk" />
                  <span>{e.name}</span>
                  <span className="req">{i === 0 ? "start" : `Lv ${e.lvl}` + (e.streak ? ` + ${e.streak}-day streak` : "")}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="note">Evolutions need a level and a current streak, so consistency is what unlocks them. Once evolved, a pet never goes back.</p>
      </section>

      <section className="stack-sm">
        <h2>Today's quests</h2>
        {allTasks(s).map((t) => {
          const done = !!s.done[t.id];
          return (
            <div key={t.id} className={"task" + (done ? " done" : "")}>
              <span className="t">{t.title}</span>
              <span className="why">{t.why}</span>
              <span className="rw">
                +{Math.round(t.xp * m)} XP
                {t.check && <span className="tag">checked by {t.check}</span>}
                {t.auto && !done && <span className="tag">automatic</span>}
              </span>
              {!t.auto && <button disabled={done} onClick={() => props.onComplete(t.id)}>{done ? "Done" : "Complete"}</button>}
              {t.auto && done && <button disabled>Done</button>}
            </div>
          );
        })}
        <p className="note">Today: {s.todayBase} of {DAILY_CAP} base XP. The daily cap keeps it about consistency, not grinding.</p>
      </section>

      <section className="card">
        <div className="spread">
          <h2>Leaderboard</h2>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tab === "level"} onClick={() => setTab("level")}>Level</button>
            <button role="tab" aria-selected={tab === "streak"} onClick={() => setTab("streak")}>Streak</button>
          </div>
        </div>
        <table className="lb">
          <thead><tr><th>#</th><th>Player</th><th className="num">Level</th><th className="num">Streak</th><th>Pet</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.n + r.me} className={r.me ? "me" : ""}>
                <td className="pos">{i + 1}</td><td>{r.n}</td><td className="num">{r.lvl}</td><td className="num">{r.streak}d</td><td>{EVO[r.evo].name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">Example players. The leaderboard shows only levels, streaks and pets, never glucose, food or weight data.</p>
      </section>

      <section className="row" aria-label="Demo controls">
        <button className="ghost" onClick={() => props.onNextDay(false)}>Next day</button>
        <button className="ghost" onClick={() => props.onNextDay(true)}>Miss a day</button>
        <button className="ghost" onClick={props.onReset}>Start over</button>
      </section>
      <p className="note">XP rewards logging, balance and movement, never eating less. A missed day uses a streak shield if you have one; your level and pet are never taken away.</p>
    </div>
  );
}
