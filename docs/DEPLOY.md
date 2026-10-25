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
| `AZURE_STORAGE_CONNECTION_STRING` | for accounts that last | saves accounts in Azure Blob Storage; without it they go to the container's disk and vanish on redeploy |
| `AZURE_STORAGE_CONTAINER` | no | blob container name; defaults to `glucosnap` |
| `SESSION_SECRET` | no | signs login tokens; by default one is made on first start and kept in storage |
| `DATA_DIR` | no | folder for accounts when no storage connection is set |
| `PORT` | no | set by most hosts; defaults to 7860 |

Without a vision key the app still works: photo scans return 503 and the app asks for macros.
Keys go in the host's secrets settings, never in the repo.

## Azure Container Apps

GitHub Actions (`.github/workflows/container.yml`) builds the container on every push to `main` and
publishes it as `ghcr.io/noahhassan2026/glucosnap` (public, like the repo). Azure only pulls that
image, so no Azure build service or container registry is needed; student subscriptions block
ACR Tasks anyway. Container Apps scales to zero when idle, so the first visit after a quiet spell
takes a little while.

Run in Azure Cloud Shell (portal.azure.com → `>_` → Bash):

```bash
az extension add --name containerapp --upgrade -y
az provider register -n Microsoft.App --wait
az provider register -n Microsoft.OperationalInsights --wait
# Student and trial subscriptions only allow some regions; pick one from this list:
az policy assignment list --query "[].parameters.listOfAllowedLocations.value" -o tsv
az group create -n glucosnap-rg -l REGION
az containerapp env create -n glucosnap-env -g glucosnap-rg -l REGION
az containerapp create -n glucosnap -g glucosnap-rg --environment glucosnap-env \
  --image ghcr.io/noahhassan2026/glucosnap:latest --ingress external --target-port 7860 \
  --cpu 0.5 --memory 1.0Gi --min-replicas 0 --max-replicas 1 \
  --query properties.configuration.ingress.fqdn -o tsv

read -s KEY   # paste the NaviGator key; it is not echoed
az containerapp secret set -n glucosnap -g glucosnap-rg --secrets navigator-key="$KEY"
az containerapp update -n glucosnap -g glucosnap-rg --set-env-vars NAVIGATOR_TOOLKIT_API_KEY=secretref:navigator-key
```

### Accounts storage (do this once)

User accounts and progress are saved in an Azure Storage account, because the container's own disk is wiped on
every redeploy. A few MB of blobs costs well under a cent a month, taken from the student credit. Run in Cloud
Shell; the name must be new across all of Azure, so it gets a random number:

```bash
az provider register -n Microsoft.Storage --wait
SA=glucosnap$RANDOM; echo "storage account: $SA"
az storage account create -n $SA -g glucosnap-rg -l northcentralus --sku Standard_LRS --kind StorageV2 \
  --min-tls-version TLS1_2 --allow-blob-public-access false
CONN=$(az storage account show-connection-string -n $SA -g glucosnap-rg -o tsv)
az containerapp secret set -n glucosnap -g glucosnap-rg --secrets storage-conn="$CONN"
az containerapp update -n glucosnap -g glucosnap-rg --set-env-vars AZURE_STORAGE_CONNECTION_STRING=secretref:storage-conn
```

Then `https://<app>/api/health` shows `"accounts_storage": "BlobStore"`. Keep `--max-replicas 1`: the server keeps
the account list in memory, so two copies of it would not see each other's sign-ups.

To ship a new version after the Container workflow finishes on `main`, point the app at that
commit's image (a new tag makes Azure pull it):
`az containerapp update -n glucosnap -g glucosnap-rg --image ghcr.io/noahhassan2026/glucosnap:<commit sha>`

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
echo "NAVIGATOR_TOOLKIT_API_KEY=your-key" > api/.env   # git-ignored; accounts save to api/data/
uvicorn deploy.serve:app --port 8000 --env-file api/.env
```

Then share it with a free Cloudflare quick tunnel (install `cloudflared` first):
`cloudflared tunnel --url http://localhost:8000` prints a public `https://….trycloudflare.com` link
that works while both commands run.

