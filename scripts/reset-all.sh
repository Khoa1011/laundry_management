#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(dirname -- "$SCRIPT_DIR")
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo 'Missing .env file. Copy .env.example to .env first.' >&2
  exit 1
fi

echo 'WARNING: This permanently deletes all local MySQL data for this Compose project.' >&2
printf 'Type DELETE to remove containers and volumes: '
read -r confirmation

if [ "$confirmation" != 'DELETE' ]; then
  echo 'Reset cancelled. No volumes were deleted.'
  exit 0
fi

docker compose down -v --remove-orphans
echo 'Local containers and MySQL data were deleted.'

