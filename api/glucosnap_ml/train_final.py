"""Train the production models on all of CGMacros and write them to models/.

  python api/glucosnap_ml/train_final.py raw/CGMacros api/models
  BIGIDEAS=raw/bigideas python api/glucosnap_ml/train_final.py raw/CGMacros api/models   # + BIG IDEAs (bigideas.py)

Outputs: encoder.pt, pca.pkl, curve_models.pkl (one bundle per tier), health_models.pkl, meta.json
"""
import json, os, pickle, sys, time
import numpy as np, pandas as pd, lightgbm as lgb, torch
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression, RidgeCV
from sklearn.model_selection import GroupKFold, LeaveOneOut, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import H, load_series, window_before, all_windows, load_bio
from model import pretrain, embed_np
from features import CURVE_TIERS, pre_meal_stats, cgm_summary, history_features

root, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
EPOCHS = int(os.environ.get("EPOCHS", 25))
HORIZONS = list(range(15, 121, 15))
P = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=20, subsample=0.8,
         subsample_freq=1, colsample_bytree=0.8, verbose=-1)

S = load_series(root)
bio = load_bio(root)
BIG = os.environ.get("BIGIDEAS")
if BIG:
    import bigideas
    S.update(bigideas.load_series(BIG))

# ---- 1. encoder ------------------------------------------------------------------------
t0 = time.time()
if os.environ.get("REUSE_ENCODER") and os.path.exists(os.path.join(out, "encoder.pt")):
    from model import DualStreamEncoder
    enc = DualStreamEncoder(); enc.load_state_dict(torch.load(os.path.join(out, "encoder.pt"))); enc.eval()
    print("reusing encoder.pt", flush=True)
else:
    enc = pretrain(all_windows(S, sorted(S)), epochs=EPOCHS, seed=0)
    torch.save(enc.state_dict(), os.path.join(out, "encoder.pt"))
    print(f"encoder pre-trained in {time.time() - t0:.0f}s", flush=True)

# ---- 2. meal table with 5-minute pre-meal windows (same inputs the API receives) ---------
m = pd.read_csv(os.environ.get("MEALS", "meals.csv"), parse_dates=["time"])   # from build_meals.py
if BIG:
    m = pd.concat([m, bigideas.build_meals(BIG, S)], ignore_index=True)
m = m[m.carbs < 300].reset_index(drop=True)
m["sex"] = (m.sex == "M").astype(int)
m["mt"] = m.meal_type.map({"breakfast": 0, "lunch": 1, "dinner": 2}).fillna(3)
wins = [window_before(S[s], t.floor("5min")) for s, t in zip(m.subject, m.time)]
has_w = np.array([w is not None for w in wins])
for k in ("pre_base", "pre_slope", "pre_std"):
    m[k] = [pre_meal_stats(w)[k] if w is not None else np.nan for w in wins]
hist = pd.DataFrame([history_features(S[s][t - pd.Timedelta(days=3): t].values) for s, t in zip(m.subject, m.time)])
m = pd.concat([m, hist], axis=1)
Y = m[H].values
g = m.subject.values
E = np.full((len(m), 256), np.nan, dtype=np.float32)
E[has_w] = embed_np(enc, np.stack([w for w in wins if w is not None]))
pca = PCA(16, random_state=0).fit(E[has_w])
Z = np.full((len(m), 16), np.nan); Z[has_w] = pca.transform(E[has_w])
pickle.dump(pca, open(os.path.join(out, "pca.pkl"), "wb"))


# Physiology the suggestions rely on, enforced so that small-data noise cannot flip it:
# more carbs never lowers the curve, more fiber or more activity after the meal never raises it.
MONOTONE = {"carbs": 1, "fiber": -1, "post_mets": -1}


def fit_bundle(X, Y, groups, rows_mask, names):
    X, Y, groups = X[rows_mask], Y[rows_mask], groups[rows_mask]
    p = dict(P, monotone_constraints=[MONOTONE.get(n, 0) for n in names], monotone_constraints_method="advanced")
    oof = np.zeros_like(Y)
    for tr, te in GroupKFold(5).split(X, Y, groups):
        for j in range(Y.shape[1]):
            oof[te, j] = lgb.LGBMRegressor(**p).fit(X[tr], Y[tr, j]).predict(X[te])
    res = Y - oof
    models = [lgb.LGBMRegressor(**p).fit(X, Y[:, j]) for j in range(Y.shape[1])]
    return dict(models=models,
                band_low=np.quantile(res, 0.1, axis=0).round(1).tolist(),
                band_high=np.quantile(res, 0.9, axis=0).round(1).tolist(),
                cv_mae=round(float(np.abs(res).mean()), 1),
                cv_peak_mae=round(float(np.abs(Y.max(1) - oof.max(1)).mean()), 1),
                n_meals=int(len(Y)))


curves = {}
# sensor tier: with vs. without the encoder's view of the last 6 hours; keep whichever cross-validates better
plain = m[CURVE_TIERS["sensor"]].values.astype(float)
PCS = [f"enc_pc{i}" for i in range(16)]
a = fit_bundle(plain, Y, g, has_w, CURVE_TIERS["sensor"])
b = fit_bundle(np.hstack([plain, Z]), Y, g, has_w, CURVE_TIERS["sensor"] + PCS)
print(f"sensor tier CV MAE: history only {a['cv_mae']}, history + encoder {b['cv_mae']}", flush=True)
USE_ENC = b["cv_mae"] < a["cv_mae"]
curves["sensor"] = b if USE_ENC else a
curves["sensor"]["features"] = CURVE_TIERS["sensor"] + (PCS if USE_ENC else [])
# labs/basic: the user may or may not type a pre-meal finger-stick value, so train on both versions
for tier in ("labs", "basic"):
    cols = CURVE_TIERS[tier] + ["pre_base"]
    X1 = m[cols].values.astype(float)
    X2 = X1.copy(); X2[:, -1] = np.nan
    b = fit_bundle(np.vstack([X1, X2]), np.vstack([Y, Y]), np.concatenate([g, g]), np.ones(2 * len(m), bool), cols)
    b["features"] = cols
    curves[tier] = b
for k, b in curves.items():
    print(f"curve tier {k:6s}: CV MAE {b['cv_mae']} mg/dL, peak MAE {b['cv_peak_mae']}, meals {b['n_meals']}", flush=True)
pickle.dump(curves, open(os.path.join(out, "curve_models.pkl"), "wb"))

# ---- 3. health profile from the first 4 days of CGM ------------------------------------
SUMK = ["mean", "sd", "cv", "p90", "tab140", "tab180", "smooth_range"]
rows = {}
for s, ser in S.items():
    v = ser.dropna().values[: 12 * 24 * 4]
    rows[s] = cgm_summary(v)
a1c_lab = bio["A1c PDL (Lab)"]
if BIG:
    demo = pd.read_csv(os.path.join(BIG, "Demographics.csv"), encoding="utf-8-sig")
    a1c_lab = pd.concat([a1c_lab, pd.Series(demo.HbA1c.values, index=demo.ID.values + bigideas.OFFSET)])
D = pd.DataFrame(rows).T.join(a1c_lab.rename("A1c PDL (Lab)")).dropna()
Xh, a1c = D[SUMK].values, D["A1c PDL (Lab)"].values
status = np.digitize(a1c, [5.7, 6.5])         # 0 normal, 1 prediabetes, 2 type 2 range (ADA cut-offs)
a1c_model = make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 20)))
stat_model = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=5000))
pa = cross_val_predict(a1c_model, Xh, a1c, cv=LeaveOneOut())
ps = cross_val_predict(stat_model, Xh, status, cv=LeaveOneOut())
health = dict(features=SUMK, a1c=a1c_model.fit(Xh, a1c), status=stat_model.fit(Xh, status),
              a1c_cv_mae=round(float(np.abs(pa - a1c).mean()), 2), status_cv_acc=round(float((ps == status).mean()), 2),
              n_people=int(len(D)))
print(f"health: HbA1c CV MAE {health['a1c_cv_mae']}, status accuracy {health['status_cv_acc']} (n={len(D)})", flush=True)
pickle.dump(health, open(os.path.join(out, "health_models.pkl"), "wb"))

json.dump(dict(version=os.environ.get("VERSION", "2026-10-24.2"), horizons=HORIZONS, use_encoder=bool(USE_ENC), encoder_epochs=EPOCHS,
               curve={k: {kk: v for kk, v in b.items() if kk != "models"} for k, b in curves.items()},
               health={k: v for k, v in health.items() if k not in ("a1c", "status")},
               data="CGMacros v1.0.0 (PhysioNet, CC BY-NC-SA 4.0), 45 adults"
                    + (" + BIG IDEAs v1.1.2 (PhysioNet, ODC-By 1.0), 16 adults" if BIG else "")),
          open(os.path.join(out, "meta.json"), "w"), indent=1)
print("saved to", out)
