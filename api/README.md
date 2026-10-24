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
```

Then `npm run dev` in the repo root; Vite proxies `/api` to port 8000. Interactive docs are at
http://localhost:8000/docs.

**Photo → macros.** With `NAVIGATOR_TOOLKIT_API_KEY` set, photos go to the UF NaviGator AI Toolkit
(OpenAI-compatible, `https://api.ai.it.ufl.edu/v1`) with model `gemma-4-31b-it`. Your key must have that
model enabled. Without NaviGator, `ANTHROPIC_API_KEY` uses Claude instead. With neither, `/api/predict`
answers 503 for photos and the app asks the user for macros; everything else still works.
`GET /api/health` shows which provider is active.

## What the models are

| Piece | Model | Inputs | Subject-held-out accuracy |
|---|---|---|---|
| 2h curve, CGM user ("sensor" tier) | LightGBM per 15-min horizon | meal macros, time, activity, last 6h CGM (stats + encoder embedding), previous 3 days of CGM summary, age/sex/BMI | MAE 18.5 mg/dL, peak error 19.5 |
| 2h curve, labs tier | LightGBM | meal, A1c / fasting glucose, age/sex/BMI, optional finger-stick | MAE 20.8, peak 22.5 |
| 2h curve, basic tier | LightGBM | meal, age/sex/BMI, optional finger-stick | MAE 22.7, peak 24.6 |
| CGM encoder | GlucoFM-style dual-stream (trend + deviation) transformer, masked latent prediction, 170k params | 6h of CGM at 5 min | used inside the sensor tier (19.0 → 18.5) |
| HbA1c | Ridge on 4-day CGM summary | mean, SD, CV, p90, time above 140/180 | MAE 0.42 points |
| Status | Logistic regression, ADA cut-offs 5.7 / 6.5 | same | 58% (3 classes, majority 36%) |

The population-average curve scores 24.2 mg/dL, so a CGM user's recent history is what moves the needle.
Trained on 1,628 to 1,673 meals from 45 adults. More carbs never lowers the predicted curve, and more fiber or
walking never raises it (monotone constraints), so suggestions stay physiologically sane. Walking
shows a small effect in this data (activity is a wrist-tracker average), so the walk suggestion only
appears when the model predicts a real drop.

## Retrain

```bash
curl -O https://physionet-open.s3.amazonaws.com/cgmacros/1.0.0/CGMacros_dateshifted365.zip
unzip CGMacros_dateshifted365.zip -d raw                         # raw/CGMacros
python api/glucosnap_ml/build_meals.py raw/CGMacros meals.csv     # 1,676 meals with 2h curves
python api/glucosnap_ml/train_final.py raw/CGMacros api/models    # ~30 min on 4 CPU cores
REUSE_ENCODER=1 python api/glucosnap_ml/train_final.py raw/CGMacros api/models   # refit only the curve/health models
```

`experiment.py` (encoder vs. plain features) and `experiment2.py` (3-day history) are the comparisons
behind the design; their results are the JSON files next to them. physionet.org may be blocked on some
networks; the S3 mirror above is the same release.

## Data and license

CGMacros v1.0.0 (PhysioNet, released January 2025), CC BY-NC-SA 4.0. The trained files in `models/` are
derived from it, so they are for non-commercial use and carry the same license. Not medical advice.
