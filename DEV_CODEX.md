# Разработка через Codex

Среда подготовлена 25.10.2026 для Dev 3 (Frontend / UX).

## Откуда продолжать

Рабочая ветка — `codex/frontend-development`. Она сохраняет frontend-фичи 1–14 и объединена с завершённым backend Dev 2 из `origin/main` (`2cf159e`). HTTP-интеграция оформлена change `frontend-published-api-integration`; исходные ветки сохранены.

`openspec doctor --json` должен показывать healthy. Конфигурация `openspec/config.yaml` сохранена при слиянии: русский язык, правила SPEC и обязательные проверки продолжают действовать. Удаление общей OpenCode-конфигурации из main принято; навыки OpenSpec и MCP для Codex от неё не зависят. Пользовательские локальные настройки OpenCode сохранены отдельно и не входят в коммит среды.

## Ежедневный запуск

Из корня проекта:

```bash
npm run dev --prefix frontend
```

Открыть http://localhost:5173. Vite использует фиксированный порт и проксирует `/api` на `http://localhost:8000`; занятый порт не подменяется автоматически. Основной режим API: отдельно запустите APP_MODE=stub uv run --project backend uvicorn app.main:app --app-dir backend --reload. PostgreSQL и LLM для него не нужны. VITE_DATA_MODE=mock включает автономное frontend-демо.

Проверки перед коммитом:

```bash
bash scripts/check.sh
npm run build --prefix frontend
openspec validate --specs --strict
```

Если зависимости удалены или изменились lock-файлы:

```bash
npm ci --prefix frontend --cache "$PWD/tmp/npm-cache"
UV_CACHE_DIR="$PWD/tmp/uv-cache" uv sync --project backend --locked
```

Локальный `.env` создан из `.env.example`, если его не было; существующий файл не перезаписывается. LLM выключен пустыми параметрами. DATABASE_URL — шаблон для будущей платформы; нынешнее доменное ядро эти параметры не читает. `.env` не включать в Git.

## Что установлено

- Node.js 24.21.0, npm 11.19.0.
- OpenSpec CLI 1.15.0 (глобальный npm-пакет `@fission-ai/openspec`).
- uv 0.13.5, управляемый Python 3.12.15, зависимости `backend/uv.lock` в `backend/.venv`.
- Hypothesis 6.170.9 и sortedcontainers 2.4.0 для новых тестов домена; версии заданы lock-файлом main.
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

Артефакты проекта находятся в `openspec/`; основные specs меняются через archive. Новые возможности сначала оформляются отдельным change, затем реализуются. Архивированный `frontend-client-flow` содержит 11 незавершённых задач: архивация не означает, что вход и кредитный путь уже реализованы.

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

Реализованы каркас, маршрутизация, API-транспорт, генератор типов, форматирование и общие компоненты; также все запланированные фичи 1–14 в явном mock-режиме: вход/роли, статусы/история, кабинет, черновики/подача и страница заявки с поллингом; причины/офферы, демо-подпись/выдача, симуляция Python, отказ/ручное рассмотрение, очередь сотрудника; кредитное досье/скоринговая трасса/ручное решение/аудит (№12), операционные метрики конвейера/drilldown (№13) и каталог 12 сценариев, адресный инжектор сбоев и песочница скоринга (№14). Демо-учётки p1…p6 и underwriter, пароль demo. Задержки, ошибки и сброс доступны в UI. В Mock это демонстрационная авторизация в памяти; API-режим использует JWT сервера (без сохранения в localStorage). Подробности — frontend/README.md.

Порядок Dev 3 — `docs/ARCHITECTURE.md`, раздел «Dev 3: фронтенд (оба контура)» (строка 621). Интеграция завершена под main 2cf159e: все 21 HTTP-операция, generated schema.d.ts, HTTP views без seed fallback и полноценный клиентский путь. Текущее описание запуска/ограничений и воспроизводимый smoke: frontend/README.md. Богатые Mock sandbox/replay/presets остаются отдельным демонстрационным режимом, поскольку backend не публикует эти методы.

В main уже доступны доменные enum/FSM, evaluate/simulate/pre_approve, объяснения факторов, готовые финансовые значения и golden-примеры в `backend/tests/domain/golden/`. Это материалы доменного контракта и тестов; они не заменяют экспорт HTTP API. Финансовые вычисления остаются в backend, денежные значения во frontend — строками.

Планы №12–14 завершены и синхронизированы в OpenSpec: [FRONTEND_ROADMAP.md](openspec/FRONTEND_ROADMAP.md). Все задачи полностью реализованы.

## Что ещё отсутствует в проекте

- Проверка Docker build/run и PostgreSQL E2E в этой среде: API/OpenAPI/Compose уже есть, но Docker socket недоступен. Harness честно сообщает 3 PostgreSQL skips; локальный HTTP stub smoke проходит.
- Доступ к Docker daemon: CLI и Compose установлены, но `docker info` возвращает permission denied для `/var/run/docker.sock`, в том числе вне песочницы. Нужно проверить Docker в обычном терминале хоста; если ошибка сохраняется, настроить доступ средствами ОС. Не менять права сокета на общедоступные.

`.env.example` содержит psycopg DATABASE_URL и пустые параметры необязательного LLM. APP_MODE=real docker compose up --build запускает PostgreSQL+API+frontend при доступном Docker; http://localhost:8080. Для работы без Docker — APP_MODE=stub API и Vite :5173.

Правила main скрывают `openspec/` и локальную `.opencode/`, но не весь `docs/`. Основные specs и архив уже отслеживаются. Новые OpenSpec-артефакты добавлять адресно через `git add -f openspec/changes/<id>/...`; перед коммитом проверять `git status` и `git diff --cached`.
