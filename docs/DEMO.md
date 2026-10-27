# Final Demo Runbook

Recorded walkthrough: [demo video](../demo/StockPilot-Demo.mp4) · slides: [PPTX](../demo/StockPilot-Capstone.pptx) / [PDF](../demo/StockPilot-Capstone.pdf). All are in [`demo/`](../demo).

This follows the capstone's required flow:

```
Application → Git commit → CI pipeline → Docker image → Security scan → Registry →
Terraform → Kubernetes → Helm → Ingress → Autoscaling → Monitoring → Troubleshooting
```

It runs on the local kind cluster (`scripts/kind-up.sh`). For EKS, use the NLB hostname in place of `stockpilot.local:8081`.

**Before you start**, open these terminals and tabs:

```bash
# Terminal 1: cluster up (if not already)
scripts/kind-up.sh

# Terminal 2: Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80

# Terminal 3: Prometheus
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

Browser tabs:
- http://stockpilot.local:8081
- http://stockpilot.local:8081/docs
- http://localhost:3001 (admin / stockpilot-admin) → Dashboards → *StockPilot — Application Overview*
- GitHub → Actions
- GitHub → Packages

---

### 1. Application

Open http://stockpilot.local:8081.
- Walk through the KPIs, the *Needs attention* table, value by category and recent activity.
- Click **New product** and create one, for example `NW-4010 · PoE Injector · qty 3 · reorder 5`. It appears as *Low stock*.
- Click ⇅ (**Adjust stock**) → *Stock in* 20 · *Restock* · note "PO-1042". The status flips to *In stock* and the activity feed updates.
- Narrow the window to show the responsive layout: the sidebar collapses into a menu.

### 2. API

Open `/docs` and run each request with **Try it out**:
- `POST /api/products`
- `GET /api/products?stock_status=low_stock`
- `PUT /api/products/{id}`
- `POST /api/products/{id}/adjust` with `{"change": -999, "reason": "sale"}` returns **409**, because stock can't go negative
- `DELETE /api/products/{id}`

Or run all of it in one go: `scripts/smoke-test.sh http://stockpilot.local:8081`.

### 3. Database

```bash
kubectl exec -it -n stockpilot stockpilot-postgresql-0 -- psql -U stockpilot -c \
  "select sku, name, quantity, reorder_level from products order by id;"
kubectl exec -it -n stockpilot stockpilot-postgresql-0 -- psql -U stockpilot -c \
  "select p.sku, m.change, m.reason, m.quantity_after, m.created_at from stock_movements m join products p on p.id=m.product_id order by m.id desc limit 5;"
```

### 4. Git

Make a small visible change, for example the subtitle in `frontend/src/App.jsx`:

```bash
git checkout -b feat/demo-change
# edit SUBTITLES.dashboard
git commit -am "feat: update dashboard subtitle"
git push -u origin feat/demo-change
gh pr create --fill
```

### 5. CI

In GitHub → Actions, the PR runs:
- `backend-test`: pytest on PostgreSQL plus the migration round-trip
- `frontend-test`
- `manifests-lint`

Merge the PR. The push to `main` then runs build, scan and push.

*Optional:* break a test to show the gate. The pipeline stops and no image is built.

### 6. Docker

```bash
docker images | grep stockpilot
docker history stockpilot-backend:local | head      # multi-stage, small runtime layers
docker run --rm stockpilot-backend:local id         # uid=10001, not root
```

### 7. Security

Open the `build-scan-push` job and the **Trivy scan (gate)** step, which shows the HIGH/CRITICAL table. Results are also under GitHub → Security → Code scanning (if enabled).

Locally:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.74.0 \
  image --severity HIGH,CRITICAL --ignore-unfixed stockpilot-backend:local
```

### 8. Registry

GitHub → profile → **Packages** → `stockpilot-backend` / `stockpilot-frontend`. Each push has a tag equal to the commit SHA, which matches `git log -1 --format=%H`.

### 9. Terraform

Walk through `terraform/`:
- `vpc.tf`: public and private subnets, NAT, ELB subnet tags
- `eks.tf`: version, add-ons, managed node group
- `github-oidc.tf`: keyless deploy role

```bash
cd terraform && terraform init -backend=false && terraform validate && terraform plan   # plan needs AWS credentials
```

### 10. Kubernetes

```bash
kubectl get nodes
kubectl get pods -n stockpilot -o wide
kubectl get svc,endpoints -n stockpilot
kubectl get deploy -n stockpilot -o wide          # IMAGES column shows the tag
```

### 11. Helm

```bash
helm list -n stockpilot
helm history stockpilot -n stockpilot
helm get values stockpilot -n stockpilot
helm test stockpilot -n stockpilot --logs
```

### 12. Ingress

```bash
kubectl get ingress -n stockpilot
kubectl describe ingress stockpilot -n stockpilot   # / → frontend, /api,/docs → backend
curl -s http://stockpilot.local:8081/api/stats | head -c 200
```

### 13. HPA

```bash
kubectl get hpa -n stockpilot
scripts/load-test.sh                                # 8 in-cluster load generators
kubectl get hpa -n stockpilot -w                    # TARGETS climbs past 50%, REPLICAS 2 → 3 → 5
kubectl top pods -n stockpilot
scripts/load-test.sh stop                           # replicas fall back to 2 after about 2 minutes
```

### 14. Monitoring

- **Prometheus** (http://localhost:9090) → Status → Targets: `serviceMonitor/stockpilot/stockpilot-backend` shows UP for every pod. Try the query `sum by (handler) (rate(http_requests_total{namespace="stockpilot"}[1m]))`.
- **Grafana** dashboard during the load test: request rate rises, CPU per pod crosses the request line, and the HPA replicas panel steps up. Stock adjustments made in the UI show up under *Stock movements by reason*.
- **Alerts**: Prometheus → Alerts → the `stockpilot.rules` group.

### 15. Failure simulation

Pick one or two (the full runbook is in `troubleshooting/README.md`):

```bash
kubectl apply -f troubleshooting/00-namespace.yaml
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get endpoints storefront -n troubleshooting          # <none>
kubectl get pods -n troubleshooting --show-labels            # app=storefront vs selector app=store-front
kubectl apply -f troubleshooting/fixed/broken-service.yaml   # endpoints appear

kubectl apply -f troubleshooting/broken-image.yaml
kubectl describe pod -n troubleshooting -l app=inventory-api | tail   # "not found"
kubectl apply -f troubleshooting/fixed/broken-image.yaml
```

**Live on the real app:** take the database down.

```bash
kubectl scale statefulset stockpilot-postgresql -n stockpilot --replicas=0
```

The UI shows a "Backend unavailable" banner and the backend pods go `0/1` without restarting, because readiness and liveness check different things.

```bash
kubectl scale statefulset stockpilot-postgresql -n stockpilot --replicas=1
```

The app recovers on its own.
