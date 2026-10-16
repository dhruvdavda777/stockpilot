# Troubleshooting Lab

Five deliberately broken workloads, each isolated in the `troubleshooting` namespace so the real app keeps running. For each one: apply it, investigate with `kubectl`, find the root cause, then apply the fix in `fixed/`.

```bash
kubectl apply -f troubleshooting/00-namespace.yaml
kubectl config set-context --current --namespace=troubleshooting   # optional: saves typing -n
```

Clean up afterwards with `kubectl delete namespace troubleshooting`.

The general investigation loop:

```
kubectl get pods            → what state is it in?
kubectl describe pod <pod>  → Events at the bottom say why
kubectl logs <pod> [--previous]
kubectl get events --sort-by=.lastTimestamp
```

---

## 1. Broken image → `ImagePullBackOff`

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n troubleshooting -l app=inventory-api
```

**Symptom:** `ErrImagePull`, then `ImagePullBackOff`. The pod never starts.

**Investigate:**
```bash
kubectl describe pod -n troubleshooting -l app=inventory-api | tail -15
kubectl get events -n troubleshooting --sort-by=.lastTimestamp | grep -i pull
```
The Events show `Failed to pull image "ghcr.io/.../stockpilot-backend:v9.9.9-does-not-exist": ... not found`.

**Root cause:** the tag was never pushed. Other causes of the same symptom: a typo in the registry or repository name, a private registry with no `imagePullSecrets`, or a rate limit.

**Fix:**
```bash
kubectl apply -f troubleshooting/fixed/broken-image.yaml
kubectl rollout status deployment/inventory-api -n troubleshooting
```

**Lesson:** CI tags images with the commit SHA, so the deployed tag is always one that the pipeline actually pushed. Hand-typed tags are how this error happens.

---

## 2. Broken Service → no endpoints

```bash
kubectl apply -f troubleshooting/broken-service.yaml
```

**Symptom:** the pods are `Running` and `Ready`, but requests to the Service time out or are refused.

**Investigate:**
```bash
kubectl get svc storefront -n troubleshooting
kubectl get endpoints storefront -n troubleshooting        # ENDPOINTS = <none>
kubectl get pods -n troubleshooting --show-labels -l tier=web
kubectl describe svc storefront -n troubleshooting | grep Selector
kubectl run curl -n troubleshooting --rm -it --restart=Never --image=busybox:1.37 -- wget -qO- -T 3 http://storefront
```

**Root cause:** the Service selects `app=store-front`, but the pods are labelled `app=storefront`. No matching labels means no endpoints, which means no traffic.

**Fix:**
```bash
kubectl apply -f troubleshooting/fixed/broken-service.yaml
kubectl get endpoints storefront -n troubleshooting        # now lists 2 pod IPs
```

---

## 3. Broken readiness probe → Running but `0/1 READY`

```bash
kubectl apply -f troubleshooting/broken-probe.yaml
```

**Symptom:** `STATUS Running`, `READY 0/1`, and the Service has no endpoints. Unlike scenario 2, the labels here are correct.

**Investigate:**
```bash
kubectl get pods -n troubleshooting -l app=catalog
kubectl describe pod -n troubleshooting -l app=catalog | grep -A3 -i readiness
#   Warning  Unhealthy  Readiness probe failed: ... connect: connection refused
kubectl get endpoints catalog -n troubleshooting
```

**Root cause:** the probe hits port 80 at `/ready`. The unprivileged nginx image listens on 8080 and serves `/`.

**Fix:**
```bash
kubectl apply -f troubleshooting/fixed/broken-probe.yaml
```

**Lesson:** in StockPilot, readiness (`/ready`) checks the database and liveness (`/health`) does not. A database outage takes pods out of the load balancer without restarting them.

---

## 4. Missing configuration → `CrashLoopBackOff`

```bash
kubectl apply -f troubleshooting/broken-config.yaml
```

**Symptom:** `CrashLoopBackOff`, with the restart count climbing.

**Investigate:**
```bash
kubectl get pods -n troubleshooting -l app=billing-worker
kubectl logs -n troubleshooting deploy/billing-worker --previous
#   FATAL: DATABASE_URL is not set — cannot connect to PostgreSQL
kubectl get secret billing-db -n troubleshooting            # NotFound
```

**Root cause:** the pod references the Secret `billing-db`, which doesn't exist. `optional: true` let the pod start without it, so the app crashed instead of the pod reporting `CreateContainerConfigError`.

**Fix:**
```bash
kubectl apply -f troubleshooting/fixed/broken-config.yaml
kubectl rollout restart deployment/billing-worker -n troubleshooting
kubectl logs -n troubleshooting deploy/billing-worker        # connected to ...
```

---

## 5. Memory limit too low → `OOMKilled`

```bash
kubectl apply -f troubleshooting/broken-oom.yaml
```

**Symptom:** the pod restarts repeatedly, and `kubectl get pods` shows `OOMKilled` and then `CrashLoopBackOff`.

**Investigate:**
```bash
kubectl describe pod -n troubleshooting -l app=report-generator | grep -A4 "Last State"
#   Last State: Terminated   Reason: OOMKilled   Exit Code: 137
kubectl get pod -n troubleshooting -l app=report-generator \
  -o jsonpath='{.items[0].spec.containers[0].resources}'
```

**Root cause:** the container allocates about 64 MiB against a 24 MiB limit. The kernel kills it, which shows up as exit code 137 (128 + SIGKILL).

**Fix:**
```bash
kubectl apply -f troubleshooting/fixed/broken-oom.yaml
kubectl top pod -n troubleshooting      # requires metrics-server
```

---

## Bonus: break the real app, live

These run against the actual StockPilot release and are good for the final demo.

```bash
# Database outage: readiness fails, pods leave the Service, liveness keeps them alive
kubectl scale statefulset stockpilot-postgresql -n stockpilot --replicas=0
kubectl get pods -n stockpilot -w                  # backend goes 0/1 READY, no restarts
kubectl scale statefulset stockpilot-postgresql -n stockpilot --replicas=1

# Bad release: Helm rollback
helm upgrade stockpilot ./helm/stockpilot -n stockpilot -f helm/stockpilot/values-dev.yaml \
  --set backend.image.tag=does-not-exist
helm history stockpilot -n stockpilot
helm rollback stockpilot -n stockpilot             # back to the previous revision
```
