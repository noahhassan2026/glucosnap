"""Guardrail checks for the AI coach with a stubbed model (no key or network needed).

  python coach_test.py          # from the api/ folder
"""
from fastapi.testclient import TestClient

import coach
from app import app

c = TestClient(app)
spaghetti = {"label": "Spaghetti and meatballs", "meal_type": "dinner", "carbs": 85, "protein": 34, "fat": 28, "fiber": 7, "peak": 62}


def stub(answer):
    coach._chat_json = lambda prompt, schema, max_tokens=0: schema.model_validate(answer)
    coach.available = lambda: True


stub({"coach_note": "Your spaghetti dinner was carb-heavy.", "quests": [
    {"title": "Walk 10 minutes after your spaghetti dinner", "why": "Muscles soak up sugar.", "category": "move"},
    {"title": "Skip dessert tonight", "why": "Fewer carbs.", "category": "swap"},                     # eating less: dropped
    {"title": "Eat a smaller portion of pasta", "why": "Less sugar.", "category": "swap"},            # eating less: dropped
    {"title": "Ask your doctor about insulin", "why": "Medication helps.", "category": "plan"},       # medical: dropped
    {"title": "Eat the salad before the pasta", "why": "Fiber first slows the rise.", "category": "order"},
]})
r = c.post("/api/quests", json={"meals": [spaghetti], "hour": 19, "count": 3}).json()
titles = [q["title"] for q in r["quests"]]
assert r["source"] == "ai" and titles[:2] == ["Walk 10 minutes after your spaghetti dinner", "Eat the salad before the pasta"], r
assert len(titles) == 3 and r["quests"][2]["id"].startswith("lib-"), "library fills the gap"
assert all(q["xp"] == coach.XP[q["category"]] for q in r["quests"]), "XP comes from the category"
print("quests ok:", titles)

stub({"ideas": [
    {"name": "Lentil tacos", "why": "Fiber and protein.", "cost_usd": 1.5, "minutes": 20, "ingredients": ["lentils"], "steps": ["cook"],
     "carbs": 35, "protein": 18, "fat": 8, "fiber": 12, "calories": 300},
    {"name": "Steak dinner", "why": "Protein.", "cost_usd": 9, "minutes": 20, "ingredients": ["steak"], "steps": ["grill"],
     "carbs": 5, "protein": 40, "fat": 20, "fiber": 1, "calories": 350},                              # over budget: dropped
    {"name": "Pancake stack", "why": "Tasty.", "cost_usd": 1, "minutes": 15, "ingredients": ["mix"], "steps": ["cook"],
     "carbs": 70, "protein": 6, "fat": 8, "fiber": 1, "calories": 400},                               # spikes more than built-ins: dropped
]})
r = c.post("/api/meal-ideas", json={"meal_type": "dinner", "budget": 3, "count": 3}).json()
names = [i["name"] for i in r["ideas"]]
assert r["source"] == "ai" and names[0] == "Lentil tacos" and "Steak dinner" not in names and "Pancake stack" not in names, r
assert len(names) == 3 and all(i["peak_delta_mg_dl"] is not None for i in r["ideas"])
print("meal ideas ok:", [(i["name"], i["peak_delta_mg_dl"]) for i in r["ideas"]])
assert coach.allowed("Walk after breakfast") and not coach.allowed("Try intermittent fasting")
print("all good")
