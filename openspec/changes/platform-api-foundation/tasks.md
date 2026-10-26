## 1. Contract-first stub

- [x] Создать `backend/app/main.py`, settings, API schemas, ErrorDTO и health/demo routers; проверка: импорт `app.main` без БД и тесты `TestClient`.
- [x] Добавить `ApplicationServicePort` и in-memory stub для login, profile и базового жизненного цикла заявки; проверка: API-тест create → submit → decision.
- [x] Экспортировать `docs/openapi.json` и зафиксировать контракт; проверка: команда из `scripts/check.sh`.

## 2. Infrastructure and persistence

- [x] Добавить Dockerfile, Compose, `.env.example`, PostgreSQL settings и healthcheck; проверка: `docker compose config -q`.
- [x] Добавить SQLAlchemy base/session/models и Alembic initial migration; проверка: migration upgrade в Compose.
- [x] Добавить repositories, status history и optimistic version conflict; проверка: сервисные тесты с fake session/PostgreSQL.

## 3. Auth, mocks and real service

- [x] Добавить JWT auth, bcrypt seed users, dependencies и CLIENT/BANK RBAC; проверка: API-тесты 401/403/ownership.
- [x] Добавить registry и моки ФНС, БКИ, account и core banking на `personas.json`; проверка: mock tests для шести персон.
- [x] Подключить real application service, фоновой scoring runner и OTP signing; проверка: API E2E create → submit → score → sign → disburse.
- [x] Добавить bank queue/dossier/decision/rescore/metrics и audit log; проверка: bank E2E и запрет утечки клиентских данных.

## 4. Delivery

- [x] Прогнать `scripts/check.sh`, обновить `docs/openapi.json` и `THIRD_PARTY_NOTICES.md`; проверка: exit 0.
