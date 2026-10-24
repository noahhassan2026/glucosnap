"""BIG IDEAs Lab Glycemic Variability and Wearable Device Data (PhysioNet v1.1.2, ODC-By 1.0).

16 adults with HbA1c 5.3 to 6.4 (normal to prediabetes), Dexcom G6 CGM at 5-minute steps for about
10 days, and a food log with calories and macros per item. Download (no signup):

  B=https://physionet-open.s3.amazonaws.com/big-ideas-glycemic-wearable/1.1.2
  for i in $(seq -f %03g 1 16); do mkdir -p raw/bigideas/$i
    for f in Dexcom Food_Log; do curl -s -o raw/bigideas/$i/${f}_$i.csv $B/$i/${f}_$i.csv; done; done
  curl -s -o raw/bigideas/Demographics.csv $B/Demographics.csv

Subjects get ids 1001 to 1016 so they never collide with CGMacros ids.
"""
import os
import numpy as np, pandas as pd
from data import STEP

OFFSET = 1000
# Food logs of 7, 13, 15 and 16 carry dates months away from their CGM. For 7 and 13, shifting the log so
# its first day is the CGM's first day lines meals up with clear glucose rises (45-min rise after 30 g+
# carb meals: 33 and 24 mg/dL, against about 0 one day either way); for 15 and 16 no shift does, so they
# are left out.
SHIFT_DAYS = {7: 150, 13: 150}
HORIZONS = list(range(15, 121, 15))


def load_series(root):
    out = {}
    for i in range(1, 17):
        d = pd.read_csv(os.path.join(root, f"{i:03d}", f"Dexcom_{i:03d}.csv"))
        d = d[d["Event Type"] == "EGV"]
        t = pd.to_datetime(d["Timestamp (YYYY-MM-DDThh:mm:ss)"])
        # Dexcom reports out-of-range readings as text ("Low" / "High"); 40 and 400 are its limits
        v = pd.to_numeric(d["Glucose Value (mg/dL)"].replace({"Low": 40, "High": 400}), errors="coerce")
        g = pd.Series(v.values, index=t).sort_index()
        g = g[~g.index.duplicated()].resample(f"{STEP}min").mean().interpolate(limit=6)
        out[OFFSET + i] = g
    return out


def meal_type(hour):
    return "breakfast" if 5 <= hour < 11 else "lunch" if 11 <= hour < 16 else "dinner" if 16 <= hour < 22 else "snack"


def build_meals(root, series):
    """One row per eating occasion (items logged within 30 minutes merged), with the 2h glucose rise."""
    demo = pd.read_csv(os.path.join(root, "Demographics.csv"), encoding="utf-8-sig").set_index("ID")
    rows = []
    for i in range(1, 17):
        sid, g = OFFSET + i, series[OFFSET + i]
        path = os.path.join(root, f"{i:03d}", f"Food_Log_{i:03d}.csv")
        f = pd.read_csv(path, encoding="utf-8-sig")
        if "time_begin" not in f.columns:     # subject 003's log has no header and no fat or fiber columns
            f = pd.read_csv(path, header=None, names=["date", "time", "time_begin", "logged_food", "amount", "unit",
                                                      "searched_food", "calorie", "total_carb", "sugar", "protein"])
        for c in ("calorie", "total_carb", "dietary_fiber", "protein", "total_fat"):
            f[c] = pd.to_numeric(f[c], errors="coerce") if c in f else np.nan
        f["t"] = pd.to_datetime(f["time_begin"], errors="coerce", format="mixed")
        f["t"] = f.t + pd.Timedelta(days=SHIFT_DAYS.get(i, 0))
        f = f.dropna(subset=["t"]).sort_values("t")
        occasion = (f.t.diff() > pd.Timedelta(minutes=30)).cumsum()
        for _, items in f.groupby(occasion):
            t = items.t.iloc[0]
            mac = {k: items[c].sum(min_count=1) for k, c in (("calories", "calorie"), ("carbs", "total_carb"),
                   ("protein", "protein"), ("fat", "total_fat"), ("fiber", "dietary_fiber"))}
            if pd.isna(mac["carbs"]) or pd.isna(mac["calories"]) or mac["calories"] < 30:
                continue
            tg = t.floor(f"{STEP}min")
            base = g.get(tg, np.nan)
            curve = [g.get(tg + pd.Timedelta(minutes=h), np.nan) - base for h in HORIZONS]
            if np.isnan(base) or np.isnan(curve).any():
                continue
            hour = t.hour + t.minute / 60
            rows.append(dict(subject=sid, time=t, meal_type=meal_type(hour), photo=None, **mac, hour=hour,
                             mins_since_prev_meal=999, post_mets=np.nan,
                             **{f"d{h}": c for h, c in zip(HORIZONS, curve)},
                             age=np.nan, sex="M" if demo.loc[i, "Gender"] == "MALE" else "F", bmi=np.nan,
                             a1c=demo.loc[i, "HbA1c"], fasting_glu=np.nan, insulin=np.nan, tg=np.nan, hdl=np.nan))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    import sys
    S = load_series(sys.argv[1])
    m = build_meals(sys.argv[1], S)
    print(m.shape, m.subject.nunique(), "subjects")
    print(m[["calories", "carbs", "protein", "fat", "fiber", "d30", "d60", "d120"]].describe().round(1))
