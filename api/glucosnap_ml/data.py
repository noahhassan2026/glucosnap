"""Shared data loading: 5-minute CGM series per subject, meal table, lab table."""
import glob, os
import numpy as np, pandas as pd

STEP = 5            # minutes per CGM sample
WIN = 72            # 6 hours of history per window
H = [f"d{h}" for h in range(15, 121, 15)]


def load_series(root):
    """subject -> pd.Series of Libre glucose on a 5-minute grid (NaN where missing)."""
    out = {}
    for f in sorted(glob.glob(os.path.join(root, "CGMacros-*", "CGMacros-*.csv"))):
        sid = int(os.path.basename(f)[9:12])
        d = pd.read_csv(f, usecols=["Timestamp", "Libre GL"])
        d["Timestamp"] = pd.to_datetime(d["Timestamp"])
        g = d.set_index("Timestamp")["Libre GL"].sort_index()
        g = g[~g.index.duplicated()].resample(f"{STEP}min").mean().interpolate(limit=6)
        out[sid] = g
    return out


def window_before(g, t, n=WIN):
    """n samples ending at time t (inclusive); None if too much is missing."""
    w = g[t - pd.Timedelta(minutes=STEP * (n - 1)): t]
    if len(w) < n or w.isna().mean() > 0.1:
        return None
    return w.interpolate().bfill().ffill().values[-n:].astype(np.float32)


def all_windows(series, subjects, stride=6):
    """Unlabelled 6h windows for self-supervised pre-training."""
    xs = []
    for s in subjects:
        v = series[s].values
        for i in range(0, len(v) - WIN, stride):
            w = v[i:i + WIN]
            if np.isnan(w).mean() > 0.1:
                continue
            w = pd.Series(w).interpolate().bfill().ffill().values
            xs.append(w.astype(np.float32))
    return np.stack(xs)


def load_bio(root):
    bio = pd.read_csv(os.path.join(root, "bio.csv"))
    bio.columns = [c.strip() for c in bio.columns]
    bio = bio.loc[:, ~bio.columns.duplicated()].set_index("subject")
    return bio
