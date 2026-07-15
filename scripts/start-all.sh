#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(dirname -- "$SCRIPT_DIR")
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker was not found. Install Docker Engine or Docker Desktop first.' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo 'The Docker Compose plugin is unavailable.' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo 'Docker Engine is not running.' >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo 'Missing .env file.' >&2
  echo 'Create it with: cp .env.example .env' >&2
  echo 'Then review the local database passwords before starting.' >&2
  exit 1
fi

docker compose up -d --build --wait
docker compose ps

frontend_port=$(sed -n 's/^FRONTEND_PORT=//p' .env | tail -n 1)
backend_port=$(sed -n 's/^BACKEND_PORT=//p' .env | tail -n 1)
frontend_port=${frontend_port:-5173}
backend_port=${backend_port:-8080}

echo "Frontend: http://localhost:${frontend_port}"
echo "Backend health: http://localhost:${backend_port}/actuator/health"

