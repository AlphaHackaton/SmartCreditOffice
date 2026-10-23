#!/usr/bin/env bash
# Быстрая проверка одного файла после правки (быстрая петля обратной связи, ≤ ~10 с).
# Использование: scripts/quick-check.sh <путь-к-файлу>
set -uo pipefail
cd "$(dirname "$0")/.."
f="${1:?file}"
rel="${f#"$PWD"/}"
case "$rel" in
  backend/*.py)
    [ -f backend/pyproject.toml ] || exit 0
    p="${rel#backend/}"
    cd backend
    uv run ruff check "$p" --output-format=concise 2>&1 | tail -n 40; a=${PIPESTATUS[0]}
    uv run ruff format --check "$p" >/dev/null 2>&1 || echo "format: запусти 'uv run ruff format $p'"
    exit "$a" ;;
  frontend/*.ts|frontend/*.tsx)
    [ -f frontend/package.json ] || exit 0
    cd frontend
    npx eslint "${rel#frontend/}" --max-warnings=0 -f unix 2>&1 | tail -n 40; exit "${PIPESTATUS[0]}" ;;
  docker-compose.yml)
    command -v docker >/dev/null && docker compose config -q 2>&1 | tail -n 20 ;;
  openspec/changes/*)
    id="$(echo "$rel" | cut -d/ -f3)"
    openspec validate "$id" 2>&1 | tail -n 30 ;;
  *) exit 0 ;;
esac
