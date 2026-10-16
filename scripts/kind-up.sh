#!/usr/bin/env bash
# One command to a full local platform: kind cluster + add-ons + StockPilot.
#   scripts/kind-up.sh
# Then add "127.0.0.1 stockpilot.local" to /etc/hosts and open http://stockpilot.local:8081
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-stockpilot}"

if ! kind get clusters | grep -qx "$CLUSTER"; then
  echo "==> Creating kind cluster '$CLUSTER'"
  kind create cluster --config "$ROOT/k8s/kind/cluster.yaml" --name "$CLUSTER" --wait 120s
fi
kubectl config use-context "kind-$CLUSTER"

"$ROOT/scripts/install-addons.sh" kind
"$ROOT/scripts/deploy-local.sh"

cat <<MSG

StockPilot is up.
  App:        http://stockpilot.local:8081        (needs: echo "127.0.0.1 stockpilot.local" | sudo tee -a /etc/hosts)
  Swagger:    http://stockpilot.local:8081/docs
  Grafana:    kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80       -> http://localhost:3001 (admin / stockpilot-admin)
  Prometheus: kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
  Load test:  scripts/load-test.sh   then   kubectl get hpa -n stockpilot -w
MSG
