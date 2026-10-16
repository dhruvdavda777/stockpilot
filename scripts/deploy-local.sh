#!/usr/bin/env bash
# Build both images, load them into kind and (re)deploy the Helm release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-stockpilot}"
VERSION="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"

echo "==> Building images (version $VERSION)"
docker build -t stockpilot-backend:local --build-arg APP_VERSION="$VERSION" "$ROOT/backend"
docker build -t stockpilot-frontend:local --build-arg VITE_APP_VERSION="$VERSION" --build-arg VITE_APP_ENV=dev "$ROOT/frontend"

echo "==> Loading images into kind cluster '$CLUSTER'"
kind load docker-image stockpilot-backend:local stockpilot-frontend:local --name "$CLUSTER"

echo "==> Deploying Helm release"
kubectl apply -f "$ROOT/k8s/namespace.yaml"
helm upgrade --install stockpilot "$ROOT/helm/stockpilot" \
  --namespace stockpilot \
  -f "$ROOT/helm/stockpilot/values-dev.yaml" \
  --set backend.image.tag=local --set frontend.image.tag=local \
  --wait --timeout 5m

# Same tag every build, so force pods to pick up the newly loaded image.
kubectl rollout restart deployment -n stockpilot -l app.kubernetes.io/instance=stockpilot
kubectl rollout status deployment -n stockpilot -l app.kubernetes.io/instance=stockpilot --timeout=180s

helm test stockpilot -n stockpilot --logs
