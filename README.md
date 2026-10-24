# GlucoSnap

Snap a photo of a meal and see your predicted 2-hour glucose curve, ways to flatten it, and a health
snapshot (estimated HbA1c and diabetes risk band) from a few days of CGM data. Built for GatorHack
"Fresh off the frontier", based on Google's GlucoFM (2026), the TU Munich meal-photo glucose paper
(2026) and the open CGMacros and BIG IDEAs datasets.

**GlucoSnap Quest** turns healthy habits into a game: a character you style (skin, hair, colors), a pet
that evolves (Egg → Hatchling → Sprite → Guardian → Legendary) with level and streak, streak XP
multipliers (×1.25 at 3 days, ×1.5 at 7, ×2 at 14), streak shields, a daily XP cap, and a leaderboard
with no health data. Quests also pay tokens for an item shop (hats, glasses, outfits, capes, shoes, and
pet hats, collars and auras). At Sprite the pet takes an element (Leaf, Ember, Tide) and at Guardian a
form (Wings, Horns), giving six different Legendaries. XP and tokens never reward eating less.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # quest rule tests
npm run build
```

The app calls the model server at `/api` (proxied to `localhost:8000` in dev, or set `VITE_API_URL`).
With no server running it falls back to a built-in demo model, so the UI always works. Set
`VITE_USE_MOCK=1` to force the demo model. The API contract is in [docs/API.md](docs/API.md); deployment steps are in [docs/DEPLOY.md](docs/DEPLOY.md).

The model server lives in [api/](api/README.md): `cd api && pip install -r requirements.txt && uvicorn app:app --port 8000 --env-file .env`.

## Layout

- `src/api/`: API types, client with demo fallback, mock model
- `src/game/`: Quest rules, shop catalog and pet evolution tree (pure functions + tests), and the React hook that persists them
- `src/components/`: Snap, Health, Quest and Shop screens, evolution choice, glucose chart, character and pet art
- `api/`: FastAPI model server, trained models, and the training code (`api/glucosnap_ml/`)

Not medical advice. Prediction errors are typically 15 to 24 mg/dL.
