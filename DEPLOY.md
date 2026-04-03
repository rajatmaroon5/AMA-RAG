# Cloud Deployment Guide — AMA-RAG

> **Cost: $0/month** — Railway free credits + Azure SWA free tier + Pinecone free tier

## Architecture

```
User Browser
    │
    ▼
Azure Static Web Apps (FREE)   ←── Angular frontend
    │  (direct API call)
    ▼
Railway.app (FREE $5/mo credits)  ←── .NET 8 backend
    │
    ├── Pinecone (FREE tier)      ←── Vector DB
    └── OpenAI API                ←── LLM / Embeddings
```

---

## Prerequisites

- GitHub account (push your code here)
- [Railway account](https://railway.app) — sign up with GitHub
- [Azure account](https://portal.azure.com) — free tier (no credit card for SWA)
- Pinecone API key (already have one)
- OpenAI API key (already have one)

---

## Step 1 — Push Code to GitHub

```bash
git init            # if not already a git repo
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ama-rag.git
git push -u origin main
```

---

## Step 2 — Deploy Backend to Railway

### 2a — Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → Select `ama-rag`
3. Railway will detect the `AmaRAGBackend/Dockerfile` automatically

### 2b — Set Service Name

In Railway dashboard → service name → rename to **`ama-rag-backend`**
(matches the name in `.github/workflows/deploy-backend.yml`)

### 2c — Set Environment Variables

In Railway → your service → **Variables** tab, add each from `.env.example`:

| Variable | Value |
|----------|-------|
| `OpenAI__ApiKey` | `sk-...` |
| `Pinecone__ApiKey` | `...` |
| `Pinecone__Environment` | `...` |
| `Pinecone__IndexName` | `ama-rag-index` |
| `HuggingFace__ApiKey` | `hf_...` |
| `CORS_ALLOWED_ORIGINS` | *(leave blank for now, fill in after Step 3)* |
| `Embedding__Provider` | `HuggingFace` |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

> **Note**: Railway injects `PORT` automatically — the backend reads it via `ASPNETCORE_HTTP_PORTS`.

### 2d — Get Railway Backend URL

After deploy succeeds: Settings → **Networking** → copy the public domain.
It looks like: `https://ama-rag-backend-production.up.railway.app`

**Save this URL — you'll need it in the next steps.**

### 2e — Verify Backend is Healthy

```
curl https://YOUR-RAILWAY-URL/health
# Expected: {"status":"healthy","timestamp":"..."}
```

---

## Step 3 — Deploy Frontend to Azure Static Web Apps

### 3a — Create Azure Static Web App

1. Go to [portal.azure.com](https://portal.azure.com) → Create a resource → **Static Web App**
2. Fill in:
   - **Name**: `ama-rag-ui`
   - **Plan type**: Free
   - **Region**: East US (or closest to you)
   - **Deployment source**: GitHub
   - **Repository**: your `ama-rag` repo
   - **Branch**: `main`
   - **App location**: `/AmaRAGUI`
   - **Output location**: `dist/ama-rag-ui`
   - **API location**: *(leave blank)*
3. Click **Review + Create** → **Create**

Azure will add a GitHub Actions workflow file automatically — **delete it** (we have our own in `.github/workflows/deploy-frontend.yml`).

### 3b — Get the Azure SWA API Token

In Azure portal → your Static Web App → **Manage deployment token** → copy it.

---

## Step 4 — Configure GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New secret**:

| Secret name | Value |
|-------------|-------|
| `RAILWAY_TOKEN` | Railway token (Railway dashboard → Account Settings → Tokens) |
| `RAILWAY_BACKEND_URL` | `https://YOUR-RAILWAY-URL` (no trailing slash) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token from Step 3b |

---

## Step 5 — Update CORS on Railway

Now that you have your Azure SWA URL (e.g. `https://orange-sea-abc123.azurestaticapps.net`):

1. Railway → your backend service → **Variables**
2. Set `CORS_ALLOWED_ORIGINS` = `https://orange-sea-abc123.azurestaticapps.net`
3. Railway will auto-redeploy

---

## Step 6 — Trigger Full Deployment

Push any change to `main` to trigger both workflows, or manually trigger them:

```bash
git commit --allow-empty -m "trigger cloud deploy"
git push
```

Or in GitHub → **Actions** → pick a workflow → **Run workflow**.

---

## Step 7 — Verify End-to-End

1. Open your Azure SWA URL in a browser
2. Upload a test document
3. Ask a question in the chat

---

## Ongoing Cost Estimates

| Service | Free Tier Limit | Your Usage |
|---------|----------------|------------|
| Railway | $5/month credit | ~$2-3/month for <100 req/day |
| Azure Static Web Apps | 100 GB bandwidth/month | Well within limits |
| Pinecone | 100K vectors, 1 index | Sufficient for 100s of docs |
| OpenAI | Pay-per-use | ~$0.01-0.10 per chat query |

---

## Troubleshooting

### Backend returns 502 / not reachable
- Check Railway deployment logs
- Verify `/health` endpoint: `curl https://YOUR-RAILWAY-URL/health`

### CORS error in browser
- Confirm `CORS_ALLOWED_ORIGINS` on Railway exactly matches your SWA URL (no trailing slash)
- Redeploy backend after updating the variable

### Angular shows "RAILWAY_BACKEND_URL_PLACEHOLDER" in network tab
- GitHub secret `RAILWAY_BACKEND_URL` is missing or misspelled
- Re-run the deploy-frontend workflow after adding the secret

### Upload fails in production
- Backend uses ephemeral storage on Railway — uploaded files are lost on redeploy
- For persistent uploads, add a Railway Volumes disk (free 1 GB) → mount at `/app/uploads`

---

## Adding a Railway Volume (Persistent Uploads)

1. Railway → your service → **Volumes** → **Add Volume**
2. Mount path: `/app/uploads`
3. Size: `1 GB` (free)

That's it — Railway mounts the volume automatically.
