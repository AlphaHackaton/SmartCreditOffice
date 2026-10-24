## Why

Сейчас в репозитории есть доменный контур, но отсутствует запускаемый backend, через который frontend сможет пройти сквозной сценарий кредитования. Нужен стабильный HTTP-контракт и платформенный слой, чтобы параллельно разрабатывать UI, а затем без смены API подключить PostgreSQL, моки и скоринговый сервис. Основание: SPEC §4 (сквозной сценарий), §5 Q33, Q42, Q53, Q62, Q69, Q73 и §6.

## What Changes

- Добавить FastAPI entrypoint `backend/app/main.py` и REST API `/api/v1`.
- Зафиксировать DTO, enum-контракт, единый формат ошибок и экспорт OpenAPI.
- Добавить in-memory stub service для демо и разработки frontend без БД.
- Добавить настройки, Docker Compose, healthcheck и PostgreSQL runtime.
- Добавить SQLAlchemy-модели, Alembic-миграцию и репозитории заявок с историей статусов.
- Добавить JWT-аутентификацию, seed-пользователей и RBAC `CLIENT`/`BANK`.
- Добавить детерминированные локальные моки ФНС, БКИ, счёта и АБС на данных персон.
- Подключить реальный application service к доменному скорингу, фоновой обработке, OTP-подписанию и банковскому контуру.

## Capabilities

### New Capabilities

- `platform-api`: HTTP-контракт и сервисный boundary кредитного конвейера.
- `credit-persistence`: хранение заявок, решений, офферов, истории и аудита.
- `demo-integrations`: детерминированные моки внешних систем и демо-персоны.
- `user-authentication`: вход внутри UI, JWT и ролевые ограничения.

### Modified Capabilities

- Нет.

## Impact

Затрагиваются `backend/app`, Alembic, `docker-compose.yml`, `.env.example`, `docs/openapi.json`, lock-файл и тесты API/сервисов. Вне скоупа: frontend, изменение доменной математики скоринга и FSM, реальные внешние интеграции, SMS/email, OCR и платные runtime API.
