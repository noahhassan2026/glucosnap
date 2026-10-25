# GlucoSnap model server

FastAPI server behind the web app. It turns a meal (photo or macros) plus whatever the user has (CGM
readings, labs, or just age/sex/BMI) into a predicted 2-hour glucose curve with an 80% band and ways to
flatten it, and turns 3+ days of CGM into an HbA1c estimate and a diabetes risk band. The contract is
in [../docs/API.md](../docs/API.md).

## Run

```bash
cd api
pip install -r requirements.txt
cp .env.example .env          # put your NaviGator key in .env (it is git-ignored, never commit it)
uvicorn app:app --port 8000 --env-file .env
python smoke_test.py          # end-to-end checks with synthetic CGM, no key needed
python coach_test.py          # AI coach guardrails with a stubbed model
python accounts_test.py       # sign-up, login, data privacy and the leaderboard
```

Then `npm run dev` in the repo root; Vite proxies `/api` to port 8000. Interactive docs are at
http://localhost:8000/docs.

**Photo → macros.** With `NAVIGATOR_TOOLKIT_API_KEY` set, photos go to the UF NaviGator AI Toolkit
(OpenAI-compatible, `https://api.ai.it.ufl.edu/v1`) with model `gemma-4-31b-it`. Your key must have that
model enabled. Without NaviGator, `ANTHROPIC_API_KEY` uses Claude instead. With neither, `/api/predict`
answers 503 for photos and the app asks the user for macros; everything else still works.
`GET /api/health` shows which provider is active.

**Accounts.** `accounts.py` handles sign-up, login, each user's saved app data and the leaderboard. Locally
it saves to `api/data/` (git-ignored); with `AZURE_STORAGE_CONNECTION_STRING` set it uses Azure Blob Storage,
so accounts survive redeploys (setup in [../docs/DEPLOY.md](../docs/DEPLOY.md)).

**AI coach.** The same key powers `/api/quests` (custom anti-spike quests from the user's recent meals and
profile) and `/api/meal-ideas` (cheap, easy home meals). `coach.py` checks every AI answer before the app
sees it: quests that reward eating less, fasting, smaller portions, weight or medication are dropped, XP is set
by category on the server (never by the model), and each meal idea is run through the curve model; ideas
predicted to spike more than every built-in meal of that type, or over budget, are dropped. When the AI is
missing, slow (30 s timeout) or off-script, the built-in library in `coach_library.json` (23 quests,
20 meals) fills in, so both features work without a key.

## What the models are

| Piece | Model | Inputs | Subject-held-out accuracy |
|---|---|---|---|
| 2h curve, CGM user ("sensor" tier) | LightGBM per 15-min horizon | meal macros, time, activity, last 6h CGM (stats + encoder embedding), previous 3 days of CGM summary, age/sex/BMI | MAE 17.8 mg/dL, peak error 19.1 |
| 2h curve, labs tier | LightGBM | meal, A1c / fasting glucose, age/sex/BMI, optional finger-stick | MAE 19.9, peak 21.1 |
| 2h curve, basic tier | LightGBM | meal, age/sex/BMI, optional finger-stick | MAE 21.5, peak 23.2 |
| CGM encoder | GlucoFM-style dual-stream (trend + deviation) transformer, masked latent prediction, 170k params | 6h of CGM at 5 min | used inside the sensor tier (17.9 → 17.8); served as ONNX |
| HbA1c | Ridge on 4-day CGM summary | mean, SD, CV, p90, time above 140/180 | MAE 0.36 points |
| Status | Logistic regression, ADA cut-offs 5.7 / 6.5 | same | 59% (3 classes) |

The server runs the encoder with onnxruntime, so it needs no PyTorch and uses about 300 MB of RAM with
every model loaded. PyTorch is only for training.

Errors are averaged over held-out people from both datasets. Adding BIG IDEAs lowered the error on
held-out CGMacros people too (sensor 18.36 → 18.27, labs 20.85 → 20.68, basic 22.73 → 22.53) and on
held-out BIG IDEAs people, whose Dexcom sensor CGMacros lacks, by about 2 mg/dL (18.7 → 16.6).
The population-average curve scores 24.2 mg/dL on CGMacros, so a CGM user's recent history is what moves the needle.
Trained on 2,130 to 2,213 meals from 59 adults (CGMacros plus BIG IDEAs; 61 people for the health models). More carbs never lowers the predicted curve, and more fiber or
walking never raises it (monotone constraints), so suggestions stay physiologically sane. Walking
shows a small effect in this data (activity is a wrist-tracker average), so the walk suggestion only
appears when the model predicts a real drop.

## Retrain

```bash
curl -O https://physionet-open.s3.amazonaws.com/cgmacros/1.0.0/CGMacros_dateshifted365.zip
unzip CGMacros_dateshifted365.zip -d raw                         # raw/CGMacros
python api/glucosnap_ml/build_meals.py raw/CGMacros meals.csv     # 1,676 meals with 2h curves
pip install -r api/requirements-train.txt                          # adds PyTorch + ONNX export
python api/glucosnap_ml/train_final.py raw/CGMacros api/models    # ~30 min on 4 CPU cores
BIGIDEAS=raw/bigideas python api/glucosnap_ml/train_final.py raw/CGMacros api/models   # what models/ holds: + BIG IDEAs (download in bigideas.py)
REUSE_ENCODER=1 python api/glucosnap_ml/train_final.py raw/CGMacros api/models   # refit only the curve/health models
python api/glucosnap_ml/export_onnx.py api/models                 # encoder.pt -> encoder.onnx for the server
```

`experiment.py` (encoder vs. plain features), `experiment2.py` (3-day history) and `experiment3.py`
(adding BIG IDEAs) are the comparisons behind the design; their results are the JSON files next to them. physionet.org may be blocked on some
networks; the S3 mirror above is the same release.

## Data and license

CGMacros v1.0.0 (PhysioNet, released January 2025), CC BY-NC-SA 4.0, and BIG IDEAs Lab Glycemic Variability
and Wearable Device Data v1.1.2 (PhysioNet), ODC-By 1.0. The trained files in `models/` are derived from
CGMacros, so they are for non-commercial use and carry its license. Not medical advice.
