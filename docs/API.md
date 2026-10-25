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
  "cgm_recent": [{ "t": "2026-10-24T10:00:00Z", "mg_dl": 101 }],                  // optional, up to 3 days ending at the meal, any interval
  "cgm_last_6h": [ ... ],             // optional, older form of cgm_recent; ignored when cgm_recent is sent
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

`mae_mg_dl` is the tier's cross-validated error on people the model never saw (sensor 17.8, labs 19.9,
basic 21.5). `meal` also carries `source` (`"photo"` or `"user"`) and, for photos, `items`
(`[{ name, portion, carbs }]`). `model_version` is the training date, e.g. `"2026-10-24.1"`.

Errors (always JSON `{ "detail": ... }`): `422` bad input, a photo with no food, or CGM covering less than
the 5 hours before the meal; `415` photo is not JPEG/PNG/GIF/WebP; `503` when photo analysis is unavailable
(no `NAVIGATOR_TOOLKIT_API_KEY` or `ANTHROPIC_API_KEY` on the server, key rejected, or the vision model
failed) and no macros were sent. The app then asks the user for macros.

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

`422` when there are fewer than 3 days of data. The estimate uses the most recent 4 days.

## POST /api/quests

Custom anti-spike quests from the AI coach. Works without an AI key (built-in quests, `source: "library"`).

```jsonc
{
  "meals": [{ "label": "Spaghetti and meatballs", "meal_type": "dinner", "carbs": 85, "protein": 34, "fat": 28, "fiber": 7, "peak": 62 }], // newest first, up to 10
  "profile": { ... },                 // optional
  "risk_status": "prediabetes",       // optional, from /api/risk
  "hour": 19.5,
  "count": 3,                         // 1-5
  "have": ["Walk 15 minutes after eating"],  // titles already on today's list (not repeated)
  "exclude": ["lib-walk10"],          // ids shown before, for "new ideas"
  "seed": "2026-10-25"
}
```

Response

```jsonc
{
  "quests": [{ "id": "ai-3f2a9c01de", "title": "Walk 10 minutes after your spaghetti", "why": "...", "category": "move", "xp": 15 }],
  "coach_note": "Your spaghetti dinner was carb-heavy...",
  "source": "ai" | "library",
  "model": "gemma-4-31b-it"           // null for library
}
```

`category` is one of `move order pair swap hydrate sleep stress plan cook`. XP comes from the category
(cook 20; move, order, pair, swap 15; the rest 10), never from the model.

## POST /api/meal-ideas

```jsonc
{ "meal_type": "dinner", "diet": "any" | "vegetarian" | "vegan", "budget": 3, "pantry": "eggs, rice", "count": 3,
  "exclude": ["lentil-soup"], "profile": { ... } }
```

Response

```jsonc
{
  "ideas": [{
    "id": "chickpea-curry", "name": "Chickpea and spinach curry", "why": "...", "cost_usd": 1.3, "minutes": 20,
    "ingredients": ["..."], "steps": ["..."],
    "macros": { "carbs": 50, "protein": 14, "fat": 8, "fiber": 12, "calories": 330 },
    "peak_delta_mg_dl": 21.3, "peak_minute": 60, "tier": "basic" | "labs", "source": "ai" | "library"
  }],
  "source": "ai" | "library", "model": "gemma-4-31b-it", "model_version": "2026-10-24.2"
}
```

Every idea is scored by the curve model (`peak_delta_mg_dl`). AI ideas predicted to spike more than every
built-in meal of the same type are dropped. Once every built-in idea has been excluded, they repeat.

## GET /api/health

```jsonc
{ "ok": true, "model_version": "2026-10-24.1", "vision_provider": "navigator" | "anthropic" | null, "vision_model": "gemma-4-31b-it", "coach_model": "gemma-4-31b-it", "accounts_storage": "BlobStore" | "LocalStore" }
```

`accounts_storage` is `BlobStore` when accounts are saved in Azure Blob Storage (they survive redeploys) and
`LocalStore` when they are in a folder on the container's disk (lost on redeploy).

## Accounts

Server code in `api/accounts.py`. Logged-in calls send `Authorization: Bearer <token>`; tokens last 30 days.
Errors come back as `{ "detail": "message to show" }`.

| Call | Body | Answer |
| --- | --- | --- |
| `POST /api/auth/signup` | `{ "username", "password" }` | `{ "token", "username" }`; 422 for a bad username (3 to 20 of a-z, 0-9, _) or a password under 6 characters, 409 if taken |
| `POST /api/auth/login` | `{ "username", "password" }` | `{ "token", "username" }`; 401 wrong details, 429 after 10 misses in 10 minutes |
| `GET /api/me` | | `{ "username", "data": { ... }, "updated": ms }` |
| `PUT /api/me/data` | `{ "data": { "glucosnap-quest": ..., ... } }` | `{ "ok": true, "updated": ms }`; 413 over 2 MB |
| `DELETE /api/me` | | `{ "ok": true }`; the account and its data are gone |
| `GET /api/leaderboard` | token optional | `{ "players": [{ "name", "level", "streak", "evo", "path": { "element", "form" }, "me" }] }` |

`data` is the app's saved localStorage keys (profile, CGM, meal history, quest and pet state, coach quests,
reminders), stored as sent and only ever returned to its owner. Passwords are stored as scrypt hashes. The
leaderboard is built from the quest state's name, level, streak and pet only.
