"""Quick end-to-end check of the API with synthetic CGM data (no dataset or API key needed).

  python smoke_test.py          # from the api/ folder
"""
import json
from datetime import datetime, timedelta, timezone

import numpy as np
from fastapi.testclient import TestClient

from app import app

c = TestClient(app)
end = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc)


def cgm(days, step_min=15, seed=0):
    rng = np.random.default_rng(seed)
    n = int(days * 24 * 60 / step_min)
    t = [end - timedelta(minutes=step_min * (n - 1 - i)) for i in range(n)]
    hrs = np.array([x.hour + x.minute / 60 for x in t])
    v = 100 + 25 * np.exp(-((hrs - 8.5) % 24) / 1.5) + 30 * np.exp(-((hrs - 19) % 24) / 1.5) + rng.normal(0, 4, n)
    return [{"t": x.isoformat(), "mg_dl": round(float(y), 1)} for x, y in zip(t, v)]


def predict(ctx, **kw):
    return c.post("/api/predict", data={"context": json.dumps(ctx)}, **kw)


meal = {"carbs": 75, "protein": 15, "fat": 12, "fiber": 4}
r = c.get("/api/health"); assert r.status_code == 200, r.text; print("health", r.json())

r = predict({"meal_type": "lunch", "hour": 12.5, "macros": meal})
assert r.status_code == 200, r.text
cur = r.json()["curve"]; assert cur["tier"] == "basic" and len(cur["delta_mg_dl"]) == 9
print("basic ", cur["peak_delta_mg_dl"], "at", cur["peak_minute"], "min, suggestions", [s["id"] for s in r.json()["suggestions"]])

r = predict({"meal_type": "lunch", "hour": 12.5, "macros": meal, "pre_glucose_mg_dl": 105,
             "profile": {"age": 45, "sex": "F", "bmi": 29, "a1c": 6.1}})
assert r.status_code == 200 and r.json()["curve"]["tier"] == "labs", r.text
print("labs  ", r.json()["curve"]["peak_delta_mg_dl"], "baseline", r.json()["curve"]["baseline_mg_dl"])

r = predict({"meal_type": "lunch", "hour": 12.5, "macros": meal, "cgm_recent": cgm(3)})
assert r.status_code == 200 and r.json()["curve"]["tier"] == "sensor", r.text
cur = r.json()["curve"]; print("sensor", cur["peak_delta_mg_dl"], "baseline", cur["baseline_mg_dl"], "band", cur["delta_low"][4], cur["delta_high"][4])

walk = predict({"meal_type": "lunch", "hour": 12.5, "macros": meal, "cgm_recent": cgm(3), "walk_after_meal_min": 20})
print("sensor + 20 min walk", walk.json()["curve"]["peak_delta_mg_dl"])

r = predict({"meal_type": "lunch", "hour": 12.5, "cgm_last_6h": cgm(0.25, 5), "macros": meal})
assert r.status_code == 200 and r.json()["curve"]["tier"] == "sensor", r.text

assert predict({"meal_type": "lunch"}).status_code == 422
assert predict({"meal_type": "brunch", "macros": meal}).status_code == 422
assert predict({"macros": meal, "cgm_recent": cgm(0.1)}).status_code == 422
r = predict({"meal_type": "lunch"}, files={"photo": ("a.txt", b"hi", "text/plain")})
assert r.status_code == 415, r.text

r = c.post("/api/risk", json={"cgm": cgm(5)})
assert r.status_code == 200, r.text; print("risk  ", r.json())
r = c.post("/api/risk", json={"cgm": cgm(2)})
assert r.status_code == 422 and "3 days" in r.json()["detail"]
print("all checks passed")
