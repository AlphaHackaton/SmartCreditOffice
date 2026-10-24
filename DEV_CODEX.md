# Разработка через Codex

Среда подготовлена 25.10.2026 для Dev 3 (Frontend / UX).

## Что установлено

- Node.js 24.21.0, npm 11.19.0.
- OpenSpec CLI 1.15.0 (глобальный npm-пакет `@fission-ai/openspec`).
- uv 0.13.5, управляемый Python 3.12.15, зависимости `backend/uv.lock` в `backend/.venv`.
- Шесть официальных навыков OpenSpec в `~/.agents/skills/openspec-*`.
- MCP-сервер `smartcredit-harness` в пользовательской конфигурации Codex. Он привязан к абсолютному пути этого репозитория.

Перезапусти Codex, если новые навыки или инструменты ещё не появились. Навыки установлены для пользователя; они не поставляются с приложением и доступны также в других проектах.

## Рабочий цикл

1. Прочитать AGENTS.md. При необходимости выбрать навык `openspec-explore`.
2. Выбрать `openspec-propose` и описать фичу. Просмотреть proposal, specs, design и tasks. На этом шаге код не пишется.
3. Выбрать `openspec-apply-change` и указать изменение для реализации.
4. После правок вызывать `harness_quick_check` с параметром `path`; перед завершением — `harness_check`. Требуется `exit 0`.
5. После проверки выбрать `openspec-archive-change` для завершения изменения.

Можно просить обычным языком: «Используй openspec-propose, подготовь изменение frontend-shell, пока без реализации». В CLI/IDE навыки также вызываются через `$openspec-propose` и `$openspec-apply-change`.

Артефакты общие с OpenCode: `openspec/`. Настройки OpenCode сохраняются. В конфигурации проекта уже заданы русский язык и требования кейса.

## Проверка среды

```bash
openspec --version
openspec list --json
openspec doctor --json
uv --version
backend/.venv/bin/python --version
codex mcp get smartcredit-harness
bash scripts/check.sh
```

Проверки используют кеш uv в `tmp/uv-cache`, доступный песочнице. Для ручных команд в песочнице:

```bash
export UV_CACHE_DIR="$PWD/tmp/uv-cache"
uv sync --project backend --locked
```

## Восстановление подключения проверок

Из корня проекта:

```bash
codex mcp add smartcredit-harness -- "$(command -v node)" "$PWD/scripts/harness-mcp.mjs"
```

Если имя уже зарегистрировано, сначала проверь `codex mcp get smartcredit-harness`. Не удаляй другие серверы. MCP запускает существующие shell-проверки без дополнительных npm-зависимостей. Быстрая проверка принимает только пути внутри проекта.

## Frontend

`frontend-shell` реализован: `cd frontend && npm ci && npm run dev`. Маршруты и API-слой описаны в frontend/README.md. Это предварительный просмотр без реального входа и банковских операций.

## Что ещё отсутствует в проекте

- API-сервер `backend/app/main.py`, OpenAPI и Docker Compose проекта. Поэтому текущая проверка явно пропускает отсутствующие части. Зелёная проверка подтверждает доменный backend и frontend-каркас, а не готовность сквозного приложения целиком.
- Доступ к Docker daemon: CLI и Compose установлены, но `docker info` возвращает permission denied для `/var/run/docker.sock`, в том числе вне песочницы. Нужно проверить Docker в обычном терминале хоста; если ошибка сохраняется, настроить доступ средствами ОС. Не менять права сокета на общедоступные.

`.env.example` пока содержит только закомментированный шаблон необязательного LLM. Настройки БД и API добавляет Dev 2 вместе с соответствующей реализацией.

Существующие локальные правила `.gitignore` скрывают новые файлы в `docs/` и `openspec/`. Они сохранены: артефакты frontend-shell адресно включены в Git. Для новых артефактов нужно проверять исключения, иначе файлы не попадут в обычный `git add`.
