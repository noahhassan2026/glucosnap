# GlucoSnap model API

The web app talks to the model server (FastAPI, `api/`) with two endpoints. Base URL is `VITE_API_URL`
(empty = same origin; the Vite dev server proxies `/api` to `http://localhost:8000`). If the server is
unreachable the app falls back to a built-in mock with the same shape (`src/api/mock.ts`) and shows a
"Demo model" badge.

## POST /api/predict

`multipart/form-data`

- `photo`: image file. Optional when `context.macros` is given.
- `context`: JSON string

```jsonc
{
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "hour": 12.5,                       // local time of the meal
  "pre_glucose_mg_dl": 98,            // optional
  "profile": { "age": 30, "sex": "F", "bmi": 24, "a1c": 5.4, "fasting_glu": 90 }, // optional, all fields optional
  "macros": { "carbs": 60, "protein": 20, "fat": 15, "fiber": 5, "calories": 455 }, // optional, overrides the photo estimate
  "cgm_last_6h": [{ "t": "2026-10-24T10:00:00Z", "mg_dl": 101 }],                 // optional
  "walk_after_meal_min": 15           // optional, default 0
}
```

Response

```jsonc
{
  "meal": { "label": "Chicken burrito bowl", "calories": 720, "carbs": 82, "protein": 38, "fat": 24, "fiber": 9, "confidence": 0.8 },
  "curve": {
    "minutes": [0, 15, 30, 45, 60, 75, 90, 105, 120],
    "delta_mg_dl": [0, ...],           // 9 values, rise above pre-meal level
    "delta_low": [0, ...],             // 80% band
    "delta_high": [0, ...],
    "baseline_mg_dl": 98,              // null when no pre-meal glucose or CGM was sent
    "peak_delta_mg_dl": 58,
    "peak_minute": 60,
    "mae_mg_dl": 20.1,
    "tier": "sensor" | "labs" | "basic"
  },
  "suggestions": [
    { "id": "walk15", "kind": "walk" | "swap" | "add_protein", "text": "Walk 15 minutes after eating",
      "peak_delta_mg_dl": 44, "peak_reduction_pct": 24 }
  ],
  "model_version": "lgbm-0.1"
}
```

Errors: `422` bad input; `503` when photo analysis is unavailable (no `ANTHROPIC_API_KEY` on the server)
and no macros were sent. The app then asks the user for macros.

## POST /api/risk

```jsonc
{ "cgm": [{ "t": "ISO timestamp", "mg_dl": 104 }], "profile": { ... } } // profile optional
```

Response

```jsonc
{
  "a1c_estimate": 5.6, "a1c_mae": 0.43,
  "status": "normal" | "prediabetes" | "t2d",
  "status_probs": { "normal": 0.7, "prediabetes": 0.25, "t2d": 0.05 },
  "homa_ir_estimate": 1.9,             // optional, may be omitted
  "days_of_data": 4.0
}
```

`422` when there are fewer than 3 days of data.
