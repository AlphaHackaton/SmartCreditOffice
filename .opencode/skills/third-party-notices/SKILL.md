---
name: third-party-notices
description: Use when dependencies changed or before delivery. Rebuilds THIRD_PARTY_NOTICES.md from uv.lock and package-lock.json (name, version, license), plus a section for open-weights models and mocks.
---

# Пересборка THIRD_PARTY_NOTICES.md

Обязательный файл по требованию хакатона (SPEC §5 Q71, §6). Обновляй при любой смене зависимостей.

## Структура файла

1. Заголовок: проект, дата генерации, как воспроизвести.
2. Раздел Backend (Python): из `backend/uv.lock`.
3. Раздел Frontend (npm): из `frontend/package-lock.json` (только прямые зависимости + их транзитивные, транзитивные отдельным подсписком).
4. Раздел «Модели и моки»: происхождение open-weights моделей (ссылка на Hugging Face), версия; локальные моки (ФНС, БКИ, выручка) с пометкой «synthetic data, no real integration».

## Команды

Backend:
- `cd backend && uv export --format requirements-txt --no-hashes` — список пакетов с версиями.
- Лицензии: `uv run python -c "import importlib.metadata as m; [print(p.name, p.version, (m.metadata(p.name).get('License') or m.metadata(p.name).get('License-Expression') or 'UNKNOWN')) for p in m.distributions()]"` (выполнять в venv проекта).

Frontend:
- `cd frontend && npm ls --json --all` — дерево.
- `npx license-checker --summary` и `npx license-checker --json` (если нет сети — взять поле `license` из package-lock.json `packages.*.license`).

## Правила

- Для каждого пакета: имя, версия, лицензия, ссылка на репозиторий (если есть в метаданных).
- Пакеты без лицензии помечай `UNKNOWN — проверить вручную`.
- Не включай dev-зависимости, если они не попадают в docker-образ (помети: «dev-only, в поставку не входят»).
- После обновления закоммить файл вместе с lock-файлом одним коммитом.
