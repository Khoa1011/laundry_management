#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(dirname -- "$SCRIPT_DIR")
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo 'Missing .env file. Copy .env.example to .env first.' >&2
  exit 1
fi

docker compose down
docker compose up -d --build --wait
docker compose ps

