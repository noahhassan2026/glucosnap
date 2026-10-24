"""Feature builders shared by training and the API, so both compute inputs the same way."""
import numpy as np

CURVE_TIERS = {
    # tier name -> tabular features it uses (CGM-derived ones only in "sensor")
    # sensor users: no labs needed; the last 3 days of CGM describe their glucose control better
    "sensor": ["calories", "carbs", "protein", "fat", "fiber", "hour", "mt", "pre_base", "pre_slope", "pre_std",
               "mins_since_prev_meal", "post_mets", "age", "sex", "bmi",
               "h_mean", "h_sd", "h_cv", "h_p90", "h_tab140", "h_tab180", "h_smooth_range"],
    "labs": ["calories", "carbs", "protein", "fat", "fiber", "hour", "mt", "mins_since_prev_meal", "post_mets",
             "age", "sex", "bmi", "a1c", "fasting_glu", "insulin", "tg", "hdl"],
    "basic": ["calories", "carbs", "protein", "fat", "fiber", "hour", "mt", "mins_since_prev_meal", "post_mets",
              "age", "sex", "bmi"],
}
MEAL_TYPES = {"breakfast": 0, "lunch": 1, "dinner": 2}


def pre_meal_stats(window):
    """window: last 6h of CGM at 5-min steps (72 values, oldest first)."""
    last_hour = np.asarray(window[-13:], dtype=float)
    return dict(pre_base=float(last_hour[-1]), pre_slope=float((last_hour[-1] - last_hour[0]) / 60), pre_std=float(last_hour.std(ddof=1)))


def cgm_summary(values):
    """Hand-made glycemic summary of several days of CGM (any resolution)."""
    g = np.asarray(values, dtype=float); g = g[~np.isnan(g)]
    s = np.convolve(g, np.ones(12) / 12, mode="valid") if len(g) > 12 else g
    return dict(mean=g.mean(), sd=g.std(), cv=g.std() / g.mean(), p90=np.quantile(g, .9),
                tab140=(g > 140).mean(), tab180=(g > 180).mean(), smooth_range=s.max() - s.min())


HISTORY_KEYS = ["mean", "sd", "cv", "p90", "tab140", "tab180", "smooth_range"]


def history_features(values_5min):
    """Summary of up to 3 days of CGM before the meal; NaN when under 12 hours are available."""
    g = np.asarray(values_5min, dtype=float); g = g[~np.isnan(g)]
    if len(g) < 144:
        return {f"h_{k}": np.nan for k in HISTORY_KEYS}
    s = cgm_summary(g)
    return {f"h_{k}": float(s[k]) for k in HISTORY_KEYS}
