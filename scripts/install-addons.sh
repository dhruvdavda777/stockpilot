#!/usr/bin/env bash
# Install cluster add-ons the app depends on: ingress-nginx, metrics-server (for HPA)
# and kube-prometheus-stack (Prometheus Operator + Grafana).
#
#   scripts/install-addons.sh kind   # local kind cluster
#   scripts/install-addons.sh eks    # AWS EKS cluster from terraform/
set -euo pipefail

TARGET="${1:-kind}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

INGRESS_NGINX_VERSION=4.15.1
METRICS_SERVER_VERSION=3.14.0
KUBE_PROMETHEUS_STACK_VERSION=92.9.0

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update >/dev/null

echo "==> kube-prometheus-stack (first, so its CRDs exist for the ServiceMonitors below)"
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --version "$KUBE_PROMETHEUS_STACK_VERSION" \
  --namespace monitoring --create-namespace \
  -f "$ROOT/monitoring/kube-prometheus-stack-values.yaml" \
  --wait --timeout 10m

echo "==> ingress-nginx"
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --version "$INGRESS_NGINX_VERSION" \
  --namespace ingress-nginx --create-namespace \
  -f "$ROOT/k8s/addons/ingress-nginx-$TARGET.yaml" \
  --wait --timeout 5m

echo "==> metrics-server"
METRICS_ARGS=()
[ "$TARGET" = "kind" ] && METRICS_ARGS=(-f "$ROOT/k8s/addons/metrics-server-kind.yaml")
helm upgrade --install metrics-server metrics-server/metrics-server \
  --version "$METRICS_SERVER_VERSION" \
  --namespace kube-system ${METRICS_ARGS[@]+"${METRICS_ARGS[@]}"} \
  --wait --timeout 5m

if [ "$TARGET" = "eks" ]; then
  echo "==> gp3 StorageClass"
  kubectl apply -f "$ROOT/k8s/storageclass-gp3.yaml"
fi

echo "Add-ons installed."
