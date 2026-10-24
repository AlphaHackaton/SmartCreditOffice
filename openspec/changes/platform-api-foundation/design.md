## Контекст и границы

Dev 2 предоставляет один HTTP-контракт для stub и real режимов. Домен (`app.domain`) остаётся чистым Python без FastAPI, SQLAlchemy и моков. Роутеры вызывают `ApplicationServicePort`; выбор реализации выполняется через настройки.

## API

Префикс: `/api/v1`. Минимальный первый срез:

- `GET /health` — состояние процесса.
- `GET /demo/personas` — список синтетических профилей без авторизации.
- `POST /auth/login`, `GET /auth/me` — вход и текущий пользователь.
- `GET /products`, `GET /companies/me` — продукт и профиль клиента.
- `GET|POST /applications`, `PATCH /applications/{id}` — draft заявки.
- `POST /applications/{id}/submit|simulate|accept|sign|cancel` — команды клиента.
- `GET /bank/applications`, `GET /bank/applications/{id}` — очередь и dossier.
- `POST /bank/applications/{id}/decision|rescore`, `GET /bank/metrics` — банк.

DTO используют enum из `app.domain.enums`. Денежные значения — `Decimal`, в JSON — строки. Ошибки имеют форму `{code, message, details}`. Клиент видит только свои заявки; `/bank/*` требует роль `BANK`.

## Сервисный слой

`ApplicationServicePort` реализуется `StubApplicationService` и `ApplicationService`. Stub хранит состояние в памяти и возвращает те же DTO, позволяя frontend работать без БД. Реальный сервис выполняет переходы только через `domain.application_status.transition`, сохраняет историю в одной транзакции и использует optimistic `version`.

## Данные

PostgreSQL 16 и SQLAlchemy 2. Основные таблицы: users, companies, products, applications, status_history, scoring_runs, offers, signatures, audit_log. Alembic создаёт схему; импорт `app.main` не открывает соединение.

## Моки и безопасность

Моки читают `backend/app/seed/personas.json`, не ходят в сеть и детерминированы по ИНН/ID. JWT содержит user id и role. Пароли seed-пользователей хранятся только как bcrypt-хэши. OTP показывается внутри UI, хранится в виде хэша, ограничен TTL и числом попыток.

## Проверка

Stub API тестируется без БД. Репозитории — с PostgreSQL из Compose. `scripts/check.sh` обязан импортировать `app.main`, экспортировать `docs/openapi.json`, пройти lint, types и tests.
