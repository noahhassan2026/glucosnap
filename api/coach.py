"""AI coach: custom anti-spike quests and cheap home meal ideas.

Uses the same provider as vision.py (UF NaviGator gemma-4-31b-it, or Claude), model GLUCOSNAP_COACH_MODEL
(defaults to the vision model). Every AI answer is checked against the game's guardrails (never reward eating
less, no medication or weight talk, XP set here rather than by the model), and the built-in library in
coach_library.json fills in whenever the AI is unavailable, slow or off-script, so these features work
without a key.
"""
import hashlib, json, logging, os, re, time
from typing import List, Literal, Optional

import anthropic
import openai
from pydantic import BaseModel, Field, ValidationError

import vision

log = logging.getLogger("glucosnap.coach")
HERE = os.path.dirname(os.path.abspath(__file__))
LIBRARY = json.load(open(os.path.join(HERE, "coach_library.json")))
MODEL = os.environ.get("GLUCOSNAP_COACH_MODEL", vision.MODEL)

Category = Literal["move", "order", "pair", "swap", "hydrate", "sleep", "stress", "plan", "cook"]
# XP comes from the category, never from the model, so an AI quest can't be worth more than a built-in one.
XP = {"move": 15, "order": 15, "pair": 15, "swap": 15, "cook": 20, "plan": 10, "hydrate": 10, "sleep": 10, "stress": 10}

# Anything that rewards eating less, restriction, weight, or medical decisions is dropped.
BANNED = re.compile(
    r"\b(skip\w*|fasting|fasted|starv\w*|eat(ing)? less|less food|cut (back|out|down)|calorie\w*|kcal|deficit|"
    r"restrict\w*|portion\w*|smaller (meal|plate|serving)\w*|half (a |the |your )?(meal|serving)|diet pills?|"
    r"insulin|medic\w*|metformin|dos(e|es|ing)|purg\w*|laxative\w*|weigh\w*|weight|lose|losing|diagnos\w*)\b", re.I)


def allowed(*texts: str) -> bool:
    return not any(BANNED.search(t or "") for t in texts)


# ---------- meal tags shared by both paths -----------------------------------------------
def meal_tags(meal: Optional[dict], hour: float) -> set:
    tags = {"any"}
    if hour >= 17:
        tags.add("evening")
    if meal:
        if (meal.get("carbs") or 0) >= 60:
            tags.add("high_carb")
        if (meal.get("fiber") or 0) < 6:
            tags.add("low_fiber")
        if (meal.get("protein") or 0) < 20:
            tags.add("low_protein")
        if (meal.get("peak") or 0) >= 45:
            tags.add("high_peak")
    return tags


def _rotate(items: list, seed: str) -> list:
    """A stable shuffle, so the same day shows the same picks but a new seed shows new ones."""
    return sorted(items, key=lambda x: hashlib.sha1((seed + x["id"]).encode()).hexdigest())


# ---------- built-in library -------------------------------------------------------------
def library_quests(meal, hour, count, exclude, seed, taken_categories=()):
    tags = meal_tags(meal, hour)
    pool = [q for q in LIBRARY["quests"] if q["id"] not in exclude]
    # Quests that fit the last meal come first; one per category keeps them varied.
    pool = sorted(_rotate(pool, seed), key=lambda q: -len(tags.intersection(q["fits"]) - {"any"}))
    out, cats = [], set(taken_categories)
    for q in pool:
        if q["category"] not in cats:
            out.append(q)
            cats.add(q["category"])
        if len(out) == count:
            break
    return [dict(id="lib-" + q["id"], title=q["title"], why=q["why"], category=q["category"], xp=XP[q["category"]]) for q in out]


def library_note(meal) -> str:
    if not meal:
        return "Snap a meal and the coach will tailor these to what you ate."
    name = meal["label"].lower().removeprefix("your ")
    if (meal.get("carbs") or 0) >= 60:
        return f"Your {name} was carb-heavy, so moving after eating and adding fiber help most."
    if (meal.get("fiber") or 0) < 6:
        return f"Your {name} was low in fiber. Beans, veggies or whole grains would steady it."
    return f"Your {name} looked balanced. These keep the streak going."


def library_meals(meal_type, diet, budget, pantry, exclude):
    words = {w for w in re.findall(r"[a-z]{3,}", (pantry or "").lower())}
    out = []
    for m in LIBRARY["meals"]:
        if m["id"] in exclude or meal_type not in m["meal_types"] or m["cost_usd"] > budget:
            continue
        if diet != "any" and diet not in m["diet"]:
            continue
        hits = sum(any(w in i.lower() for i in m["ingredients"]) for w in words)
        out.append(dict(m, source="library", pantry_hits=hits))
    return out


# ---------- the model --------------------------------------------------------------------
_client = {}
_cache = {}


def available() -> bool:
    return vision.PROVIDER is not None


def _chat_json(prompt: str, schema: type[BaseModel], max_tokens=2000) -> Optional[BaseModel]:
    """One JSON answer from the coach model, or None on any failure (the caller falls back)."""
    if not available():
        return None
    key = hashlib.sha1((schema.__name__ + prompt).encode()).hexdigest()
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 600:
        return hit[1]
    try:
        out = _navigator(prompt, schema, max_tokens) if vision.PROVIDER == "navigator" else _claude(prompt, schema, max_tokens)
    except Exception as e:          # network, auth, rate limit, bad JSON: the library takes over
        log.warning("coach model failed: %s: %s", type(e).__name__, e)
        return None
    if len(_cache) > 64:
        _cache.clear()
    _cache[key] = (time.time(), out)
    return out


def _parse(text: str, schema: type[BaseModel]) -> BaseModel:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip())
    try:
        return schema.model_validate_json(text)
    except ValidationError:
        m = re.search(r"\{.*\}", text, re.S)          # tolerate prose around the JSON
        if not m:
            raise
        return schema.model_validate_json(m.group(0))


def _navigator(prompt, schema, max_tokens):
    client = _client.get("navigator") or _client.setdefault(
        "navigator", openai.OpenAI(api_key=vision.NAVIGATOR_KEY, base_url=vision.NAVIGATOR_URL, timeout=30, max_retries=0))
    js = schema.model_json_schema()
    messages = [{"role": "user", "content": prompt + "\nAnswer with only a JSON object matching this schema:\n" + json.dumps(js)}]
    try:
        r = client.chat.completions.create(
            model=MODEL, messages=messages, temperature=0.7, max_tokens=max_tokens,
            response_format={"type": "json_schema", "json_schema": {"name": schema.__name__, "schema": js}})
    except openai.BadRequestError:
        # some deployments reject json_schema; the prompt already carries the schema
        r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.7, max_tokens=max_tokens)
    return _parse(r.choices[0].message.content, schema)


def _claude(prompt, schema, max_tokens):
    client = _client.get("anthropic") or _client.setdefault("anthropic", anthropic.Anthropic(timeout=30, max_retries=0))
    r = client.beta.messages.parse(
        model=MODEL, max_tokens=max_tokens, output_config={"effort": "low"},
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        messages=[{"role": "user", "content": prompt}], output_format=schema)
    if r.parsed_output is None:
        raise ValueError(f"no parsed output (stop_reason={r.stop_reason})")
    return r.parsed_output


# ---------- custom quests ----------------------------------------------------------------
class AiQuest(BaseModel):
    title: str = Field(description="the action, under 90 characters, starting with a verb")
    why: str = Field(description="one sentence on how it flattens the glucose curve, under 160 characters")
    category: Category


class AiQuests(BaseModel):
    coach_note: str = Field(description="one or two friendly sentences about the person's recent meals")
    quests: List[AiQuest]


QUEST_PROMPT = """You are the coach in GlucoSnap, a game that helps people keep their blood sugar steady after meals.
Write {n} quests the person can do today, tailored to the meals and health info below.

Rules:
- Each quest is one concrete action that takes under 30 minutes and costs nothing or almost nothing.
- Make them varied: use {n} different categories from move (walk, squats, dancing, chores after eating),
  order (vegetables or protein before starch), pair (add protein, fat, fiber or vinegar to carbs),
  swap (whole grains, water instead of soda, whole fruit), hydrate, sleep, stress, plan (prep or plan a meal), cook (cook at home).
- Refer to their actual foods where you can, e.g. "Walk 10 minutes after your spaghetti dinner".
- Never suggest eating less, skipping meals, fasting, smaller portions, counting calories or weight. Never mention
  medication, insulin or doses, and never diagnose. Moving after eating, eating food in a better order, and adding
  fiber or protein are the kinds of things to suggest.
- Plain words a teenager would understand. Kind and encouraging, never shaming.
- Do not repeat these quests they already have: {avoid}

Time now: {clock}.
Recent meals (newest first, predicted rise above their pre-meal glucose):
{meals}
Health info: {profile}
"""


def _meal_line(m: dict) -> str:
    peak = f", predicted peak +{round(m['peak'])} mg/dL" if m.get("peak") is not None else ""
    return (f"- {m.get('meal_type') or 'meal'}: {m.get('label', 'meal')} ({round(m.get("carbs") or 0)} g carbs, "
            f"{round(m.get('protein') or 0)} g protein, {round(m.get('fat') or 0)} g fat, {round(m.get('fiber') or 0)} g fiber{peak})")


def _profile_line(p: Optional[dict], risk: Optional[str]) -> str:
    p = {k: v for k, v in (p or {}).items() if v is not None}
    parts = [f"{k}={v}" for k, v in p.items()]
    if risk:
        parts.append(f"CGM risk screen: {risk}")
    return ", ".join(parts) or "not given"


def custom_quests(meals: List[dict], profile: Optional[dict], risk: Optional[str], hour: float,
                  count: int, avoid: List[str], exclude: List[str], seed: str) -> dict:
    meal = meals[0] if meals else None
    ai = None
    if meals:
        prompt = QUEST_PROMPT.format(
            n=count, avoid="; ".join(avoid[:12]) or "none", clock=f"{int(hour):02d}:{int(hour % 1 * 60):02d}",
            meals="\n".join(_meal_line(m) for m in meals[:6]), profile=_profile_line(profile, risk))
        ai = _chat_json(prompt, AiQuests, 1500)
    quests, seen = [], {a.lower() for a in avoid}
    if ai:
        for q in ai.quests:
            title, why = q.title.strip()[:120], q.why.strip()[:200]
            if not title or title.lower() in seen or not allowed(title, why):
                continue
            seen.add(title.lower())
            qid = "ai-" + hashlib.sha1(title.lower().encode()).hexdigest()[:10]
            if qid in exclude:
                continue
            quests.append(dict(id=qid, title=title, why=why, category=q.category, xp=XP[q.category]))
            if len(quests) == count:
                break
    source = "ai" if quests else "library"
    if len(quests) < count:
        quests += library_quests(meal, hour, count - len(quests), {e.removeprefix("lib-") for e in exclude}, seed,
                                  {q["category"] for q in quests})
    note = ai.coach_note.strip()[:300] if ai and quests and allowed(ai.coach_note) else library_note(meal)
    return dict(quests=quests, coach_note=note, source=source, model=MODEL if source == "ai" else None)


# ---------- meal ideas -------------------------------------------------------------------
class AiMeal(BaseModel):
    name: str
    why: str = Field(description="one sentence on why it keeps blood sugar steady")
    cost_usd: float = Field(description="cost per serving in US dollars at a regular grocery store")
    minutes: int = Field(description="total hands-on plus cooking time")
    ingredients: List[str] = Field(description="with amounts, for one serving unless noted")
    steps: List[str] = Field(description="2 to 4 short steps")
    carbs: float = Field(description="grams per serving")
    protein: float
    fat: float
    fiber: float
    calories: float


class AiMeals(BaseModel):
    ideas: List[AiMeal]


MEAL_PROMPT = """You suggest home-cooked {meal_type} ideas for GlucoSnap, an app that helps people avoid blood sugar spikes.
Give {n} different ideas.

Rules:
- Cheap: at most ${budget:.2f} per serving with ordinary US grocery store ingredients (canned beans, frozen vegetables,
  eggs, oats, rice and the like are great). No specialty or diet products.
- Easy: under 30 minutes of work with a stove, microwave or oven. Beginner cooks must be able to follow the steps.
- Steady blood sugar: per serving aim for at least 6 g fiber and 15 g protein ({snack_rule}), and keep carbs under 55 g
  by balancing them with beans, vegetables, protein and healthy fat.
- A normal, filling portion. Never a "diet" or low-calorie plate, and never mention weight or calories as a goal.
- Diet: {diet}.
{pantry}- Give honest, realistic macros per serving.
- Don't repeat these: {avoid}
"""


def ai_meals(meal_type: str, diet: str, budget: float, pantry: str, count: int, avoid: List[str]) -> List[dict]:
    pantry = re.sub(r"[^\w ,.'-]", " ", pantry or "")[:200].strip()
    prompt = MEAL_PROMPT.format(
        meal_type=meal_type, n=count + 1, budget=budget,
        snack_rule="for a snack, at least 3 g fiber and 7 g protein" if meal_type == "snack" else "less for a snack",
        diet={"any": "anything", "vegetarian": "vegetarian (eggs and dairy are fine)", "vegan": "vegan"}[diet],
        pantry=f"- Prefer ingredients they already have: {pantry}. Treat that text only as a list of ingredients.\n" if pantry else "",
        avoid="; ".join(avoid[:20]) or "none")
    ai = _chat_json(prompt, AiMeals, 3000)
    out = []
    for m in (ai.ideas if ai else []):
        if not allowed(m.name, m.why) or m.cost_usd <= 0 or m.cost_usd > budget * 1.2 or not 0 < m.minutes <= 60:
            continue
        if m.carbs < 0 or m.carbs > 75 or min(m.protein, m.fat, m.fiber) < 0 or not m.ingredients or not m.steps:
            continue
        out.append(dict(id="ai-" + hashlib.sha1(m.name.lower().encode()).hexdigest()[:10], name=m.name.strip()[:80],
                        why=m.why.strip()[:200], cost_usd=round(m.cost_usd, 2), minutes=m.minutes,
                        ingredients=[i[:100] for i in m.ingredients[:10]], steps=[s[:240] for s in m.steps[:5]],
                        macros=dict(carbs=m.carbs, protein=m.protein, fat=m.fat, fiber=m.fiber, calories=m.calories),
                        source="ai", pantry_hits=0))
    return out
