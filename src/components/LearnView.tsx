import { useState } from "react";
import { ALL_DONE_BONUS, LESSONS, LESSON_TOKENS, PERFECT_BONUS, RISK_TOKENS, lessonPassed, passMark, type Lesson, type LessonResult } from "../game/learn";
import type { QuestState } from "../game/quest";
import { itemById } from "../game/shop";
import type { Profile } from "../api/types";
import { Token } from "./ShopView";
import { RiskCheck } from "./RiskCheck";

// Tokens a lesson can still pay out. Quizzes never cost anything.
function earnable(s: QuestState, l: Lesson) {
  const best = s.lessons[l.id] ?? -1;
  return (best >= passMark(l.quiz.length) ? 0 : LESSON_TOKENS) + (best < l.quiz.length ? PERFECT_BONUS : 0);
}

export function Earn({ n, label = "Earn" }: { n: number; label?: string }) {
  return <span className="earn" aria-label={`${label} ${n} tokens`}>{label} +<Token n={n} /></span>;
}

export function LearnView(props: {
  s: QuestState;
  profile: Profile;
  onFinishLesson: (id: string, correct: number) => LessonResult;
  onRiskDone: (score: number) => number; // returns tokens paid
  onShop: () => void;
}) {
  const { s } = props;
  const [open, setOpen] = useState<Lesson | null>(null);
  const [risk, setRisk] = useState(false);
  const done = LESSONS.filter((l) => lessonPassed(s, l.id)).length;

  if (open) return <LessonPlayer key={open.id} lesson={open} s={s} onFinish={props.onFinishLesson} onClose={() => setOpen(null)} onShop={props.onShop} />;
  if (risk) return <RiskCheck profile={props.profile} last={s.riskCheck} firstTime={!s.riskCheck} onDone={props.onRiskDone} onClose={() => setRisk(false)}
    onLesson={() => { setRisk(false); setOpen(LESSONS.find((l) => l.id === "risk")!); }} />;

  return (
    <div className="stack">
      <section className="card">
        <div className="spread">
          <h2>Learning center</h2>
          <span className="badge">{done} / {LESSONS.length} lessons</span>
        </div>
        <p className="muted small">Short lessons in plain language. Pass the quiz at the end to earn tokens for the shop.</p>
        <p className="free-banner"><b>Every quiz is free.</b> You only earn tokens here, you never spend them.</p>
        <div className="bar" aria-hidden="true"><i style={{ width: `${(done / LESSONS.length) * 100}%` }} /></div>
        <p className="note">
          Earn {LESSON_TOKENS} tokens for passing a lesson, {PERFECT_BONUS} more for a perfect score, and {ALL_DONE_BONUS} for finishing them all. Retake any quiz for free as often as you like.
        </p>
      </section>

      <section className="card risk-card">
        <div className="spread">
          <div>
            <h2>Am I at risk for type 2 diabetes?</h2>
            <p className="muted small">The American Diabetes Association's 7-question risk test. Takes one minute.</p>
          </div>
          <span className="risk-icon" aria-hidden="true">🧭</span>
        </div>
        {s.riskCheck && (
          <p className="small">Last result: <b>{s.riskCheck.score} out of 10</b>{s.riskCheck.score >= 5 ? ", higher risk" : ", lower risk"} ({s.riskCheck.date})</p>
        )}
        <div className="spread">
          <button onClick={() => setRisk(true)}>{s.riskCheck ? "Take it again" : "Check my risk"}</button>
          {!s.riskCheck && <Earn n={RISK_TOKENS} />}
        </div>
        <p className="note">A screening tool, not a diagnosis. Only a blood test can tell you if you have prediabetes or diabetes.</p>
      </section>

      <section className="stack-sm">
        <h3>Lessons</h3>
        <ul className="lessons">
          {LESSONS.map((l) => {
            const passed = lessonPassed(s, l.id);
            const best = s.lessons[l.id];
            const prize = l.unlocks ? itemById(l.unlocks) : undefined;
            return (
              <li key={l.id}>
                <button className={"lesson" + (passed ? " done" : "")} onClick={() => setOpen(l)}>
                  <span className="lesson-emoji" aria-hidden="true">{l.emoji}</span>
                  <span className="lesson-text">
                    <b>{l.title}</b>
                    <small>{l.blurb}</small>
                    {prize && !s.owned.includes(prize.id) && <small className="unlock">Unlocks: {prize.name} for your character</small>}
                  </span>
                  <span className="lesson-state">
                    {passed && <span className="passed"><span className="check-mark" aria-label="Passed">✓</span><small>{best}/{l.quiz.length}</small></span>}
                    {earnable(s, l) > 0 ? <Earn n={earnable(s, l)} label={passed ? "Perfect" : "Earn"} /> : <small>Free review</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="note">For learning, not medical advice. Facts come from the CDC, the American Diabetes Association and the FDA. Talk to a doctor about your own numbers.</p>
    </div>
  );
}

function LessonPlayer({ lesson, s, onFinish, onClose, onShop }: {
  lesson: Lesson;
  s: QuestState;
  onFinish: (id: string, correct: number) => LessonResult;
  onClose: () => void;
  onShop: () => void;
}) {
  const nCards = lesson.cards.length;
  const nQ = lesson.quiz.length;
  const [step, setStep] = useState(0); // cards, then questions, then the result
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const qi = step - nCards;
  const total = nCards + nQ;

  function next() {
    if (qi === nQ - 1) {
      const c = correct;
      setResult(onFinish(lesson.id, c));
    }
    setPicked(null);
    setStep(step + 1);
  }

  function restart() {
    setStep(0); setPicked(null); setCorrect(0); setResult(null);
  }

  return (
    <div className="stack">
      <div className="spread">
        <button className="ghost small-btn" onClick={onClose}>← Lessons</button>
        <div className="dots" aria-label={`Step ${Math.min(step + 1, total)} of ${total}`}>
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? "on" : i === step ? "cur" : ""} />)}
        </div>
      </div>

      {step < nCards && (
        <section className="card lesson-card" aria-live="polite">
          <div className="spread">
            <span className="small muted">{lesson.emoji} {lesson.title} · {step + 1} of {nCards}</span>
            {earnable(s, lesson) > 0 && <Earn n={earnable(s, lesson)} />}
          </div>
          <h2>{lesson.cards[step].title}</h2>
          <p className="lesson-body">{lesson.cards[step].body}</p>
          <div className="spread">
            <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            <button onClick={() => setStep(step + 1)}>{step === nCards - 1 ? "Start free quiz" : "Next"}</button>
          </div>
        </section>
      )}

      {qi >= 0 && qi < nQ && (() => {
        const q = lesson.quiz[qi];
        return (
          <section className="card lesson-card">
            <div className="spread">
              <span className="small muted">Free quiz · question {qi + 1} of {nQ}</span>
              {earnable(s, lesson) > 0 && <Earn n={earnable(s, lesson)} />}
            </div>
            <h2>{q.q}</h2>
            <div className="options" role="radiogroup" aria-label="Answers">
              {q.options.map((o, i) => {
                const state = picked == null ? "" : i === q.answer ? " right" : i === picked ? " wrong" : "";
                return (
                  <button key={o} role="radio" aria-checked={picked === i} className={"option" + state} disabled={picked != null}
                    onClick={() => { setPicked(i); if (i === q.answer) setCorrect((c) => c + 1); }}>
                    {o}
                  </button>
                );
              })}
            </div>
            {picked != null && (
              <p className={"feedback " + (picked === q.answer ? "right" : "wrong")} role="status">
                <b>{picked === q.answer ? "Correct! " : "Not quite. "}</b>{q.explain}
              </p>
            )}
            <button disabled={picked == null} onClick={next}>{qi === nQ - 1 ? "See my score" : "Next question"}</button>
          </section>
        );
      })()}

      {step >= total && result && (
        <section className="card lesson-card result">
          <span className="result-emoji" aria-hidden="true">{result.passed ? "🎉" : "📚"}</span>
          <h2>{correct} of {nQ} correct</h2>
          {result.passed ? (
            <p className="small">{result.tokens > 0 ? "Lesson complete!" : "Nice review! You already earned this lesson's tokens, and reviewing is always free."}</p>
          ) : (
            <p className="small">You need {passMark(nQ)} to pass. Skim the cards and try again. Quizzes are free, so you lose nothing.</p>
          )}
          {result.tokens > 0 && <p className="reward">You earned +<Token n={result.tokens} /> tokens{result.allDone ? ` (including ${ALL_DONE_BONUS} for finishing every lesson)` : ""}</p>}
          {result.unlocked && (
            <div className="ready">
              <span>You unlocked the <b>{itemById(result.unlocked)?.name}</b>. Your character is wearing it now.</span>
              <button className="small-btn" onClick={onShop}>Customize it</button>
            </div>
          )}
          <div className="spread">
            <button className="ghost" onClick={restart}>{result.passed ? "Review again (free)" : "Try again (free)"}</button>
            <button onClick={onClose}>Back to lessons</button>
          </div>
          <span className="note">Wallet: {s.tokens} tokens. Spend them in the Shop.</span>
        </section>
      )}
    </div>
  );
}
