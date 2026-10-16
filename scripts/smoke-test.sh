#!/usr/bin/env bash
# Exercise every API through the Ingress (or any base URL).
#   scripts/smoke-test.sh http://stockpilot.local:8081
set -euo pipefail

BASE="${1:-http://stockpilot.local:8081}"
HOST_HEADER=()
[ -n "${HOST_OVERRIDE:-}" ] && HOST_HEADER=(-H "Host: $HOST_OVERRIDE")
c() { curl -fsS ${HOST_HEADER[@]+"${HOST_HEADER[@]}"} "$@"; }
SKU="SMOKE-$(date +%s)"

echo "frontend  $(c -o /dev/null -w '%{http_code}' "$BASE/")"
echo "stats     $(c "$BASE/api/stats" | head -c 80)…"
ID=$(c -X POST "$BASE/api/products" -H 'Content-Type: application/json' \
  -d "{\"sku\":\"$SKU\",\"name\":\"Smoke test item\",\"quantity\":5,\"reorder_level\":2,\"unit_price\":1.5}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "created   product $ID ($SKU)"
c "$BASE/api/products/$ID" >/dev/null && echo "read      ok"
c -X PUT "$BASE/api/products/$ID" -H 'Content-Type: application/json' -d '{"location":"Z9-99"}' >/dev/null && echo "updated   ok"
c -X POST "$BASE/api/products/$ID/adjust" -H 'Content-Type: application/json' -d '{"change":-3,"reason":"sale"}' >/dev/null && echo "adjusted  ok"
c -X DELETE "$BASE/api/products/$ID" -o /dev/null && echo "deleted   ok"
echo "docs      $(c -o /dev/null -w '%{http_code}' "$BASE/docs")"
echo "Smoke test passed."
