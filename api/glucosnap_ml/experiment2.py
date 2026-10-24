"""Does a sensor user's recent history (previous 3 days of CGM) help predict a new meal's curve?
Compares hand-made glycemic summaries with GlucoFM-style encoder embeddings of that history.
Subject-held-out 5-fold; encoder pre-trained only on training subjects each fold."""
import os, sys, pickle, json, numpy as np, pandas as pd, lightgbm as lgb
from sklearn.model_selection import GroupKFold
from sklearn.decomposition import PCA
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import load_series, H, WIN, STEP, all_windows
from model import pretrain, embed_np
from features import cgm_summary

EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
S = load_series(os.environ.get("CGMACROS", "raw/CGMacros"))   # run from the work folder that holds meals.csv
m = pd.read_csv("meals.csv", parse_dates=["time"])
m = m[m.carbs < 300].reset_index(drop=True)
m["sex"] = (m.sex == "M").astype(int)
m["mt"] = m.meal_type.map({"breakfast": 0, "lunch": 1, "dinner": 2}).fillna(3)

# history windows per subject: 6h windows ending every 30 minutes
hist = {}
for s, g in S.items():
    v = g.values; ends = g.index
    idx = [i for i in range(WIN, len(v), 6) if np.isnan(v[i - WIN:i]).mean() <= 0.1]
    w = np.stack([pd.Series(v[i - WIN:i]).interpolate().bfill().ffill().values for i in idx]).astype(np.float32)
    hist[s] = (w, ends[[i - 1 for i in idx]])

def history_rows(s, t, days=3):
    w, ends = hist[s]
    sel = (ends <= t) & (ends > t - pd.Timedelta(days=days))
    return np.where(sel)[0]

sel_idx = [history_rows(s, t) for s, t in zip(m.subject, m.time)]
nhist = np.array([len(i) for i in sel_idx])
print("meals:", len(m), "with >=24 history windows (>=12h):", (nhist >= 24).sum(), flush=True)

SUMK = ["mean", "sd", "cv", "p90", "tab140", "tab180", "smooth_range"]
def summ(s, t):
    g = S[s][t - pd.Timedelta(days=3): t].values
    g = g[~np.isnan(g)]
    return [np.nan] * len(SUMK) if len(g) < 144 else [cgm_summary(g)[k] for k in SUMK]
HS = np.array([summ(s, t) for s, t in zip(m.subject, m.time)])

F = ["calories", "carbs", "protein", "fat", "fiber", "hour", "mt", "pre_base", "pre_slope", "pre_std",
     "mins_since_prev_meal", "post_mets", "age", "sex", "bmi", "a1c", "fasting_glu", "insulin", "tg", "hdl"]
F_nolab = [f for f in F if f not in ("a1c", "fasting_glu", "insulin", "tg", "hdl")]
X, Xn, Y, grp = m[F].values, m[F_nolab].values, m[H].values, m.subject.values
P = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=20, subsample=0.8,
         subsample_freq=1, colsample_bytree=0.8, verbose=-1)
fit = lambda A, tr, te: np.column_stack([lgb.LGBMRegressor(**P).fit(A[tr], Y[tr, j]).predict(A[te]) for j in range(len(H))])

names = ["baseline", "+history_summary", "+history_encoder", "+both",
         "nolabs_baseline", "nolabs+history_summary", "nolabs+history_encoder", "nolabs+both"]
res = {k: np.zeros_like(Y) for k in names}
for k, (tr, te) in enumerate(GroupKFold(5).split(X, Y, grp)):
    print(f"fold {k + 1}/5", flush=True)
    trs = sorted(set(grp[tr]))
    enc = pretrain(all_windows(S, trs), epochs=EPOCHS, seed=k, log=lambda *a: None)
    emb = {s: embed_np(enc, hist[s][0]) for s in S}
    HE = np.array([emb[s][i].mean(0) if len(i) >= 24 else np.full(emb[s].shape[1], np.nan)
                   for s, i in zip(m.subject, sel_idx)])
    ok = ~np.isnan(HE[tr]).any(1)
    pca = PCA(8, random_state=0).fit(HE[tr][ok])
    Z = np.full((len(m), 8), np.nan)
    good = ~np.isnan(HE).any(1)
    Z[good] = pca.transform(HE[good])
    for base, pre in [(X, ""), (Xn, "nolabs")]:
        p = pre + ("_" if pre else "")
        res[(pre + "_baseline") if pre else "baseline"][te] = fit(base, tr, te)
        res[f"{pre}+history_summary"][te] = fit(np.hstack([base, HS]), tr, te)
        res[f"{pre}+history_encoder"][te] = fit(np.hstack([base, Z]), tr, te)
        res[f"{pre}+both"][te] = fit(np.hstack([base, HS, Z]), tr, te)
    print("   " + " | ".join(f"{n} {np.abs(res[n][te] - Y[te]).mean():.1f}" for n in names), flush=True)

out = {}
mask = nhist >= 24
for n in names:
    out[n] = dict(mae_all=float(np.abs(res[n] - Y).mean()), mae_with_history=float(np.abs(res[n][mask] - Y[mask]).mean()),
                  r=float(np.corrcoef(res[n].mean(1), Y.mean(1))[0, 1]))
    print(f"{n:26s} MAE all {out[n]['mae_all']:5.2f} | with >=12h history {out[n]['mae_with_history']:5.2f} | r {out[n]['r']:.2f}")
json.dump(out, open("experiment2_results.json", "w"), indent=1)
