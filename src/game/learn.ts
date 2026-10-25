// Learning center: short plain-language lessons with a quiz, plus the ADA diabetes risk test.
// Tokens are paid once per lesson (and once for the risk check), so retakes are free practice.
// Figures come from the CDC, the American Diabetes Association and the FDA (cited in each card).
import type { QuestState } from "./quest";

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Lesson {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  cards: { title: string; body: string }[];
  quiz: Question[];
  unlocks?: string; // shop item given on passing
}

export const LESSON_TOKENS = 15;
export const PERFECT_BONUS = 5;
export const ALL_DONE_BONUS = 30;
export const RISK_TOKENS = 10;

export const LESSONS: Lesson[] = [
  {
    id: "blood-sugar",
    title: "What is blood sugar?",
    blurb: "Glucose, insulin, and what diabetes really is.",
    emoji: "🩸",
    cards: [
      { title: "Your body runs on glucose", body: "When you eat carbohydrates, like bread, rice, fruit or soda, your body breaks them down into a sugar called glucose. Glucose rides in your blood to every cell. That is your blood sugar." },
      { title: "Insulin is the key", body: "Insulin is a hormone made by your pancreas. It works like a key: it lets glucose leave the blood and enter your cells, where it is used for energy or stored for later." },
      { title: "When the key stops working", body: "In type 2 diabetes the body stops responding well to insulin and can't make enough extra to keep up, so sugar builds up in the blood. In type 1 diabetes the body destroys the cells that make insulin, so people need insulin every day. About 90 to 95 out of every 100 people with diabetes have type 2 (CDC)." },
      { title: "Ups and downs are normal", body: "Blood sugar rises after you eat and falls between meals. What matters is how high it goes, how long it stays high, and where it sits most of the time." },
    ],
    quiz: [
      { q: "What is the main sugar in your blood?", options: ["Glucose", "Table salt", "Caffeine"], answer: 0, explain: "Carbs are broken down into glucose, which your blood carries to your cells." },
      { q: "What does insulin do?", options: ["Makes you hungry", "Moves glucose from your blood into your cells", "Turns protein into fat"], answer: 1, explain: "Insulin is the key that lets glucose into your cells." },
      { q: "Which type of diabetes is most common?", options: ["Type 1", "They are equally common", "Type 2"], answer: 2, explain: "About 9 in 10 people with diabetes have type 2." },
    ],
  },
  {
    id: "mgdl",
    title: "Reading the numbers: mg/dL",
    blurb: "What 100 mg/dL means, and which numbers are normal.",
    emoji: "🔢",
    cards: [
      { title: "What mg/dL means", body: "mg/dL means milligrams per deciliter: how many milligrams of glucose are in a small amount of blood (a deciliter is a bit less than half a cup). Many countries use mmol/L instead. Divide mg/dL by 18 to convert, so 100 mg/dL is about 5.6 mmol/L." },
      { title: "Fasting numbers", body: "After at least 8 hours without food: under 100 mg/dL is the normal range, 100 to 125 is the prediabetes range, and 126 or higher (on two tests) is the diabetes range (American Diabetes Association)." },
      { title: "After meals", body: "In people without diabetes, blood sugar usually comes back below 140 mg/dL within two hours of eating. People who wear a sensor often aim to stay between 70 and 180 mg/dL. That 180 line is the dashed line on GlucoSnap's charts." },
      { title: "A1C: your 3-month average", body: "The A1C blood test shows your average blood sugar over the past 2 to 3 months. Below 5.7% is normal, 5.7% to 6.4% is prediabetes, and 6.5% or higher is diabetes." },
      { title: "Too low matters too", body: "Below 70 mg/dL is low blood sugar. You may feel shaky, sweaty, hungry or confused. It is most common in people who take insulin or certain diabetes pills. The usual fix is the 15-15 rule: eat 15 grams of fast sugar (like half a cup of juice) and check again in 15 minutes. Below 54 is serious, so get help." },
    ],
    quiz: [
      { q: "A fasting reading of 112 mg/dL is in which range?", options: ["Normal", "Prediabetes", "Diabetes"], answer: 1, explain: "100 to 125 mg/dL fasting is the prediabetes range." },
      { q: "What does an A1C test measure?", options: ["Your average blood sugar over 2 to 3 months", "Your blood sugar right now", "How much sugar you ate today"], answer: 0, explain: "A1C reflects the last 2 to 3 months, so one meal doesn't change it." },
      { q: "Which reading counts as low blood sugar?", options: ["135 mg/dL", "95 mg/dL", "65 mg/dL"], answer: 2, explain: "Under 70 mg/dL is low." },
      { q: "Two hours after a meal, people without diabetes are usually below…", options: ["90 mg/dL", "140 mg/dL", "250 mg/dL"], answer: 1, explain: "Below 140 mg/dL two hours after eating is typical without diabetes." },
    ],
  },
  {
    id: "cgm",
    title: "How a glucose monitor works",
    blurb: "The tiny sensor behind GlucoSnap. Pass to unlock one for your character.",
    emoji: "📟",
    unlocks: "starter",
    cards: [
      { title: "A tiny sensor on your arm", body: "A continuous glucose monitor (CGM) is a sensor about the size of a coin, usually worn on the back of the upper arm or on the belly. A thin, flexible wire sits just under the skin. Most last 10 to 15 days." },
      { title: "A reading every few minutes", body: "It measures glucose in the fluid around your cells and sends a reading to your phone every 1 to 5 minutes, day and night. That can be nearly 300 readings a day, compared with one finger prick." },
      { title: "A few minutes behind", body: "The fluid under your skin trails your blood by about 5 to 15 minutes. When sugar is changing fast, a CGM can read a little behind a finger-prick test." },
      { title: "Not just for diabetes anymore", body: "In 2024 the FDA cleared the first over-the-counter sensors for adults who don't use insulin. GlucoSnap's models learned from sensor data of people with and without diabetes." },
    ],
    quiz: [
      { q: "Where does a CGM measure glucose?", options: ["In your saliva", "In the fluid just under your skin", "In your breath"], answer: 1, explain: "The wire sits in the fluid around your cells, just under the skin." },
      { q: "How often does a CGM give a reading?", options: ["Every 1 to 5 minutes", "Once a day", "Once a week"], answer: 0, explain: "That steady stream is what lets GlucoSnap see your whole curve after a meal." },
      { q: "Why can a CGM read a little behind a finger prick?", options: ["The battery is slow", "It only works at night", "Fluid under the skin trails the blood by a few minutes"], answer: 2, explain: "Glucose reaches the fluid under your skin about 5 to 15 minutes after your blood." },
    ],
  },
  {
    id: "spikes",
    title: "What makes blood sugar spike",
    blurb: "Carbs, fiber, food order, and the after-meal walk.",
    emoji: "📈",
    cards: [
      { title: "Carbs raise it the most", body: "Carbohydrates turn into glucose fastest. Sugary drinks, white bread, white rice and sweets raise blood sugar quickly. Protein and fat raise it much less." },
      { title: "Fiber slows it down", body: "Fiber in beans, vegetables, whole grains and fruit with the skin on slows digestion, so sugar enters your blood more gently." },
      { title: "Order and pairing help", body: "Eating vegetables and protein before the starch, or pairing carbs with protein, can make the spike smaller. You don't have to give up the foods you like." },
      { title: "Move after you eat", body: "A 10 to 15 minute walk after a meal helps your muscles use glucose right away. Even light movement like doing dishes or pacing on a call counts." },
      { title: "Sleep and stress count too", body: "Short sleep and stress hormones can push blood sugar up and make insulin work less well. Rest is part of the plan." },
    ],
    quiz: [
      { q: "Which raises blood sugar fastest?", options: ["A boiled egg", "A handful of almonds", "A can of regular soda"], answer: 2, explain: "Soda is fast sugar with no fiber, protein or fat to slow it down." },
      { q: "What does fiber do?", options: ["Slows how fast sugar enters your blood", "Adds extra sugar", "Nothing at all"], answer: 0, explain: "Fiber makes digestion slower and the spike gentler." },
      { q: "Which simple habit helps after a meal?", options: ["Lying down right away", "A 10 to 15 minute walk", "Skipping water"], answer: 1, explain: "Moving muscles pull glucose out of the blood." },
    ],
  },
  {
    id: "high",
    title: "Why high blood sugar matters",
    blurb: "The warning signs and what years of high sugar can do.",
    emoji: "❤️",
    cards: [
      { title: "Often no symptoms at first", body: "High blood sugar can go unnoticed for years. When signs do show up, they include being very thirsty, peeing often, feeling tired, blurry vision, and cuts that heal slowly." },
      { title: "It wears on blood vessels", body: "Over years, extra sugar damages blood vessels. Adults with diabetes are about twice as likely to have heart disease or a stroke as adults without it (CDC)." },
      { title: "Eyes, kidneys, nerves and feet", body: "Diabetes is a leading cause of kidney failure, blindness in adults, and lower-leg amputations, which come from nerve damage and poor blood flow in the feet (CDC)." },
      { title: "The good news", body: "Keeping blood sugar in range lowers these risks a lot, and prediabetes can often be turned around. That's why catching it early matters so much." },
    ],
    quiz: [
      { q: "Which can be a sign of high blood sugar?", options: ["Feeling very thirsty", "Hair growing faster", "Better night vision"], answer: 0, explain: "Thirst, peeing often, tiredness and blurry vision are classic signs." },
      { q: "Diabetes is a leading cause of…", options: ["Broken bones", "Kidney failure", "Ear infections"], answer: 1, explain: "High sugar damages the tiny filters in the kidneys over time." },
      { q: "Can prediabetes get better?", options: ["No, never", "Only with surgery", "Yes, often with healthy habits"], answer: 2, explain: "Many people bring their numbers back to normal with activity and eating changes." },
    ],
  },
  {
    id: "risk",
    title: "Who is at risk?",
    blurb: "Risk factors, why most people don't know, and how to get checked.",
    emoji: "🧭",
    cards: [
      { title: "Prediabetes is common", body: "About 98 million US adults, more than 1 in 3, have prediabetes. More than 8 in 10 of them don't know it (CDC)." },
      { title: "Things you can't change", body: "Being 45 or older, having a parent, brother or sister with type 2 diabetes, or having had diabetes during pregnancy. Black, Hispanic or Latino, American Indian, Alaska Native, Pacific Islander and some Asian American people also face higher risk." },
      { title: "Things you can change", body: "Carrying extra weight, being active fewer than 3 times a week, and high blood pressure that isn't treated all raise your risk." },
      { title: "Small changes, big results", body: "In the Diabetes Prevention Program, people with prediabetes who got about 150 minutes of activity a week and lost a small amount of weight (5 to 7%) cut their risk of type 2 diabetes by 58%, and by 71% for people over 60." },
      { title: "Get checked", body: "An A1C or fasting glucose blood test at a clinic or pharmacy tells you where you stand. The ADA suggests testing every adult from age 35, or sooner with risk factors. The risk check in this tab takes one minute." },
    ],
    quiz: [
      { q: "How many US adults with prediabetes know they have it?", options: ["Almost all", "Fewer than 2 in 10", "About half"], answer: 1, explain: "More than 8 in 10 don't know, which is why screening matters." },
      { q: "Which is a risk factor you can change?", options: ["Being physically inactive", "Your age", "Your family history"], answer: 0, explain: "Activity is in your hands; age and family history aren't." },
      { q: "In the Diabetes Prevention Program, healthy habits cut type 2 risk by about…", options: ["5%", "100%", "58%"], answer: 2, explain: "58% overall, and 71% for people over 60." },
    ],
  },
  {
    id: "plate",
    title: "Eating well on a budget",
    blurb: "The plate method and cheap staples that keep sugar steady.",
    emoji: "🥗",
    cards: [
      { title: "The plate method", body: "Fill half your plate with non-starchy vegetables, a quarter with protein, and a quarter with carbs like rice, bread or potatoes. Drink water or unsweetened drinks (ADA)." },
      { title: "Cheap staples that help", body: "Dry or canned beans and lentils, eggs, oats, frozen vegetables, brown rice, canned tuna, peanut butter, apples and bananas. Frozen vegetables are about as nutritious as fresh. Rinse canned beans to cut the salt." },
      { title: "Swap, don't skip", body: "You don't need to give up foods you love. Swap soda for sparkling water, white bread for whole wheat, add beans to your rice. Regular meals help too: skipping one can make the next spike bigger." },
      { title: "Read the label", body: "Check total carbohydrate, fiber and added sugars. More fiber and less added sugar is usually the better pick." },
    ],
    quiz: [
      { q: "In the plate method, half your plate is…", options: ["Rice or pasta", "Non-starchy vegetables", "Meat"], answer: 1, explain: "Vegetables fill you up with fiber and barely move blood sugar." },
      { q: "Which cheap food helps keep blood sugar steady?", options: ["Canned beans", "Candy", "Soda"], answer: 0, explain: "Beans bring fiber and protein for very little money." },
      { q: "Are frozen vegetables healthy?", options: ["No, freezing removes the nutrients", "Only if fried", "Yes, about as nutritious as fresh"], answer: 2, explain: "They are frozen soon after picking, so they keep their nutrients." },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const passMark = (total: number) => Math.ceil((total * 2) / 3);

export interface LessonResult {
  state: QuestState;
  passed: boolean;
  tokens: number; // paid this time
  unlocked?: string; // shop item id
  allDone?: boolean;
}

// Records a finished quiz. Only the first pass pays; a later perfect score can still earn the bonus.
export function finishLesson(prev: QuestState, id: string, correct: number): LessonResult {
  const lesson = lessonById(id);
  if (!lesson) return { state: prev, passed: false, tokens: 0 };
  const total = lesson.quiz.length;
  const passed = correct >= passMark(total);
  const best = prev.lessons[id] ?? -1;
  if (!passed || correct <= best) return { state: prev, passed, tokens: 0 };
  let tokens = 0;
  if (best < passMark(total)) tokens += LESSON_TOKENS;
  if (correct === total) tokens += PERFECT_BONUS;
  const s: QuestState = { ...prev, lessons: { ...prev.lessons, [id]: correct } };
  let unlocked: string | undefined;
  if (lesson.unlocks && !s.owned.includes(lesson.unlocks)) {
    unlocked = lesson.unlocks;
    s.owned = [...s.owned, unlocked];
    s.equipped = { ...s.equipped, monitor: unlocked };
  }
  const wasAll = LESSONS.every((l) => (prev.lessons[l.id] ?? -1) >= passMark(l.quiz.length));
  const allDone = !wasAll && LESSONS.every((l) => (s.lessons[l.id] ?? -1) >= passMark(l.quiz.length));
  if (allDone) tokens += ALL_DONE_BONUS;
  s.tokens += tokens;
  return { state: s, passed, tokens, unlocked, allDone };
}

export const lessonPassed = (s: QuestState, id: string) => {
  const l = lessonById(id);
  return !!l && (s.lessons[id] ?? -1) >= passMark(l.quiz.length);
};

// American Diabetes Association Type 2 Diabetes Risk Test (Bang et al., Ann Intern Med 2009).
// A score of 5 or more means higher risk of type 2 diabetes. It screens; it does not diagnose.
export interface RiskAnswers {
  age: number;
  sex: "M" | "F";
  gestational: boolean;
  family: boolean;
  highBp: boolean;
  active: boolean;
  bmi: number;
}

export const RISK_CUTOFF = 5;
export const RISK_MAX = 10;

export function adaRiskScore(a: RiskAnswers) {
  const parts = {
    age: a.age >= 60 ? 3 : a.age >= 50 ? 2 : a.age >= 40 ? 1 : 0,
    sex: a.sex === "M" ? 1 : 0,
    gestational: a.sex === "F" && a.gestational ? 1 : 0,
    family: a.family ? 1 : 0,
    highBp: a.highBp ? 1 : 0,
    inactive: a.active ? 0 : 1,
    weight: a.bmi >= 40 ? 3 : a.bmi >= 30 ? 2 : a.bmi >= 25 ? 1 : 0,
  };
  const score = Object.values(parts).reduce((x, y) => x + y, 0);
  return { score, parts, high: score >= RISK_CUTOFF };
}

export const bmiFrom = (kg: number, cm: number) => kg / (cm / 100) ** 2;

// Pays the risk-check reward once, for taking it, whatever the score.
export function finishRiskCheck(prev: QuestState, score: number, date: string): { state: QuestState; tokens: number } {
  const tokens = prev.riskCheck ? 0 : RISK_TOKENS;
  return { state: { ...prev, tokens: prev.tokens + tokens, riskCheck: { score, date } }, tokens };
}
