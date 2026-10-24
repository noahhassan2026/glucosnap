# Deploying GlucoSnap

The repo builds into one Docker container: the web app is compiled and served by the FastAPI
model server (`deploy/serve.py`), so the whole app lives at a single URL with no CORS setup.
It uses about 300 MB of memory, so it fits free tiers with 512 MB.

## Settings (environment variables)

| Name | Needed | What it is |
| --- | --- | --- |
| `NAVIGATOR_TOOLKIT_API_KEY` | for photo scanning | UF NaviGator key; uses `gemma-4-31b-it` |
| `NAVIGATOR_BASE_URL` | no | defaults to `https://api.ai.it.ufl.edu/v1` |
| `ANTHROPIC_API_KEY` | no | fallback vision provider when no NaviGator key is set |
| `PORT` | no | set by most hosts; defaults to 7860 |

Without a vision key the app still works: photo scans return 503 and the app asks for macros.
Keys go in the host's secrets settings, never in the repo.

## Azure Container Apps

Everything runs from Azure Cloud Shell (portal.azure.com → `>_` → Bash), so nothing needs installing.
`az containerapp up --source .` builds the Dockerfile in Azure and creates the app, a Container Apps
environment and a small container registry (Basic, about $5/month, covered by Azure for Students
credit). The app scales to zero when idle; the first visit after that takes a little while.

```bash
az extension add --name containerapp --upgrade -y
az provider register -n Microsoft.App --wait
az provider register -n Microsoft.OperationalInsights --wait
git clone https://github.com/noahhassan2026/glucosnap && cd glucosnap
az containerapp up -n glucosnap -g glucosnap-rg -l eastus --source . --ingress external --target-port 7860

read -s KEY   # paste the NaviGator key; it is not echoed
az containerapp secret set -n glucosnap -g glucosnap-rg --secrets navigator-key="$KEY"
az containerapp update -n glucosnap -g glucosnap-rg --set-env-vars NAVIGATOR_TOOLKIT_API_KEY=secretref:navigator-key
```

To ship a new version of `main`: `cd glucosnap && git pull && az containerapp up -n glucosnap -g glucosnap-rg --source .`

## Render (free)

`render.yaml` describes the service, so Render sets it up from the repo.

1. Sign up at render.com with GitHub and stay on the free plan.
2. Click **New → Blueprint**, connect GitHub if asked, and pick **noahhassan2026/glucosnap**.
3. Render shows the `glucosnap` web service and asks for `NAVIGATOR_TOOLKIT_API_KEY`. Paste the key
   and click **Apply**. The first build takes about 5 to 10 minutes.
4. The app is at the `https://glucosnap-….onrender.com` link on the service page. Every push to
   `main` redeploys.

Free services get 512 MB and a tenth of a CPU, and sleep after 15 minutes without visitors; the next
visit wakes them in about a minute.
Open the link a few minutes before a demo.

## Your own computer (for a live demo)

```bash
npm ci && npm run build
pip install -r api/requirements.txt
echo "NAVIGATOR_TOOLKIT_API_KEY=your-key" > api/.env   # git-ignored
uvicorn deploy.serve:app --port 8000 --env-file api/.env
```

Then share it with a free Cloudflare quick tunnel (install `cloudflared` first):
`cloudflared tunnel --url http://localhost:8000` prints a public `https://….trycloudflare.com` link
that works while both commands run.

