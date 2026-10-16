#!/usr/bin/env bash
# Generate CPU load on the backend from inside the cluster so the HPA scales out.
#
#   scripts/load-test.sh            # 8 workers for 5 minutes
#   WORKERS=12 DURATION=600 scripts/load-test.sh
#   scripts/load-test.sh stop
#
# Watch it:  kubectl get hpa -n stockpilot -w      (and the Grafana dashboard)
set -euo pipefail

NS="${NAMESPACE:-stockpilot}"
WORKERS="${WORKERS:-8}"
DURATION="${DURATION:-300}"
TARGET="${TARGET:-http://stockpilot-backend:8000}"

if [ "${1:-}" = "stop" ]; then
  kubectl delete pod -n "$NS" -l app=load-generator --ignore-not-found
  exit 0
fi

for i in $(seq 1 "$WORKERS"); do
  kubectl apply -n "$NS" -f - <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: load-generator-$i
  labels: {app: load-generator}
spec:
  restartPolicy: Never
  activeDeadlineSeconds: $DURATION
  securityContext:
    runAsNonRoot: true
    runAsUser: 65534
    seccompProfile: {type: RuntimeDefault}
  containers:
    - name: load
      image: busybox:1.37
      command: ["sh", "-c", "while true; do wget -q -O /dev/null $TARGET/api/stats; wget -q -O /dev/null '$TARGET/api/products?limit=200'; done"]
      securityContext:
        allowPrivilegeEscalation: false
        capabilities: {drop: [ALL]}
      resources:
        requests: {cpu: 10m, memory: 8Mi}
        limits: {cpu: 100m, memory: 32Mi}
YAML
done

echo "Started $WORKERS load generators for ${DURATION}s against $TARGET"
echo "Watch:  kubectl get hpa -n $NS -w"
echo "Stop:   $0 stop"
