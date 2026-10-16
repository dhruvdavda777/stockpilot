# StockPilot: Inventory Management, from Laptop to Monitored Kubernetes

[![CI/CD](https://github.com/dhruvdavda777/stockpilot/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/dhruvdavda777/stockpilot/actions/workflows/ci-cd.yml)

StockPilot is a small but realistic SaaS-style inventory system for a warehouse team. It tracks products, categories, stock levels, reorder alerts and an audited log of every stock movement. It's the DevOps final capstone project: the app is the vehicle, and the delivery path is the point.

```
Developer ─▶ GitHub ─▶ GitHub Actions ─┬─ pytest (on PostgreSQL) + Alembic migration check
                                       ├─ vitest + Vite build
                                       ├─ helm lint + terraform validate
                                       ├─ docker build (backend, frontend)
                                       ├─ Trivy scan  ── HIGH/CRITICAL fixable CVE ⇒ pipeline fails
                                       └─ push to GHCR (tag = commit SHA)
                                                  │
                     Terraform ─▶ AWS VPC + EKS   │
                                       │          ▼
                                       └──────▶ Helm ─▶ Kubernetes (namespace: stockpilot)
                                                         ├─ Ingress (nginx): /  → frontend
                                                         │                   /api, /docs → backend
                                                         ├─ frontend Deployment (React on Nginx)
                                                         ├─ backend Deployment (FastAPI) ◀── HPA (CPU)
                                                         ├─ PostgreSQL StatefulSet + PVC
                                                         └─ ServiceMonitor ─▶ Prometheus ─▶ Grafana
```

## Contents

1. [Requirements coverage](#1-requirements-coverage)
2. [Repository layout](#2-repository-layout)
3. [The application](#3-the-application)
4. [Run locally with Docker Compose](#4-run-locally-with-docker-compose)
5. [Run without Docker](#5-run-without-docker)
6. [Tests](#6-tests)
7. [CI/CD pipeline](#7-cicd-pipeline)
8. [Security](#8-security)
9. [Kubernetes on your laptop (kind)](#9-kubernetes-on-your-laptop-kind)
10. [AWS: Terraform + EKS](#10-aws-terraform--eks)
11. [Helm](#11-helm)
12. [Ingress, HPA and monitoring](#12-ingress-hpa-and-monitoring)
13. [Troubleshooting lab](#13-troubleshooting-lab)
14. [Design decisions and trade-offs](#14-design-decisions-and-trade-offs)

The step-by-step script for the final presentation is in **[docs/DEMO.md](docs/DEMO.md)**.

---

## 1. Requirements coverage

| Requirement | Where it lives |
|---|---|
| Frontend (responsive UI) | `frontend/`: React 19 + Vite 8 with a dark sidebar, KPI cards, filterable product table, activity feed and modals. Layout works down to 360 px. |
| Backend, ≥ 4 REST APIs | `backend/`: FastAPI with 14 endpoints across products, categories, stock movements, stats, health, readiness and metrics |
| PostgreSQL + ORM + migrations | SQLAlchemy 2 models (`backend/app/models.py`) and Alembic (`backend/alembic/`) |
| Automated tests | 24 pytest tests (SQLite locally, PostgreSQL in CI) and 8 Vitest tests |
| Git / GitHub | This repo. Branch → PR → CI → merge to `main` → deploy |
| Docker | Multi-stage, non-root images: `backend/Dockerfile`, `frontend/Dockerfile`, plus `docker-compose.yml` |
| GitHub Actions | `.github/workflows/ci-cd.yml`: test → build → scan → push → deploy |
| Security scan | Trivy gate on both images, SARIF uploaded to the GitHub Security tab |
| Container registry | GitHub Container Registry, images tagged with the commit SHA |
| Terraform | `terraform/`: VPC (public/private subnets, NAT), EKS with a managed node group and add-ons, GitHub OIDC deploy role |
| Kubernetes | `k8s/` (namespace with Pod Security "restricted", quota, limits) and the chart's Deployments, StatefulSet and Services |
| Helm | `helm/stockpilot/`: values per environment, checksum-triggered rollouts, `helm test` |
| Ingress | `templates/ingress.yaml` with path routing: `/` → frontend, `/api` and `/docs` → backend |
| HPA | `templates/hpa.yaml`: autoscaling/v2 on CPU, with tuned scale-up/down behaviour |
| Prometheus / Grafana | `/metrics`, ServiceMonitor, PrometheusRule alerts, a Grafana dashboard provisioned from a ConfigMap |
| Troubleshooting | `troubleshooting/`: 5 broken scenarios with fixes and a runbook |

## 2. Repository layout

```
.
├── backend/                 FastAPI app
│   ├── app/                 main.py, models, schemas, routers/, metrics, seed data
│   ├── alembic/             migrations (advisory-locked, safe with many replicas)
│   ├── tests/               pytest suite
│   └── Dockerfile
├── frontend/                React + Vite app
│   ├── src/                 App.jsx, components/, styles.css, tests
│   ├── nginx/               Nginx template (SPA + /api proxy)
│   └── Dockerfile
├── docker-compose.yml       full local stack
├── terraform/               AWS VPC + EKS + GitHub OIDC role
├── helm/stockpilot/         the Kubernetes package
├── k8s/                     namespace, gp3 StorageClass, kind cluster, add-on values
├── monitoring/              kube-prometheus-stack values
├── troubleshooting/         deliberately broken manifests, fixes and a runbook
├── scripts/                 kind-up, deploy, load test, smoke test
├── docs/DEMO.md             final presentation script
└── .github/workflows/       CI/CD
```

## 3. The application

### Domain

| Entity | Fields |
|---|---|
| **Category** | name, description |
| **Product** | SKU (unique), name, category, quantity, reorder level, unit price, supplier, bin location |
| **StockMovement** | product, change (±), quantity after, reason (`restock`, `sale`, `return`, `adjustment`, `damaged`, `initial`), note |

A product's **stock status** is derived from its quantity:
- `out_of_stock` when quantity is 0
- `low_stock` when quantity is at or below the reorder level
- `in_stock` otherwise

Quantity can't be edited directly. Every change goes through `POST /api/products/{id}/adjust`, which takes a row lock, refuses to go negative and writes an audit record.

### API

Swagger UI is at **`/docs`**.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Service info and version |
| GET | `/health` | **Liveness**: the process is up. Never touches the DB. |
| GET | `/ready` | **Readiness**: `SELECT 1` against PostgreSQL; returns 503 if unreachable |
| GET | `/metrics` | Prometheus metrics (HTTP plus business counters) |
| GET | `/api/products` | List products. Filters: `q`, `category_id`, `stock_status`, `limit`, `offset` |
| GET | `/api/products/{id}` | Get one product |
| POST | `/api/products` | Create a product (an opening quantity is logged as an `initial` movement) |
| PUT | `/api/products/{id}` | Partial update (everything except quantity) |
| DELETE | `/api/products/{id}` | Delete a product and its movements |
| POST | `/api/products/{id}/adjust` | Stock in or out with a reason. Returns 409 if stock would go negative. |
| GET | `/api/movements` | Audit log, newest first (`product_id`, `limit`) |
| GET | `/api/categories` | List categories with product counts |
| GET | `/api/categories/{id}` | Get one category |
| POST | `/api/categories` | Create a category (409 on duplicate name) |
| PUT | `/api/categories/{id}` | Update a category |
| DELETE | `/api/categories/{id}` | Delete a category. Its products become uncategorised. |
| GET | `/api/stats` | KPIs: totals, inventory value, low/out counts, breakdown by category, movements in the last 24h |

### Why `/health`, `/ready` and `/metrics` are separate

- **`/health`** answers "is the process alive?" Kubernetes restarts the container if it fails. It deliberately doesn't check the database, so a DB outage doesn't trigger a restart storm across healthy pods.
- **`/ready`** answers "can this pod serve traffic right now?" If PostgreSQL is unreachable it returns 503, and Kubernetes takes the pod out of the Service until it recovers.
- **`/metrics`** gives Prometheus machine-readable data:
  - `http_requests_total`
  - `http_request_duration_seconds`
  - `stockpilot_stock_movements_total{reason}`
  - `stockpilot_stock_units_moved_total{direction}`

### Configuration (environment variables)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://stockpilot:stockpilot@localhost:5432/stockpilot` | SQLAlchemy URL |
| `SEED_DEMO_DATA` | `false` | Loads 12 demo products if the DB is empty. Idempotent. |
| `RUN_MIGRATIONS` | `true` | Container entrypoint runs `alembic upgrade head` |
| `ENVIRONMENT`, `APP_VERSION` | `local`, `dev` | Shown on `/`. CI sets the version to the commit SHA. |

## 4. Run locally with Docker Compose

Requires Docker Desktop or Docker Engine with Compose v2.

```bash
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:3000 | StockPilot UI |
| http://localhost:8000/docs | Swagger |
| http://localhost:8000/health · `/ready` · `/metrics` | Probes and metrics |

```bash
docker compose exec db psql -U stockpilot -c "select sku, name, quantity from products;"
docker compose down        # stop
docker compose down -v     # stop and delete the database volume
```

If those ports are already in use:

```bash
FRONTEND_PORT=3300 BACKEND_PORT=8800 DB_PORT=5544 docker compose up --build
```

## 5. Run without Docker

**Backend** (Python 3.12+ and a running PostgreSQL):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL='postgresql+psycopg://stockpilot:stockpilot@localhost:5432/stockpilot'
alembic upgrade head
SEED_DEMO_DATA=true uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node 22+). Vite proxies `/api` to `localhost:8000`:

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

## 6. Tests

```bash
cd backend && pytest -q                 # 24 tests, in-memory SQLite, zero setup
TEST_DATABASE_URL=postgresql+psycopg://stockpilot:stockpilot@localhost:5432/stockpilot pytest -q   # same suite on PostgreSQL

cd frontend && npm test                 # 8 Vitest tests (helpers + components)
```

The backend suite covers:
- CRUD for products and categories
- Validation (422) and conflicts (409)
- Stock-status filters
- The adjust endpoint, including the negative-stock guard and audit log
- Stats aggregation
- Health and readiness, including a simulated DB outage that must return 503
- Metrics exposure
- Seed idempotency

Tests run before any image is built:

```
bad code ─▶ pytest fails ─▶ pipeline stops ─▶ no image is built, scanned or pushed
```

## 7. CI/CD pipeline

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`.

```
┌ backend-test ────┐  pytest against a real PostgreSQL service container,
│                  │  plus Alembic upgrade → downgrade → upgrade
├ frontend-test ───┤  npm ci → vitest → vite build
├ manifests-lint ──┤  helm lint (3 value sets) + terraform fmt/validate
└────────┬─────────┘
         ▼
  build-scan-push (matrix: backend, frontend)
    docker build → Trivy (fail on fixable HIGH/CRITICAL) → SARIF to Security tab
    → push ghcr.io/<owner>/stockpilot-<component>:<commit-sha> and :latest   (not on PRs)
         ▼
  deploy (main only, when DEPLOY_ENABLED=true)
    OIDC → AWS role → aws eks update-kubeconfig
    → helm upgrade --install --rollback-on-failure → rollout status → helm test
```

**Traceability:** commit A produces image A, which becomes Helm revision N. `kubectl get deploy -o wide` shows the SHA, and so do the UI's sidebar and `GET /`.

Every third-party action is **pinned to a full commit SHA**, a supply-chain control. In 2026, mutable `trivy-action` tags were rewritten to point at malicious code; SHA pins aren't affected by that.

### Enabling the deploy job

After `terraform apply`:

| GitHub setting | Value |
|---|---|
| Secret `AWS_DEPLOY_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| Secret `DB_PASSWORD` | a strong password, used on first install. Changing it later requires changing it inside PostgreSQL too. |
| Variable `DEPLOY_ENABLED` | `true` |
| Variable `EKS_CLUSTER_NAME` (optional) | `terraform output -raw cluster_name` (default `stockpilot-dev-eks`) |
| Environment `production` | Optionally add required reviewers, which turns deploys into an approval gate |

GHCR packages are private by default. Either make both packages public (Package settings → Change visibility), or create an `imagePullSecret` and set `imagePullSecrets` in the values.

## 8. Security

Security is layered, and each layer catches something different:

| Layer | What it catches | In this repo |
|---|---|---|
| Dependency pinning | Surprise upgrades | Exact versions in `requirements.txt` and `package-lock.json` |
| Supply chain | Tampered CI actions | All actions pinned by SHA, Trivy ≥ 0.36 (post-incident) |
| Container scanning | Known CVEs in OS and language packages | Trivy gate on every build (both images currently scan clean) |
| Image hardening | Blast radius | Multi-stage builds, no compilers in the runtime image, non-root users (uid 10001 / 101), OS packages upgraded at build time |
| Runtime | Privilege escalation | Namespace enforces Pod Security "restricted": `runAsNonRoot`, `drop: [ALL]`, seccomp, read-only root FS on the backend |
| Secrets | Leaked credentials | No long-lived AWS keys: GitHub OIDC assumes a role restricted to `main`. DB credentials live in a Kubernetes Secret. |
| Network edge | Header attacks | Nginx sets `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`, and hides its version |

A scanner isn't a guarantee of security. It's one automated control. SAST, secret scanning and runtime detection (e.g. Falco) would be the next layers to add.

## 9. Kubernetes on your laptop (kind)

One command creates a 3-node cluster and installs everything: ingress-nginx, metrics-server, Prometheus, Grafana and StockPilot.

```bash
scripts/kind-up.sh
echo "127.0.0.1 stockpilot.local" | sudo tee -a /etc/hosts
open http://stockpilot.local:8081          # 8081 because 80 is often taken on laptops
```

Iterate on code with `scripts/deploy-local.sh`, which rebuilds the images, loads them into kind and runs `helm upgrade`. Tear everything down with `scripts/kind-down.sh`.

## 10. AWS: Terraform + EKS

```
AWS (ap-south-1)
└── VPC 10.0.0.0/16
    ├── 2 public subnets  (/24) — NAT gateway, load balancers  [kubernetes.io/role/elb]
    ├── 2 private subnets (/20) — worker nodes, pods           [kubernetes.io/role/internal-elb]
    └── EKS 1.34 (API auth mode, IRSA)
        ├── add-ons: vpc-cni, coredns, kube-proxy, pod-identity-agent, aws-ebs-csi-driver
        └── managed node group: 2–4 × m7i-flex.large (AL2023, Free Tier eligible)
IAM: GitHub OIDC provider + deploy role (EKS access entry)
```

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars    # adjust as needed
terraform init
terraform plan
terraform apply                                  # about 15 minutes
$(terraform output -raw configure_kubectl)       # aws eks update-kubeconfig ...

cd ..
scripts/install-addons.sh eks                    # ingress-nginx (NLB), metrics-server, monitoring, gp3 StorageClass
kubectl apply -f k8s/namespace.yaml
helm upgrade --install stockpilot ./helm/stockpilot -n stockpilot \
  -f helm/stockpilot/values-eks.yaml \
  --set backend.image.tag=<sha> --set frontend.image.tag=<sha>
kubectl get svc -n ingress-nginx ingress-nginx-controller   # EXTERNAL-IP = NLB hostname, open it
```

> **Cost:** EKS control plane, NAT gateway, 2 × m7i-flex.large and an NLB cost roughly US$7–9 per day (new accounts' Free Tier credits cover part of it).
> New AWS accounts on the **Free plan** can only launch Free Tier instance types, which is why the default is `m7i-flex.large` and not `t3.medium`. When you're finished:
> ```bash
> helm uninstall stockpilot -n stockpilot && helm uninstall ingress-nginx -n ingress-nginx   # release the NLB first
> terraform destroy
> ```

For teams, enable the S3 backend in `terraform/versions.tf` (native S3 locking, no DynamoDB).

## 11. Helm

```bash
helm upgrade --install stockpilot ./helm/stockpilot -n stockpilot -f helm/stockpilot/values-dev.yaml
helm list -n stockpilot
helm history stockpilot -n stockpilot
helm rollback stockpilot <revision> -n stockpilot
helm test stockpilot -n stockpilot --logs        # in-cluster smoke test through both Services
```

| File | Purpose |
|---|---|
| `values.yaml` | Production-safe defaults: GHCR images, HPA 2–6, PDB, monitoring off |
| `values-dev.yaml` | kind: local images, Ingress host `stockpilot.local`, monitoring on |
| `values-eks.yaml` | EKS: gp3 storage, any-host Ingress behind the NLB, HPA 2–8 |

Chart details worth knowing:
- Pods roll automatically when the ConfigMap or Secret changes, via checksum annotations.
- `maxUnavailable: 0` means a broken release never drops capacity.
- An init container waits for PostgreSQL.
- Migrations run on start under a Postgres advisory lock, so N replicas don't race.
- `postgresql.enabled=false` together with `externalDatabase.url` switches to Amazon RDS without changing any templates.

## 12. Ingress, HPA and monitoring

**Ingress.** One host, with path-based routing:

| Path | Backend |
|---|---|
| `/` | `stockpilot-frontend:80` (React) |
| `/api`, `/docs`, `/openapi.json` | `stockpilot-backend:8000` (FastAPI) |

The browser only ever calls relative `/api/...`, so it never needs to know any internal hostname. An Ingress resource is only configuration; ingress-nginx is the controller that implements it.

**HPA.** The backend scales between 2 and 6 replicas (2–5 on kind) to keep average CPU around 60% (50% on kind) of the 100m request.
- Scale-up: +2 pods every 30 seconds.
- Scale-down: waits 2 minutes before removing pods.
- Metrics come from metrics-server.

```bash
scripts/load-test.sh                 # 8 in-cluster load generators for 5 minutes
kubectl get hpa -n stockpilot -w     # watch replicas climb, then fall after the load stops
scripts/load-test.sh stop
```

**Monitoring.** kube-prometheus-stack provides the Prometheus Operator, Prometheus, Alertmanager, Grafana, kube-state-metrics and node-exporter.
- The chart's **ServiceMonitor** makes Prometheus scrape `/metrics` on every backend pod.
- **PrometheusRule** alerts: backend down, 5xx rate above 5%, p95 latency above 500 ms, HPA pinned at max.
- The **Grafana dashboard** "StockPilot — Application Overview" is provisioned automatically. It shows:
  - request rate, error % and p95 latency
  - requests and latency per endpoint
  - CPU per pod against its request
  - HPA current/desired/max replicas
  - responses by status
  - stock movements by reason

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80                        # admin / stockpilot-admin
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090   # Status → Targets
```

## 13. Troubleshooting lab

See **[troubleshooting/README.md](troubleshooting/README.md)**:

| Scenario | Symptom |
|---|---|
| Wrong image tag | `ImagePullBackOff` |
| Service selector mismatch | No endpoints |
| Wrong readiness probe | `0/1 READY` |
| Missing Secret | `CrashLoopBackOff` |
| Memory limit too low | `OOMKilled` |

It also covers live failures on the real app: a database outage and a bad release followed by `helm rollback`.

## 14. Design decisions and trade-offs

- **PostgreSQL in Kubernetes vs Amazon RDS.** The in-cluster StatefulSet keeps the demo self-contained and free. For production, RDS gives automated backups, point-in-time recovery, Multi-AZ failover and patching, and the chart already supports it (`postgresql.enabled=false`). The trade-off is cost and less control.
- **Migrations at container start vs a Helm hook Job.** A pre-install hook would run before the in-chart database exists. Running `alembic upgrade head` on start under `pg_advisory_lock` is simple and safe for many replicas.
- **Single NAT gateway.** It saves about US$35/month per extra AZ, but a single AZ failure then cuts egress. Set `single_nat_gateway = false` for production.
- **HPA without a node autoscaler.** HPA adds pods, not nodes. On EKS, add Karpenter or Cluster Autoscaler so the node group can grow too.
- **ingress-nginx.** It's what the course uses and it runs everywhere. Upstream moved it to maintenance-only in 2026, so a new production platform should consider the Gateway API or the AWS Load Balancer Controller.
- **Quantity only changes through `/adjust`.** That makes the movement log a reliable audit trail. `SELECT … FOR UPDATE` prevents lost updates when two people sell the last unit at the same moment.
