import { useState, type ReactNode } from "react";
import { DAILY_CAP, EVO, TIERS, allTasks, multiplier, rankFor, tokensFor, xpToNext, type QuestState } from "../game/quest";
import { choiceFor, speciesName, type PetPath } from "../game/pets";
import { Token } from "./ShopView";
import { Avatar } from "./Avatar";
import { Pet } from "./Pet";
import type { Player } from "../account/session";

type Row = { n: string; lvl: number; streak: number; evo: number; path: PetPath; me: boolean; example?: boolean };

// Example players fill the board until enough real players have joined. No health data, ever.
const MIN_ROWS = 4;
const OTHERS: { n: string; lvl: number; streak: number; evo: number; path: PetPath }[] = [
  { n: "Maya", lvl: 9, streak: 12, evo: 3, path: { element: "ember", form: "wing" } },
  { n: "Jordan", lvl: 7, streak: 21, evo: 2, path: { element: "tide" } },
  { n: "Priya", lvl: 6, streak: 4, evo: 2, path: { element: "leaf" } },
  { n: "Alex", lvl: 5, streak: 9, evo: 2, path: { element: "ember" } },
  { n: "Sam", lvl: 3, streak: 2, evo: 1, path: {} },
];

export function QuestView(props: {
  s: QuestState;
  petAnim: string;
  onComplete: (id: string) => void;
  onNextDay: (skip: boolean) => void;
  onReset: () => void;
  onRename: (player: string, pet: string) => void;
  onShop: () => void;
  onEvolve: () => void;
  children?: ReactNode; // shown under today's quests (the AI coach)
  reading?: number;
  players: Player[] | null; // real players from the server; null when it can't be reached
  guest: boolean;
  onSignUp: () => void;
}) {
  const { s } = props;
  const [tab, setTab] = useState<"level" | "streak">("level");
  const m = multiplier(s.streak);
  const cur = TIERS.filter((t) => s.streak >= t.days).at(-1)!;
  // My row always shows live local state, which may be a moment ahead of the last save.
  const mine: Row = { n: (s.playerName || "You") + (props.guest ? " (guest)" : ""), lvl: s.level, streak: s.streak, evo: s.evo, path: s.petPath, me: true };
  const real: Row[] = (props.players ?? []).filter((p) => !p.me)
    .map((p) => ({ n: p.name, lvl: p.level, streak: p.streak, evo: p.evo, path: p.path as PetPath, me: false }));
  const examples: Row[] = OTHERS.map((o) => ({ ...o, me: false, example: true }))
    .slice(0, props.players ? Math.max(0, MIN_ROWS - real.length - 1) : OTHERS.length);
  const rows = [...real, ...examples, mine]
    .sort(tab === "level" ? (a, b) => b.lvl - a.lvl || b.streak - a.streak : (a, b) => b.streak - a.streak || b.lvl - a.lvl);

  return (
    <div className="stack">
      <section className="card">
        <div className="hero">
          <div className="avatar"><Avatar look={s.look} equipped={s.equipped} reading={props.reading} scene /></div>
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
        <div className="spread">
          <span className="pill"><Token n={s.tokens} /> tokens</span>
          <button onClick={props.onShop}>Customize &amp; shop</button>
        </div>
      </section>

      <section className="card">
        <div className="petrow">
          <div className="petbox"><Pet stage={s.evo} path={s.petPath} equipped={s.equipped} className={props.petAnim} pattern={s.look.petPattern} /></div>
          <div className="who">
            <input className="name" aria-label="Pet name" value={s.petName} onChange={(e) => props.onRename(s.playerName, e.target.value)} />
            <span className="muted small">{speciesName(s.evo, s.petPath)}{s.evo >= 2 ? ` · ${EVO[s.evo].name}` : ""}</span>
            <ol className="evo">
              {EVO.map((e, i) => (
                <li key={e.name} className={i <= s.evo ? "got" : i === s.evo + 1 ? "next" : ""}>
                  <span className="mk" />
                  <span>{i <= s.evo ? speciesName(i, s.petPath) : e.name}</span>
                  <span className="req">
                    {i === 0 ? "start" : `Lv ${e.lvl}` + (e.streak ? ` + ${e.streak}-day streak` : "")}
                    {i > s.evo && choiceFor(i, s.petPath) ? ` · choose ${choiceFor(i, s.petPath) === "element" ? "an element" : "a form"}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {s.evoReady && (
          <div className="ready">
            <span><b>{s.petName} is ready to evolve.</b> Pick its path.</span>
            <button onClick={props.onEvolve}>Choose path</button>
          </div>
        )}
        <p className="note">Evolutions need a level and a current streak. At Sprite you pick an element (Leaf, Ember or Tide) and at Guardian a form (Wings or Horns), for six different Legendaries. Once evolved, a pet never goes back.</p>
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
                +{Math.round(t.xp * m)} XP · <Token n={tokensFor(Math.round(t.xp * m))} />
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

      {props.children}

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
              <tr key={r.n + r.me + i} className={r.me ? "me" : ""}>
                <td className="pos">{i + 1}</td><td>{r.n}{r.example && <span className="tag">example</span>}</td><td className="num">{r.lvl}</td><td className="num">{r.streak}d</td><td>{speciesName(r.evo, r.path)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {props.guest && <p className="small">Guests aren't on the real leaderboard. <button className="ghost small-btn" onClick={props.onSignUp}>Create an account</button></p>}
        <p className="note">{props.players ? "Real GlucoSnap players" + (examples.length ? ", plus example players until more people join" : "") : "Example players (the server is offline)"}. The leaderboard shows only names, levels, streaks and pets, never glucose, food or weight data.</p>
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
