"""Turn CGMacros per-minute logs into one row per meal: features + 2h glucose curve."""
import sys, glob, os
import numpy as np, pandas as pd

root = sys.argv[1]
out = sys.argv[2]
bio = pd.read_csv(os.path.join(root, "bio.csv"))
bio.columns = [c.strip() for c in bio.columns]
bio = bio.loc[:, ~bio.columns.duplicated()]

HORIZONS = list(range(15, 121, 15))
rows = []
for f in sorted(glob.glob(os.path.join(root, "CGMacros-*", "CGMacros-*.csv"))):
    sid = int(os.path.basename(f)[9:12])
    d = pd.read_csv(f)
    d.columns = [c.strip() for c in d.columns]
    d["Timestamp"] = pd.to_datetime(d["Timestamp"])
    d = d.set_index("Timestamp").sort_index()
    g = d["Libre GL"].interpolate(limit=20)
    meals = d[d["Meal Type"].notna() & d["Carbs"].notna()]
    for t, m in meals.iterrows():
        pre = g[t - pd.Timedelta(minutes=60): t]
        if pre.isna().mean() > 0.2 or len(pre) < 50:
            continue
        base = pre.iloc[-5:].mean()
        curve = []
        for h in HORIZONS:
            v = g.get(t + pd.Timedelta(minutes=h), np.nan)
            curve.append(v - base)
        if np.isnan(curve).any():
            continue
        # previous meal within 3h overlaps the response; record it as a feature
        prev = meals.index[(meals.index < t) & (meals.index > t - pd.Timedelta(hours=3))]
        act = d["METs"][t - pd.Timedelta(minutes=60): t + pd.Timedelta(minutes=60)] if "METs" in d else pd.Series(dtype=float)
        rows.append(dict(
            subject=sid, time=t, meal_type=str(m["Meal Type"]).lower(),
            photo=m.get("Image path"),
            calories=m["Calories"], carbs=m["Carbs"], protein=m["Protein"],
            fat=m["Fat"], fiber=m["Fiber"],
            hour=t.hour + t.minute / 60,
            pre_base=base, pre_slope=(pre.iloc[-1] - pre.iloc[0]) / 60,
            pre_std=pre.std(), mins_since_prev_meal=(t - prev[-1]).seconds / 60 if len(prev) else 999,
            post_mets=act[t:].mean() if len(act) else np.nan,
            **{f"d{h}": c for h, c in zip(HORIZONS, curve)},
        ))

meals = pd.DataFrame(rows)
keep = ["subject", "Age", "Gender", "BMI", "A1c PDL (Lab)", "Fasting GLU - PDL (Lab)", "Insulin",
        "Triglycerides", "HDL"]
b = bio[keep].rename(columns={"A1c PDL (Lab)": "a1c", "Fasting GLU - PDL (Lab)": "fasting_glu",
                              "Insulin": "insulin", "Age": "age", "BMI": "bmi", "Gender": "sex",
                              "Triglycerides": "tg", "HDL": "hdl"})
meals = meals.merge(b, on="subject", how="left")
meals.to_csv(out, index=False)
print(meals.shape, meals.subject.nunique(), "subjects")
print(meals[["carbs", "d60", "d120"]].describe().round(1))
