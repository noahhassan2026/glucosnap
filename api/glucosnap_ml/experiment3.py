"""Does adding the BIG IDEAs dataset (14 more people with usable food logs, Dexcom) make the curve model more accurate?

Same subject-held-out folds for both runs: CGMacros people split into 5 groups, BIG IDEAs people into 5.
Run A trains on CGMacros training people only; run B adds the BIG IDEAs training people. Both are scored
on the held-out people of each dataset. Uses the trained encoder and PCA in models/ (no pre-training).

  python api/glucosnap_ml/experiment3.py raw/CGMacros raw/bigideas api/models     # from the work folder with meals.csv
"""
import json, os, pickle, sys
import numpy as np, pandas as pd, lightgbm as lgb, torch
from sklearn.model_selection import GroupKFold
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import H, load_series, window_before
from model import DualStreamEncoder, embed_np
from features import CURVE_TIERS, pre_meal_stats, history_features
import bigideas

cgm_root, big_root, model_dir = sys.argv[1:4]
P = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=20, subsample=0.8,
         subsample_freq=1, colsample_bytree=0.8, verbose=-1)
MONOTONE = {"carbs": 1, "fiber": -1, "post_mets": -1}

S = load_series(cgm_root)
S.update(bigideas.load_series(big_root))
a = pd.read_csv(os.environ.get("MEALS", "meals.csv"), parse_dates=["time"]); a["src"] = "cgmacros"
b = bigideas.build_meals(big_root, S); b["src"] = "bigideas"
m = pd.concat([a, b], ignore_index=True)
m = m[m.carbs < 300].reset_index(drop=True)
m["sex"] = (m.sex == "M").astype(int)
m["mt"] = m.meal_type.map({"breakfast": 0, "lunch": 1, "dinner": 2}).fillna(3)
wins = [window_before(S[s], t.floor("5min")) for s, t in zip(m.subject, m.time)]
has_w = np.array([w is not None for w in wins])
for k in ("pre_base", "pre_slope", "pre_std"):
    m[k] = [pre_meal_stats(w)[k] if w is not None else np.nan for w in wins]
m = pd.concat([m, pd.DataFrame([history_features(S[s][t - pd.Timedelta(days=3): t].values)
                                for s, t in zip(m.subject, m.time)])], axis=1)
enc = DualStreamEncoder(); enc.load_state_dict(torch.load(os.path.join(model_dir, "encoder.pt"))); enc.eval()
pca = pickle.load(open(os.path.join(model_dir, "pca.pkl"), "rb"))
Z = np.full((len(m), 16), np.nan)
Z[has_w] = pca.transform(embed_np(enc, np.stack([w for w in wins if w is not None])))
Y = m[H].values
print("meals:", m.groupby("src").size().to_dict(), "with 6h window:", m[has_w].groupby("src").size().to_dict(), flush=True)

# fold per person, assigned within each dataset
fold = np.zeros(len(m), int)
for src in ("cgmacros", "bigideas"):
    idx = np.where(m.src == src)[0]
    for k, (_, te) in enumerate(GroupKFold(5).split(idx, groups=m.subject.values[idx])):
        fold[idx[te]] = k


def run(X, names, rows, dup_mask_col=None):
    p = dict(P, monotone_constraints=[MONOTONE.get(n, 0) for n in names], monotone_constraints_method="advanced")
    out = {}
    for arm in ("A_cgmacros_only", "B_plus_bigideas"):
        err = {"cgmacros": [], "bigideas": []}
        for k in range(5):
            tr = rows & (fold != k) & ((m.src == "cgmacros").values if arm.startswith("A") else True)
            te = rows & (fold == k)
            Xtr, Ytr = X[tr], Y[tr]
            if dup_mask_col is not None:          # the pre-meal value is optional for labs/basic: train with and without it
                X2 = Xtr.copy(); X2[:, dup_mask_col] = np.nan
                Xtr, Ytr = np.vstack([Xtr, X2]), np.vstack([Ytr, Ytr])
            pred = np.column_stack([lgb.LGBMRegressor(**p).fit(Xtr, Ytr[:, j]).predict(X[te]) for j in range(len(H))])
            for src in err:
                s = (m.src.values[te] == src)
                err[src].append(np.abs(Y[te][s] - pred[s]))
            if dup_mask_col is not None:          # also score the same people with the pre-meal value hidden
                Xm = X[te].copy(); Xm[:, dup_mask_col] = np.nan
                pred = np.column_stack([lgb.LGBMRegressor(**p).fit(Xtr, Ytr[:, j]).predict(Xm) for j in range(len(H))])
                for src in err:
                    s = (m.src.values[te] == src)
                    err[src].append(np.abs(Y[te][s] - pred[s]))
        out[arm] = {src: round(float(np.concatenate(e).mean()), 2) for src, e in err.items()}
    return out


res = {}
names = CURVE_TIERS["sensor"] + [f"enc_pc{i}" for i in range(16)]
res["sensor"] = run(np.hstack([m[CURVE_TIERS["sensor"]].values.astype(float), Z]), names, has_w)
print("sensor", res["sensor"], flush=True)
for tier in ("labs", "basic"):
    cols = CURVE_TIERS[tier] + ["pre_base"]
    res[tier] = run(m[cols].values.astype(float), cols, np.ones(len(m), bool), dup_mask_col=len(cols) - 1)
    print(tier, res[tier], flush=True)
json.dump(res, open("experiment3_results.json", "w"), indent=1)
