#!/usr/bin/env bash
# Полная проверка проекта. Exit 0 = можно закрывать задачу/коммитить.
# Каталоги, которых ещё нет, пропускаются — скрипт работает с первого дня.
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0
step() { echo; echo "=== $1 ==="; }
run()  { "$@" 2>&1 | tail -n 60; local rc=${PIPESTATUS[0]}; [ "$rc" -ne 0 ] && { echo "!! FAILED ($rc): $*"; FAIL=1; }; return 0; }

if [ -f backend/pyproject.toml ]; then
  step "backend: ruff";   run bash -c "cd backend && uv run ruff check . && uv run ruff format --check ."
  step "backend: mypy";   run bash -c "cd backend && uv run mypy app"
  step "backend: pytest"; run bash -c "cd backend && uv run pytest -q -x"
  step "backend: openapi export"
  if [ -f backend/app/main.py ]; then
    run bash -c "cd backend && uv run python -c 'import json;from app.main import app;print(json.dumps(app.openapi(),ensure_ascii=False,indent=2))' > ../docs/openapi.json"
  else
    echo "SKIP openapi export (нет backend/app/main.py, создаётся Dev 2)"
  fi
else echo "SKIP backend (нет backend/pyproject.toml)"; fi

if [ -f frontend/package.json ]; then
  step "frontend: eslint"; run bash -c "cd frontend && npx eslint . --max-warnings=0"
  step "frontend: tsc";    run bash -c "cd frontend && npx tsc --noEmit -p ."
  step "frontend: vitest"; run bash -c "cd frontend && npx vitest run --passWithNoTests"
else echo "SKIP frontend (нет frontend/package.json)"; fi

if [ -f docker-compose.yml ]; then
  step "compose config"
  if command -v docker >/dev/null; then run docker compose config -q; else echo "SKIP (docker не установлен)"; fi
fi

step "deliverables"
for f in README.md THIRD_PARTY_NOTICES.md .env.example; do [ -f "$f" ] || echo "WARN: нет $f"; done
if grep -rInE "api\.openai\.com|anthropic\.com|gigachat|ocr\.api\.cloud\.yandex" backend frontend --include='*.py' --include='*.ts' --include='*.tsx' 2>/dev/null; then
  echo "!! FAILED: найден вызов запрещённого платного API"; FAIL=1
fi

echo
[ "$FAIL" -eq 0 ] && echo "RESULT: OK" || echo "RESULT: FAIL"
exit $FAIL
