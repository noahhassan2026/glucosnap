# Deploying GlucoSnap

The repo builds into one Docker container: the web app is compiled and served by the FastAPI
model server (`deploy/serve.py`), so the whole app lives at a single URL with no CORS setup.
It needs about 1 GB of memory (PyTorch plus the models), so free tiers capped at 512 MB
(Render free, for example) are too small.

## Settings (environment variables)

| Name | Needed | What it is |
| --- | --- | --- |
| `NAVIGATOR_TOOLKIT_API_KEY` | for photo scanning | UF NaviGator key; uses `gemma-4-31b-it` |
| `NAVIGATOR_BASE_URL` | no | defaults to `https://api.ai.it.ufl.edu/v1` |
| `ANTHROPIC_API_KEY` | no | fallback vision provider when no NaviGator key is set |
| `PORT` | no | set by most hosts; defaults to 7860 |

Without a vision key the app still works: photo scans return 503 and the app asks for macros.
Keys go in the host's secrets settings, never in the repo.

## Option A: Railway (simplest)

1. Sign in at railway.com with GitHub and choose **New project → Deploy from GitHub repo →
   noahhassan2026/glucosnap**. Railway finds the `Dockerfile` and builds it.
2. Open the service's **Variables** tab and add `NAVIGATOR_TOOLKIT_API_KEY`.
3. In **Settings → Networking**, click **Generate domain**. That URL is the live app.
4. Every push to `main` redeploys.

New accounts get trial credit, enough for a hackathon; after that the Hobby plan is about $5/month.

## Option B: Hugging Face Spaces (free, 16 GB)

1. Create a Space at huggingface.co/new-space with SDK **Docker** (blank template).
2. In the Space's **Settings → Variables and secrets**, add `NAVIGATOR_TOOLKIT_API_KEY` as a secret.
3. Push this repo to the Space (use an HF access token with write scope as the password):
   ```bash
   git remote add space https://huggingface.co/spaces/<you>/glucosnap
   git push space main
   ```
   The Space's README needs `sdk: docker` and `app_port: 7860` in its YAML header; if the push is
   rejected for that, add the header to the Space's README in the web editor.

## Running the production build locally

```bash
npm ci && npm run build
pip install -r api/requirements.txt
uvicorn deploy.serve:app --port 8000   # http://localhost:8000
```
