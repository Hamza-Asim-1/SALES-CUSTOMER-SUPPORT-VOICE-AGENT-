# AI Automation for Sales and Customer Care — Setup Guide
**F24-160 | NUCES Lahore | FYP**

This guide covers:
1. [Environment variables (2 files)](#1-environment-variables)
2. [Supabase database setup](#2-supabase-setup)
3. [Option A — Local bare-metal](#option-a--local-bare-metal)
4. [Option B — Docker Compose](#option-b--docker-compose)
5. [Option C — Kubernetes](#option-c--kubernetes)
6. [Verification & troubleshooting](#verification--troubleshooting)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js Frontend :3000                 │
│             (Vercel in production / Docker locally)      │
└────┬─────────────┬──────────────┬───────────────┬────────┘
     │             │              │               │
     ▼             ▼              ▼               ▼
  auth :2000   crm :5000   reporting :6000   sales :8000
  FastAPI       FastAPI       FastAPI       Flask + FastAPI
     │             │                            │
     │    ┌────────┤                  ┌─────────┤
     │    │  Celery worker            │  Celery worker
     │    │                           │
     └────┴───────────────────────────┘
                    │
         ┌──────────┼─────────────┐
         ▼          ▼             ▼
     Supabase     Redis        External APIs
    (Auth+DB)   (Broker)    Groq / Qdrant / Twilio
                             ElevenLabs / Segmind
```

| Service | Port | Role |
|---------|------|------|
| `auth-service` | 2000 | Signup, login, Supabase Auth, JWT |
| `crm_integration_service` | 5000 | CSV ingestion, column mapping, lead storage |
| `reporting_service` | 6000 | CSV analytics, RAG chat (Qdrant + Groq) |
| `sales_agent_service` | 8000 | LangGraph sales agent, Twilio voice, ElevenLabs TTS |
| Redis | 6379 | Celery broker/backend for CRM and sales workers |

---

## External Services Required

| Service | Free tier | Purpose | Sign up |
|---------|-----------|---------|---------|
| **Supabase** | Yes | Auth + PostgreSQL | supabase.com |
| **Groq** | Yes (rate-limited) | LLM for all AI | console.groq.com |
| **Redis** | Local / Docker | Celery queues | — |
| **Qdrant Cloud** | Yes | Reporting vector store | qdrant.io |
| **Segmind** | Yes (credits) | Text embeddings | segmind.com |
| **Twilio** | Trial ($15 credit) | Outbound voice calls | twilio.com |
| **ElevenLabs** | Yes (limited) | Text-to-speech | elevenlabs.io |
| **Gmail SMTP** | Yes | Sales email alerts | — |
| **ngrok** | Yes (free) | Twilio webhooks locally | ngrok.com |

**Minimum to get the UI running:** Supabase + Groq only.

---

## 1. Environment Variables

There are exactly **2 env files** for the whole project.

### File 1 — `backend/.env`  (all 4 backend services)

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env    # fill in your real values
```

> **Reporting service extra step (local dev only):**  
> Pydantic `BaseSettings` looks for `.env` in its working directory (`reporting_service/app/`).  
> Copy the file there once after editing:
> ```powershell
> Copy-Item backend\.env backend\reporting_service\app\.env
> ```
> For Docker and Kubernetes this is **not needed** — env vars are injected directly.

### File 2 — `frontend/.env.local`  (Next.js)

```powershell
Copy-Item frontend\.env.example frontend\.env.local
notepad frontend\.env.local
```

Set at minimum:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000   # local dev
```

> **Note on hardcoded URLs:**  
> Auth and Reporting API URLs are currently hardcoded in the frontend source.  
> For local dev, change these two files:
> - `frontend/app/login/page.tsx` & `frontend/app/signup/page.tsx`  
>   → `https://auth-servive.onrender.com` → `http://localhost:2000`  
> - `frontend/lib/apis/reportingApis.ts` & `frontend/app/reporting/page.tsx`  
>   → `https://reporting-service-fbj2.onrender.com/api/v1` → `http://localhost:6000/api/v1`

### Generate required key values

```powershell
# encryption_key (Fernet) — run once, copy output into .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# secret_key (JWT) — run once, copy output into .env
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 2. Supabase Setup

### 2a. Create a project

1. Go to [supabase.com](https://supabase.com) → New project  
2. Note down your database password (needed for `PSQL_URL`)  
3. Wait ~2 minutes for provisioning

### 2b. Collect keys

Go to **Settings → API** in your project:

| What | Where | Env var |
|------|-------|---------|
| Project URL | "Project URL" | `SUPABASE_URL` / `supabase_url` |
| Anon key | "anon public" | `SUPABASE_KEY` / `supabase_key` |
| Service role | "service_role" → Reveal | `SERVICE_ROLE` |

Go to **Settings → Database → Connection string → URI** for `PSQL_URL`.

### 2c. Apply the SQL schema

1. **Supabase Dashboard → SQL Editor → New query**  
2. Open `backend/docs/supabase_schema.sql`, paste all contents, click **Run**  
3. You'll see `users`, `Mapped_Dataset`, and `users_data` in the Table Editor

### 2d. Enable Google OAuth (optional)

**Authentication → Providers → Google** → enable and add your Google OAuth credentials.

---

## Option A — Local Bare-Metal

Run each service natively. Best for debugging individual services.

### Prerequisites

- **Python 3.12+** — python.org/downloads  
- **Node.js 20+** — nodejs.org  
- **Redis** — run with Docker: `docker run -d -p 6379:6379 --name fyp_redis redis:7-alpine`

### Step 1: Fill in env files

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env           # fill in all credentials

Copy-Item backend\.env backend\reporting_service\app\.env   # reporting service needs local copy

Copy-Item frontend\.env.example frontend\.env.local
notepad frontend\.env.local
```

### Step 2: auth-service (port 2000)

```powershell
cd backend\auth-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 2000
```

### Step 3: crm_integration_service (port 5000)

Open a new terminal:

```powershell
cd backend\crm_integration_service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.api.main:app --reload --port 5000
```

Celery worker (another new terminal):

```powershell
cd backend\crm_integration_service
.\.venv\Scripts\activate
# Windows: use -P solo if gevent causes issues
celery -A app.worker.celery_app worker --loglevel=info -P solo
```

### Step 4: reporting_service (port 6000)

New terminal:

```powershell
cd backend\reporting_service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r app\requirements.txt
cd app
uvicorn main:app --reload --port 6000
```

### Step 5: sales_agent_service (port 8000)

New terminal:

```powershell
cd backend\sales_agent_service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r src\requirements.txt
python -m src.calling_agent.main
```

For voice calls — run ngrok in a separate terminal and update `PUBLIC_URL` in `backend/.env`:

```powershell
ngrok http 8000
# Copy the https://xxxx.ngrok-free.app URL into backend/.env as PUBLIC_URL
```

### Step 6: Frontend (port 3000)

New terminal:

```powershell
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### All terminals at a glance

| Terminal | Directory | Command | Port |
|----------|-----------|---------|------|
| 1 | — | `docker run -d -p 6379:6379 redis:7-alpine` | 6379 |
| 2 | `backend/auth-service` | `uvicorn app.main:app --reload --port 2000` | 2000 |
| 3 | `backend/crm_integration_service` | `uvicorn app.api.main:app --reload --port 5000` | 5000 |
| 4 | `backend/crm_integration_service` | `celery -A app.worker.celery_app worker -P solo` | — |
| 5 | `backend/reporting_service/app` | `uvicorn main:app --reload --port 6000` | 6000 |
| 6 | `backend/sales_agent_service` | `python -m src.calling_agent.main` | 8000 |
| 7 | `frontend` | `npm run dev` | 3000 |

---

## Option B — Docker Compose

Runs all services in containers with a single command. Recommended for local integration testing.

### Prerequisites

- **Docker Desktop** — docker.com/products/docker-desktop  
  Enable WSL2 backend on Windows.

### Step 1: Fill in env files

```powershell
Copy-Item backend\.env.example  backend\.env     # fill in all credentials
Copy-Item frontend\.env.example frontend\.env.local
```

All backend services share `backend/.env` via `env_file` in docker-compose.  
`REDIS_URL` is automatically overridden to `redis://redis:6379/0` for Docker networking.

### Step 2: Build and start

```powershell
# From the project root (FYP_CODEBADE/)
docker compose up --build

# Or run detached (background):
docker compose up --build -d
```

First build takes 5–10 minutes (downloads Python/Node base images and installs packages).

### Step 3: Access the app

| URL | Service |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:2000/docs | auth-service API docs |
| http://localhost:5000/docs | crm API docs |
| http://localhost:6000/docs | reporting API docs |
| http://localhost:8000 | sales demo API |

### Useful Docker Compose commands

```powershell
# Tail logs for a service
docker compose logs -f auth
docker compose logs -f crm
docker compose logs -f crm-worker
docker compose logs -f reporting
docker compose logs -f sales
docker compose logs -f frontend

# Rebuild and restart a single service after a code change
docker compose up --build auth -d

# Start only backend (skip frontend for API testing)
docker compose up redis auth crm crm-worker reporting sales sales-worker -d

# Open a shell in a running container
docker compose exec crm bash
docker compose exec frontend sh

# Stop all containers
docker compose down

# Stop and wipe Redis volume
docker compose down -v
```

---

## Option C — Kubernetes

Uses Docker images (built in Option B) deployed to a Kubernetes cluster.  
This matches the FYP's production deployment intent (AWS/Azure/GCP).

```
Docker builds images  →  Push to registry  →  Kubernetes pulls & orchestrates
```

### Prerequisites

- Docker Desktop (already running)
- **minikube** for local K8s — minikube.sigs.k8s.io/docs/start
- **kubectl** — kubernetes.io/docs/tasks/tools

```powershell
winget install Kubernetes.minikube
winget install Kubernetes.kubectl
```

---

### Local Kubernetes with minikube

#### 1. Start minikube

```powershell
minikube start --driver=docker --memory=6144 --cpus=4
minikube status      # Host: Running  kubelet: Running  apiserver: Running
```

#### 2. Point Docker CLI at minikube's daemon

```powershell
# Run this in EVERY terminal where you build images
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

#### 3. Build all Docker images into minikube

```powershell
docker build -t fyp/auth-service:latest         backend\auth-service
docker build -t fyp/crm-service:latest          backend\crm_integration_service
docker build -t fyp/reporting-service:latest    backend\reporting_service
docker build -t fyp/sales-agent-service:latest  backend\sales_agent_service
docker build -t fyp/frontend:latest             frontend
```

#### 4. Create the Kubernetes Secret from your backend/.env

```powershell
# Apply namespace first
kubectl apply -f k8s\00-namespace.yaml

# Create the secret directly from backend/.env (no manual base64 encoding needed!)
kubectl create secret generic backend-secret `
  --from-env-file=./backend/.env `
  -n fyp `
  --dry-run=client -o yaml | kubectl apply -f -
```

#### 5. Apply all manifests in order

```powershell
kubectl apply -f k8s\00-namespace.yaml
kubectl apply -f k8s\02-configmap.yaml
kubectl apply -f k8s\03-redis.yaml
kubectl apply -f k8s\04-auth.yaml
kubectl apply -f k8s\05-crm.yaml
kubectl apply -f k8s\06-reporting.yaml
kubectl apply -f k8s\07-sales.yaml
kubectl apply -f k8s\08-frontend.yaml

# Watch pods come up
kubectl get pods -n fyp -w
```

All pods should reach `Running` status within 2–3 minutes.

#### 6. Access services

```powershell
# Open frontend in browser
minikube service frontend -n fyp

# Or port-forward manually
kubectl port-forward svc/frontend   3000:3000 -n fyp
kubectl port-forward svc/auth       2000:2000 -n fyp
kubectl port-forward svc/crm        5000:5000 -n fyp
kubectl port-forward svc/reporting  6000:6000 -n fyp
kubectl port-forward svc/sales      8000:8000 -n fyp
```

#### 7. Enable Ingress (optional — to access via a single domain)

```powershell
minikube addons enable ingress

# Edit k8s/09-ingress.yaml — replace "yourdomain.com" with e.g. "fyp.local"
kubectl apply -f k8s\09-ingress.yaml

# Run tunnel (keep this terminal open, may need admin)
minikube tunnel

# Add to your hosts file (C:\Windows\System32\drivers\etc\hosts):
# 127.0.0.1  fyp.local
# Then browse to http://fyp.local
```

---

### Production Kubernetes (GKE / EKS / AKS)

#### 1. Build and push images to a container registry

```powershell
# Example: Docker Hub
$REGISTRY = "docker.io/yourusername"

docker build -t $REGISTRY/fyp-auth:latest         backend\auth-service
docker build -t $REGISTRY/fyp-crm:latest          backend\crm_integration_service
docker build -t $REGISTRY/fyp-reporting:latest    backend\reporting_service
docker build -t $REGISTRY/fyp-sales:latest        backend\sales_agent_service
docker build -t $REGISTRY/fyp-frontend:latest     frontend

docker push $REGISTRY/fyp-auth:latest
docker push $REGISTRY/fyp-crm:latest
docker push $REGISTRY/fyp-reporting:latest
docker push $REGISTRY/fyp-sales:latest
docker push $REGISTRY/fyp-frontend:latest
```

Update the `image:` field in `k8s/04-auth.yaml` through `k8s/08-frontend.yaml` to use your registry path.

#### 2. Point kubectl at your cluster

```powershell
# GKE example:
gcloud container clusters get-credentials <cluster-name> --region <region>

# EKS example:
aws eks update-kubeconfig --name <cluster-name> --region <region>

# AKS example:
az aks get-credentials --resource-group <rg> --name <cluster-name>
```

#### 3. Create the secret and deploy

```powershell
kubectl apply -f k8s\00-namespace.yaml

kubectl create secret generic backend-secret `
  --from-env-file=./backend/.env `
  -n fyp `
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s\   # applies all manifests in the k8s/ folder
```

#### 4. Set up HTTPS with cert-manager (recommended)

```powershell
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Create a ClusterIssuer for Let's Encrypt (edit email):
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: your-email@example.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# Then in k8s/09-ingress.yaml, uncomment the tls: and cert-manager annotation sections
kubectl apply -f k8s\09-ingress.yaml
```

---

### Useful kubectl commands (reference)

```powershell
# List all pods and status
kubectl get pods -n fyp

# Tail logs for a deployment
kubectl logs -n fyp deployment/auth        -f
kubectl logs -n fyp deployment/crm         -f
kubectl logs -n fyp deployment/crm-worker  -f
kubectl logs -n fyp deployment/reporting   -f
kubectl logs -n fyp deployment/sales       -f
kubectl logs -n fyp deployment/frontend    -f

# Describe a pod (shows events and error messages)
kubectl describe pod -n fyp <pod-name>

# Open an interactive shell in a running pod
kubectl exec -it -n fyp deployment/crm -- bash

# Scale a deployment (e.g. more Celery workers under load)
kubectl scale deployment crm-worker   -n fyp --replicas=3
kubectl scale deployment sales-worker -n fyp --replicas=2

# Rolling restart after a credential rotation
kubectl rollout restart deployment/auth       -n fyp
kubectl rollout restart deployment/crm        -n fyp
kubectl rollout restart deployment/crm-worker -n fyp

# Update the backend secret (after editing backend/.env)
kubectl create secret generic backend-secret `
  --from-env-file=./backend/.env `
  -n fyp `
  --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/auth crm crm-worker reporting sales sales-worker -n fyp

# Tear everything down
kubectl delete namespace fyp

# minikube — stop and delete the local cluster
minikube stop
minikube delete
```

---

## Verification & Troubleshooting

### Quick health check after any deployment

```powershell
# Each should return HTTP 200 or a JSON body
Invoke-WebRequest http://localhost:2000/docs     # auth swagger
Invoke-WebRequest http://localhost:5000/docs     # crm swagger
Invoke-WebRequest http://localhost:6000/health   # reporting health
Invoke-WebRequest http://localhost:8000          # sales
Invoke-WebRequest http://localhost:3000          # frontend
```

### Walkthrough checklist

```
[ ] http://localhost:3000           Landing page loads
[ ] http://localhost:3000/signup    Can create an account
[ ] http://localhost:3000/login     Can log in
[ ] http://localhost:3000/crm-integration   Upload a CSV → mapped data appears
[ ] http://localhost:3000/dashboard         Contacts table shows rows
[ ] http://localhost:3000/sales-agent       Start processing works
[ ] http://localhost:3000/reporting         CSV analysis charts + AI chat work
[ ] http://localhost:3000/voice-demo        Mic → AI response works
```

---

### Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `SUPABASE_URL is None` | `.env` not found or wrong path | Check file exists at `backend/.env`; for reporting also copy to `backend/reporting_service/app/.env` |
| `Cannot connect to redis://localhost:6379` | Redis not running | `docker run -d -p 6379:6379 redis:7-alpine` |
| Celery worker crashes on Windows | `fork`-based multiprocessing | Add `-P solo` to the celery command |
| `MEM0_API_KEY field required` | Pydantic validation | Set `MEM0_API_KEY=placeholder_not_used` in `.env` |
| `psycopg2.OperationalError` | Wrong `PSQL_URL` | Copy the URI from Supabase → Settings → Database → Connection string |
| `REDIS_URL redis://localhost fails in Docker` | Container uses service name | The `docker-compose.yml` already overrides this to `redis://redis:6379/0` — just rebuild |
| Frontend "Network Error" for all API calls | Wrong `NEXT_PUBLIC_API_BASE_URL` | Check `.env.local`; also update hardcoded auth/reporting URLs in source |
| Twilio webhook errors | `PUBLIC_URL` not set | Run ngrok, copy URL to `PUBLIC_URL` in `.env`, restart sales service |
| Dashboard shows user `6921` | Auth token not reaching backend | Log in via `/login` properly; the `6921` is a hardcoded fallback |
| `psql` DDL error in CRM | Hardcoded password in `helper_function.py` | Replace line 10 in `crm_integration_service/app/api/helper_function.py` with `os.getenv("PSQL_URL")` |

---

## Security Reminders

1. **Rotate the hardcoded DB password** in `crm_integration_service/app/api/helper_function.py` line 10 — go to Supabase → Settings → Database → Reset database password.
2. **Never commit `backend/.env`** — it is listed in `.gitignore`.
3. In production, restrict CORS `allow_origins` from `"*"` to your actual frontend domain.
4. Use `SERVICE_ROLE` only in backend services — never in the browser.
5. For production K8s, use [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) or [External Secrets Operator](https://external-secrets.io/) instead of plain Secrets YAML.
