import { useCallback, useRef, useState } from "react";
import type { CgmPoint, Profile } from "./api/types";
import { type QuestEvent, type QuestState } from "./game/quest";
import { useQuest } from "./game/useQuest";
import { loadArray, save, useStored } from "./storage";
import { HealthView } from "./components/HealthView";
import { QuestView } from "./components/QuestView";
import { SnapView, type LoggedMeal } from "./components/SnapView";
import { Pet } from "./components/Pet";

type Tab = "snap" | "health" | "quest";

function describe(events: QuestEvent[], s: QuestState) {
  const evo = events.find((e) => e.kind === "evolve");
  if (evo) return `${s.petName} evolved into a ${evo.stage}!`;
  const lvl = events.filter((e) => e.kind === "level").at(-1);
  if (lvl) return `Level up! You're level ${lvl.level}.`;
  if (events.some((e) => e.kind === "shield-earned")) return "7-day streak! You earned a streak shield.";
  if (events.some((e) => e.kind === "shield-used")) return "A streak shield saved your streak.";
  if (events.some((e) => e.kind === "streak-reset")) return "Streak reset. Your level and pet are safe.";
  const xp = events.filter((e) => e.kind === "xp").reduce((a, e) => a + (e.kind === "xp" ? e.gained : 0), 0);
  const mult = events.find((e) => e.kind === "xp");
  if (xp) return `+${xp} XP` + (mult && mult.kind === "xp" && mult.mult > 1 ? ` (streak ×${mult.mult})` : "");
  if (events.some((e) => e.kind === "capped")) return "Daily XP limit reached. Great work today.";
  return null;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("snap");
  const [toast, setToast] = useState<string | null>(null);
  const [petAnim, setPetAnim] = useState("");
  const toastTimer = useRef<number>(undefined);
  const [profile, setProfile] = useStored<Profile>("glucosnap-profile", () => {
    try { return JSON.parse(localStorage.getItem("glucosnap-profile") ?? "{}"); } catch { return {}; }
  });
  const [cgm, setCgmState] = useState<CgmPoint[]>(() => loadArray("glucosnap-cgm"));
  const [history, setHistory] = useState<LoggedMeal[]>(() => loadArray("glucosnap-history"));

  const show = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const quest = useQuest((events, s) => {
    const msg = describe(events, s);
    if (msg) show(msg);
    setPetAnim("");
    requestAnimationFrame(() => setPetAnim(events.some((e) => e.kind === "evolve") ? "evolve" : "bounce"));
  });
  const s = quest.state;

  const setCgm = (c: CgmPoint[]) => { setCgmState(c); save("glucosnap-cgm", c); };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--teal)" /><path d="M5 22 C10 22 11 9 16 9 S22 20 27 18" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
          <h1>GlucoSnap</h1>
        </div>
        <button className="mini-quest" onClick={() => setTab("quest")} aria-label={`Level ${s.level}, ${s.streak}-day streak. Open quests`}>
          <Pet stage={s.evo} className={"mini-pet " + petAnim} />
          <span>Lv {s.level}</span>
          <span className="mini-streak">🔥 {s.streak}</span>
        </button>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {([["snap", "Snap"], ["health", "Health"], ["quest", "Quest"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <main>
        <div hidden={tab !== "snap"}>
          <SnapView
            profile={profile}
            cgm={cgm}
            history={history}
            addedSuggestions={s.extraTasks.map((t) => t.id)}
            onLogged={(m) => {
              const h = [m, ...history].slice(0, 30);
              setHistory(h);
              save("glucosnap-history", h);
              quest.logMeal();
            }}
            onAddSuggestion={(sg) => { quest.addSuggestion(sg); show("Added to today's quests"); }}
          />
        </div>
        <div hidden={tab !== "health"}>
          <HealthView profile={profile} setProfile={setProfile} cgm={cgm} setCgm={setCgm} onSnapshot={() => quest.completeTask("weekly")} />
        </div>
        <div hidden={tab !== "quest"}>
          <QuestView
            s={s}
            petAnim={petAnim}
            onComplete={quest.completeTask}
            onNextDay={quest.nextDay}
            onReset={() => { quest.reset(s.playerName); show("Quest restarted"); }}
            onRename={quest.rename}
          />
        </div>
      </main>
      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
