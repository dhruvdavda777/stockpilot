#!/bin/sh
set -e

# Apply pending migrations before serving traffic. Safe with many replicas:
# alembic/env.py takes a PostgreSQL advisory lock while migrating.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
fi

exec "$@"
