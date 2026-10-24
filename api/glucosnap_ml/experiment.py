"""Subject-held-out comparison: LightGBM baseline vs. GlucoFM-style encoder variants.

For each of 5 folds the encoder is pre-trained only on the training subjects' CGM, so
test subjects' glucose never leaks into pre-training.
"""
import os, sys, pickle, json, numpy as np, pandas as pd, torch, torch.nn as nn, lightgbm as lgb
from sklearn.model_selection import GroupKFold
from sklearn.decomposition import PCA
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import load_series, H, window_before, all_windows
from model import pretrain, embed_np

EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
S = load_series(os.environ.get("CGMACROS", "raw/CGMacros"))   # run from the work folder that holds meals.csv
m = pd.read_csv("meals.csv", parse_dates=["time"])
m = m[m.carbs < 300].reset_index(drop=True)
m["sex"] = (m.sex == "M").astype(int)
m["mt"] = m.meal_type.map({"breakfast": 0, "lunch": 1, "dinner": 2}).fillna(3)
wins = [window_before(S[s], t.floor("5min")) for s, t in zip(m.subject, m.time)]
keep = np.array([w is not None for w in wins])
m = m[keep].reset_index(drop=True)
W = np.stack([w for w in wins if w is not None])
print("meals with 6h history:", len(m), flush=True)

F = ["calories", "carbs", "protein", "fat", "fiber", "hour", "mt", "pre_base", "pre_slope", "pre_std",
     "mins_since_prev_meal", "post_mets", "age", "sex", "bmi", "a1c", "fasting_glu", "insulin", "tg", "hdl"]
X, Y, g = m[F].values.astype(np.float32), m[H].values.astype(np.float32), m.subject.values
P = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=20, subsample=0.8,
         subsample_freq=1, colsample_bytree=0.8, verbose=-1)


def lgb_fit_predict(Xtr, Ytr, Xte):
    return np.column_stack([lgb.LGBMRegressor(**P).fit(Xtr, Ytr[:, j]).predict(Xte) for j in range(Y.shape[1])])


class Head(nn.Module):
    def __init__(self, n_in):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(n_in, 128), nn.GELU(), nn.Dropout(0.2), nn.Linear(128, 64), nn.GELU(), nn.Linear(64, len(H)))
    def forward(self, x): return self.net(x)


def mlp_fit_predict(Xtr, Ytr, Xte, seeds=5):
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-6
    a, b = torch.tensor((Xtr - mu) / sd), torch.tensor(Ytr / 30)
    c = torch.tensor((Xte - mu) / sd)
    preds = []
    for seed in range(seeds):
        torch.manual_seed(seed)
        net = Head(a.shape[1]); opt = torch.optim.AdamW(net.parameters(), 1e-3, weight_decay=1e-2)
        for ep in range(150):
            net.train(); perm = torch.randperm(len(a))
            for i in range(0, len(a), 64):
                idx = perm[i:i + 64]
                l = nn.functional.smooth_l1_loss(net(a[idx]), b[idx]); opt.zero_grad(); l.backward(); opt.step()
        net.eval()
        with torch.no_grad(): preds.append(net(c).numpy() * 30)
    return np.mean(preds, 0)


res = {k: np.zeros_like(Y) for k in ["mean_curve", "lgbm_baseline", "lgbm_plus_encoder", "mlp_encoder", "blend"]}
for k, (tr, te) in enumerate(GroupKFold(5).split(X, Y, g)):
    print(f"fold {k + 1}/5", flush=True)
    enc = pretrain(all_windows(S, sorted(set(g[tr]))), epochs=EPOCHS, seed=k)
    E = embed_np(enc, W)
    pca = PCA(16, random_state=0).fit(E[tr])
    Z = pca.transform(E)
    res["mean_curve"][te] = Y[tr].mean(0)
    res["lgbm_baseline"][te] = lgb_fit_predict(X[tr], Y[tr], X[te])
    XZ = np.hstack([X, Z])
    res["lgbm_plus_encoder"][te] = lgb_fit_predict(XZ[tr], Y[tr], XZ[te])
    XE = np.hstack([np.nan_to_num(X, nan=0), E])
    res["mlp_encoder"][te] = mlp_fit_predict(XE[tr], Y[tr], XE[te])
    res["blend"][te] = (res["lgbm_plus_encoder"][te] + res["mlp_encoder"][te]) / 2
    for name, Pr in res.items():
        e = np.abs(Pr[te] - Y[te]).mean()
        print(f"   {name:20s} fold MAE {e:5.1f}", flush=True)

out = {}
for name, Pr in res.items():
    out[name] = dict(mae=float(np.abs(Pr - Y).mean()),
                     peak_mae=float(np.abs(Pr.max(1) - Y.max(1)).mean()),
                     r=float(np.corrcoef(Pr.mean(1), Y.mean(1))[0, 1]))
    print(f"{name:20s} MAE {out[name]['mae']:5.1f} | peak {out[name]['peak_mae']:5.1f} | r {out[name]['r']:.2f}")
json.dump(dict(n_meals=len(m), epochs=EPOCHS, results=out), open("experiment_results.json", "w"), indent=1)
