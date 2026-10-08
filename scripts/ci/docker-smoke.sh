#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/artifacts/ci/docker-smoke"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${BACKEND_PORT:?BACKEND_PORT is required}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required}"
: "${APP_JWT_SECRET:?APP_JWT_SECRET is required}"
: "${APP_EMPLOYEE_IDENTITY_KEY:?APP_EMPLOYEE_IDENTITY_KEY is required}"

mkdir -p "$ARTIFACT_DIR"

compose() {
  docker compose --project-directory "$ROOT_DIR" --file "$COMPOSE_FILE" "$@"
}

capture_failure_logs() {
  local raw_log="$ARTIFACT_DIR/docker-compose.raw.log"
  compose logs --no-color >"$raw_log" 2>&1 || true
  node "$ROOT_DIR/scripts/ci/redact-log.mjs" <"$raw_log" >"$ARTIFACT_DIR/docker-compose.log"
  rm -f "$raw_log"
}

cleanup() {
  local exit_code=$?
  set +e
  if [[ $exit_code -ne 0 ]]; then
    capture_failure_logs
  fi
  compose down --volumes --remove-orphans --timeout 20
  exit "$exit_code"
}
trap cleanup EXIT

compose build
compose up --detach --wait --wait-timeout 240

curl --fail --silent --show-error "http://127.0.0.1:$BACKEND_PORT/actuator/health" \
  | tee "$ARTIFACT_DIR/backend-health.json"
curl --fail --silent --show-error "http://127.0.0.1:$FRONTEND_PORT/health" \
  | tee "$ARTIFACT_DIR/frontend-health.txt"

FLYWAY_VERSION="$(compose exec --no-TTY \
  --env MYSQL_PWD="$MYSQL_PASSWORD" \
  mysql mysql --user="$MYSQL_USER" --database="$MYSQL_DATABASE" \
  --batch --skip-column-names \
  --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")"

if [[ "$FLYWAY_VERSION" != "24" ]]; then
  echo "Expected Docker smoke database at Flyway V24, got '$FLYWAY_VERSION'." >&2
  exit 1
fi

if ! compose logs --no-color backend | grep -q "Started LaundryManagementApplication"; then
  echo "Backend startup completion was not found in container logs." >&2
  exit 1
fi

echo "Docker Compose smoke test completed successfully at Flyway V$FLYWAY_VERSION."
