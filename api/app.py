"""GlucoSnap model API (FastAPI).

  uvicorn app:app --port 8000          # from the api/ folder
  docs at http://localhost:8000/docs

POST /api/predict  multipart: photo (optional if context.macros given) + context (JSON string)
POST /api/risk     JSON: {cgm: [{t, mg_dl}], profile?}
POST /api/quests   JSON: recent meals + profile -> custom anti-spike quests (AI, with a built-in fallback)
POST /api/meal-ideas JSON: meal type, budget, diet, pantry -> cheap home meals, each scored by the curve model
GET  /api/health
Accounts, saved user data and the leaderboard: see accounts.py (/api/auth/*, /api/me, /api/leaderboard)
"""
import json, os, pickle, sys
from datetime import datetime
from typing import List, Literal, Optional

import numpy as np, pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "glucosnap_ml"))
from features import CURVE_TIERS, MEAL_TYPES, HISTORY_KEYS, pre_meal_stats, cgm_summary, history_features  # noqa: E402
import vision                                                                # noqa: E402
import coach                                                                 # noqa: E402
import accounts                                                              # noqa: E402

MODEL_DIR = os.environ.get("GLUCOSNAP_MODELS", os.path.join(HERE, "models"))
META = json.load(open(os.path.join(MODEL_DIR, "meta.json")))
CURVES = pickle.load(open(os.path.join(MODEL_DIR, "curve_models.pkl"), "rb"))
HEALTH = pickle.load(open(os.path.join(MODEL_DIR, "health_models.pkl"), "rb"))
ENC = PCA = None
if META["use_encoder"]:
    # the CGM encoder runs through onnxruntime (models/encoder.onnx from glucosnap_ml/export_onnx.py), no PyTorch needed
    import onnxruntime as ort
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = opts.inter_op_num_threads = 1
    ENC = ort.InferenceSession(os.path.join(MODEL_DIR, "encoder.onnx"), opts, providers=["CPUExecutionProvider"])
    PCA = pickle.load(open(os.path.join(MODEL_DIR, "pca.pkl"), "rb"))
MINUTES = [0] + META["horizons"]

app = FastAPI(title="GlucoSnap model API", version=META["version"])
origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
ACCOUNTS = accounts.Accounts(accounts.make_store())
app.include_router(accounts.router(ACCOUNTS))


@app.exception_handler(Exception)
async def unexpected(request, exc):
    # always answer with a JSON body: the web app reads an empty 500 as "server down" and switches to the mock
    return JSONResponse(status_code=500, content={"detail": f"Model server error: {type(exc).__name__}"})


# ---------- request models ---------------------------------------------------------------
class Reading(BaseModel):
    t: datetime
    mg_dl: float


class Profile(BaseModel):
    age: Optional[float] = None
    sex: Optional[Literal["M", "F"]] = None
    bmi: Optional[float] = None
    a1c: Optional[float] = None
    fasting_glu: Optional[float] = None


class Macros(BaseModel):
    carbs: float = Field(ge=0)
    protein: float = Field(0, ge=0)
    fat: float = Field(0, ge=0)
    fiber: float = Field(0, ge=0)
    calories: Optional[float] = Field(None, ge=0)


class Context(BaseModel):
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "lunch"
    hour: float = Field(12.5, ge=0, lt=24)
    pre_glucose_mg_dl: Optional[float] = Field(None, gt=20, lt=600)
    profile: Optional[Profile] = None
    macros: Optional[Macros] = None
    cgm_recent: Optional[List[Reading]] = None     # up to 3 days ending at the meal (preferred)
    cgm_last_6h: Optional[List[Reading]] = None    # older field, still accepted
    walk_after_meal_min: float = Field(0, ge=0, le=120)


class RiskRequest(BaseModel):
    cgm: List[Reading]
    profile: Optional[Profile] = None


class LoggedMeal(BaseModel):
    label: str = Field("Meal", max_length=80)
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "snack"]] = None
    carbs: float = Field(ge=0)
    protein: Optional[float] = Field(None, ge=0)
    fat: Optional[float] = Field(None, ge=0)
    fiber: Optional[float] = Field(None, ge=0)
    peak: Optional[float] = None                   # predicted rise, mg/dL


class QuestsRequest(BaseModel):
    meals: List[LoggedMeal] = Field(default_factory=list, max_length=10)   # newest first
    profile: Optional[Profile] = None
    risk_status: Optional[Literal["normal", "prediabetes", "t2d"]] = None
    hour: float = Field(12.5, ge=0, lt=24)
    count: int = Field(3, ge=1, le=5)
    have: List[str] = Field(default_factory=list, max_length=30)          # titles already on today's list
    exclude: List[str] = Field(default_factory=list, max_length=60)       # quest ids shown before ("new ideas")
    seed: str = Field("", max_length=40)


class MealIdeasRequest(BaseModel):
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "dinner"
    diet: Literal["any", "vegetarian", "vegan"] = "any"
    budget: float = Field(3.0, ge=1, le=10)        # US dollars per serving
    pantry: str = Field("", max_length=200)
    count: int = Field(3, ge=1, le=6)
    exclude: List[str] = Field(default_factory=list, max_length=60)       # idea ids shown before
    profile: Optional[Profile] = None


# ---------- helpers ----------------------------------------------------------------------
def to_grid(readings: List[Reading], step_min=5):
    """Readings at any interval -> 5-minute grid (interpolated across gaps up to 30 min)."""
    s = pd.Series([r.mg_dl for r in readings], index=pd.to_datetime([r.t for r in readings], utc=True)).sort_index()
    s = s[~s.index.duplicated()].resample(f"{step_min}min").mean().interpolate(limit=6)
    return s


def last_6h(readings):
    """The 72 five-minute readings ending at the last reading; None if under 5 hours are covered."""
    g = to_grid(readings)
    end = g.index[-1]
    grid = pd.date_range(end - pd.Timedelta(minutes=5 * 71), end, freq="5min")
    w = g.reindex(grid)
    if w.notna().sum() < 60:
        return None
    return w.interpolate().bfill().ffill().values.astype(np.float32)


def history_from(readings):
    g = to_grid(readings)
    return history_features(g[g.index[-1] - pd.Timedelta(days=3):].values)


def feature_row(ctx: Context, macros: Macros, walk: float, window, hist=None):
    p = ctx.profile
    cal = macros.calories if macros.calories is not None else 4 * macros.carbs + 4 * macros.protein + 9 * macros.fat
    w = min(walk, 60)
    f = dict(calories=cal, carbs=macros.carbs, protein=macros.protein, fat=macros.fat, fiber=macros.fiber,
             hour=ctx.hour, mt=MEAL_TYPES.get(ctx.meal_type, 3), mins_since_prev_meal=999,
             # Fitbit METs x10 averaged over the hour after eating: ~14 normal light activity, ~35 walking
             post_mets=(w * 35 + (60 - w) * 14) / 60,
             age=p.age if p and p.age is not None else np.nan,
             sex=(1 if p.sex == "M" else 0) if p and p.sex else np.nan,
             bmi=p.bmi if p and p.bmi is not None else np.nan,
             a1c=p.a1c if p and p.a1c is not None else np.nan,
             fasting_glu=p.fasting_glu if p and p.fasting_glu is not None else np.nan,
             insulin=np.nan, tg=np.nan, hdl=np.nan,
             pre_base=ctx.pre_glucose_mg_dl if ctx.pre_glucose_mg_dl is not None else np.nan)
    if window is not None:
        f.update(pre_meal_stats(window))
    f.update(hist or {f"h_{k}": np.nan for k in HISTORY_KEYS})
    return f


def predict_curve(ctx: Context, macros: Macros, walk: float, window, hist=None):
    p = ctx.profile
    tier = "sensor" if window is not None else ("labs" if p and (p.a1c is not None or p.fasting_glu is not None) else "basic")
    b = CURVES[tier]
    f = feature_row(ctx, macros, walk, window, hist)
    if tier == "sensor":
        x = np.array([[f[k] for k in CURVE_TIERS["sensor"]]], dtype=float)
        if ENC is not None:
            e = ENC.run(None, {"cgm": window[None, :].astype(np.float32)})[0]
            x = np.hstack([x, PCA.transform(e)])
    else:
        x = np.array([[f[k] for k in b["features"]]], dtype=float)
    d = np.array([0.0] + [mdl.predict(x)[0] for mdl in b["models"]])
    lo = d + np.array([0.0] + b["band_low"])
    hi = d + np.array([0.0] + b["band_high"])
    k = int(d.argmax())
    base = f["pre_base"] if not np.isnan(f["pre_base"]) else None
    return dict(minutes=MINUTES, delta_mg_dl=[round(v, 1) for v in d],
                delta_low=[round(v, 1) for v in lo], delta_high=[round(v, 1) for v in hi],
                baseline_mg_dl=round(base, 1) if base is not None else None,
                peak_delta_mg_dl=round(float(d[k]), 1), peak_minute=MINUTES[k],
                mae_mg_dl=b["cv_mae"], tier=tier)


def suggestions(ctx, macros, walk, window, hist, base_peak):
    opts = []
    if walk < 15:
        opts.append(("walk-15", "walk", "Walk 15 minutes after eating", macros, 15))
    if macros.carbs >= 30:
        half = Macros(carbs=macros.carbs / 2, protein=macros.protein, fat=macros.fat, fiber=macros.fiber,
                      calories=None if macros.calories is None else macros.calories - 2 * macros.carbs)
        opts.append(("half-carbs", "swap", "Swap half the starch (rice, bread, pasta) for vegetables or beans",
                     Macros(carbs=half.carbs + 8, protein=half.protein + 5, fat=half.fat, fiber=half.fiber + 6), walk))
    if macros.fiber < 8:
        opts.append(("add-fiber", "add_fiber", "Add a side of beans, lentils or a big salad",
                     Macros(carbs=macros.carbs + 8, protein=macros.protein + 4, fat=macros.fat, fiber=macros.fiber + 7), walk))
    if macros.protein < 20:
        opts.append(("add-protein", "add_protein", "Add a protein side (eggs, chicken, Greek yogurt)",
                     Macros(carbs=macros.carbs, protein=macros.protein + 20, fat=macros.fat + 5, fiber=macros.fiber), walk))
    out = []
    for sid, kind, text, mac, wk in opts:
        c = predict_curve(ctx, mac, wk, window, hist)
        cut = 0 if base_peak <= 0 else round(100 * (base_peak - c["peak_delta_mg_dl"]) / base_peak)
        if c["peak_delta_mg_dl"] < base_peak - 1:
            out.append(dict(id=sid, kind=kind, text=text, peak_delta_mg_dl=c["peak_delta_mg_dl"], peak_reduction_pct=cut))
    return sorted(out, key=lambda s: s["peak_delta_mg_dl"])


# ---------- routes -----------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "model_version": META["version"], "vision_provider": vision.PROVIDER, "vision_model": vision.MODEL if vision.PROVIDER else None,
            "coach_model": coach.MODEL if coach.available() else None,
            "accounts_storage": type(ACCOUNTS.store).__name__}


@app.post("/api/predict")
async def predict(context: str = Form(...), photo: Optional[UploadFile] = File(None)):
    try:
        ctx = Context.model_validate_json(context)
    except ValidationError as e:
        raise HTTPException(422, json.loads(e.json()))
    if ctx.macros is not None:
        mac = ctx.macros
        meal = dict(label="Your meal", calories=mac.calories if mac.calories is not None else 4 * mac.carbs + 4 * mac.protein + 9 * mac.fat,
                    carbs=mac.carbs, protein=mac.protein, fat=mac.fat, fiber=mac.fiber, confidence=1.0, source="user")
    elif photo is not None:
        try:
            est = vision.estimate_meal(await photo.read(), photo.content_type or "image/jpeg")
        except ValueError as e:
            raise HTTPException(415, str(e))
        except vision.VisionUnavailable as e:
            raise HTTPException(503, f"Photo analysis is unavailable ({e}). Send context.macros instead.")
        if est.confidence == 0 or est.calories <= 0:
            raise HTTPException(422, "No food found in the photo. Try another photo or enter the macros.")
        mac = Macros(carbs=est.carbs, protein=est.protein, fat=est.fat, fiber=est.fiber, calories=est.calories)
        meal = dict(label=est.label, calories=est.calories, carbs=est.carbs, protein=est.protein, fat=est.fat,
                    fiber=est.fiber, confidence=round(est.confidence, 2), source="photo",
                    items=[i.model_dump() for i in est.items])
    else:
        raise HTTPException(422, "Send a photo or context.macros.")
    window = hist = None
    readings = ctx.cgm_recent or ctx.cgm_last_6h
    if readings:
        window = last_6h(readings)
        if window is None:
            raise HTTPException(422, "CGM readings must cover at least the 5 hours before the meal")
        hist = history_from(readings)
        if ctx.pre_glucose_mg_dl is None:
            ctx.pre_glucose_mg_dl = float(window[-1])
    curve = predict_curve(ctx, mac, ctx.walk_after_meal_min, window, hist)
    return dict(meal=meal, curve=curve,
                suggestions=suggestions(ctx, mac, ctx.walk_after_meal_min, window, hist, curve["peak_delta_mg_dl"]),
                model_version=META["version"])


@app.post("/api/quests")
def quests(req: QuestsRequest):
    meals = [m.model_dump() for m in req.meals]
    return coach.custom_quests(meals, req.profile.model_dump() if req.profile else None, req.risk_status, req.hour,
                               req.count, req.have, req.exclude, req.seed)


MEAL_HOURS = {"breakfast": 8.0, "lunch": 12.5, "dinner": 18.5, "snack": 15.5}


@app.post("/api/meal-ideas")
def meal_ideas(req: MealIdeasRequest):
    ctx = Context(meal_type=req.meal_type, hour=MEAL_HOURS[req.meal_type], profile=req.profile)
    shown = [m["name"] for m in coach.LIBRARY["meals"] if m["id"] in req.exclude]

    def scored(ideas):
        for m in ideas:
            c = predict_curve(ctx, Macros(**m["macros"]), 0, None)
            m.update(peak_delta_mg_dl=c["peak_delta_mg_dl"], peak_minute=c["peak_minute"], tier=c["tier"])
        return ideas

    # The curve model checks the AI: an idea it expects to spike more than every built-in meal of this type is dropped.
    steady = max(m["peak_delta_mg_dl"] for m in scored([dict(m) for m in coach.LIBRARY["meals"] if req.meal_type in m["meal_types"]]))
    ai = [m for m in scored(coach.ai_meals(req.meal_type, req.diet, req.budget, req.pantry, req.count, shown))
          if m["peak_delta_mg_dl"] <= steady and m["id"] not in req.exclude]
    ai = sorted(ai, key=lambda m: m["peak_delta_mg_dl"])[:req.count]
    lib = scored(coach.library_meals(req.meal_type, req.diet, req.budget, req.pantry, set()))
    # unseen ideas first; once every one has been shown, start over instead of coming back empty
    lib = sorted(lib, key=lambda m: (m["id"] in req.exclude, -m["pantry_hits"], m["peak_delta_mg_dl"]))[:req.count - len(ai)]
    for m in ai + lib:
        m.pop("pantry_hits", None); m.pop("meal_types", None); m.pop("diet", None)
    return dict(ideas=ai + lib, source="ai" if ai else "library", model=coach.MODEL if ai else None,
                model_version=META["version"])


@app.post("/api/risk")
def risk(req: RiskRequest):
    g = to_grid(req.cgm).dropna()
    days = (g.index[-1] - g.index[0]).total_seconds() / 86400 if len(g) else 0
    if days < 3:
        raise HTTPException(422, f"Need at least 3 days of CGM data (got {days:.1f}).")
    s = cgm_summary(g.values[-12 * 24 * 4:])     # the most recent 4 days (the model was fitted on 4-day summaries)
    x = np.array([[s[k] for k in HEALTH["features"]]])
    probs = HEALTH["status"].predict_proba(x)[0]
    names = ["normal", "prediabetes", "t2d"]
    return dict(a1c_estimate=round(float(HEALTH["a1c"].predict(x)[0]), 1), a1c_mae=HEALTH["a1c_cv_mae"],
                status=names[int(probs.argmax())], status_probs={n: round(float(p), 2) for n, p in zip(names, probs)},
                days_of_data=round(days, 1))
