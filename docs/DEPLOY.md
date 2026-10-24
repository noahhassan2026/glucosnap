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

A GitHub Action (`.github/workflows/deploy-hf.yml`) uploads `main` to the Space on every push and
adds the Space settings (`sdk: docker`, `app_port: 7860`) to the Space's README.

1. Create a Space at huggingface.co/new-space: SDK **Docker**, template **Blank**, hardware
   **CPU basic (free)**, visibility **Public** (so judges can open it without logging in).
2. In the Space, open **Settings → Variables and secrets → New secret**: name
   `NAVIGATOR_TOOLKIT_API_KEY`, value your key.
3. Create a token at huggingface.co/settings/tokens: type **Write**.
4. In GitHub, open the repo's **Settings → Secrets and variables → Actions**:
   - **Secrets** tab → **New repository secret**: `HF_TOKEN` = the token.
   - **Variables** tab → **New repository variable**: `HF_SPACE` = `<your-username>/<space-name>`.
5. Run the workflow: **Actions → Deploy to Hugging Face → Run workflow** (later pushes to `main`
   deploy on their own). The Space then builds for a few minutes; its **Logs** tab shows progress.
6. The app is at `https://<your-username>-<space-name>.hf.space`.

Free Spaces sleep after about 48 hours without visitors and wake on the next visit (about a minute).

## Running the production build locally

```bash
npm ci && npm run build
pip install -r api/requirements.txt
uvicorn deploy.serve:app --port 8000   # http://localhost:8000
```
