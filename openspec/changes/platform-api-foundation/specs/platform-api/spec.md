## Requirements

### Requirement: Запускаемый API entrypoint
Система SHALL предоставлять `app` и `create_app()` в `backend/app/main.py`, не подключаясь к БД при импорте.

#### Scenario: Импорт приложения без инфраструктуры
- **WHEN** выполняется `python -c "from app.main import app"` без PostgreSQL
- **THEN** импорт завершается успешно и приложение содержит маршруты `/api/v1`.

### Requirement: Stub contract
Система SHALL поддерживать stub-режим с теми же DTO и путями, что и real-режим.

#### Scenario: Проверка health и персон
- **WHEN** клиент вызывает `GET /api/v1/health` и `GET /api/v1/demo/personas` в `APP_MODE=stub`
- **THEN** API возвращает HTTP 200 и детерминированные данные из seed-персон.

### Requirement: Сквозные исходы
Сервис SHALL поддерживать исходы `APPROVED`, `COUNTER_OFFER`, `REJECTED` и возвращать объяснение решения.

#### Scenario: Демо-профиль получает решение
- **WHEN** заявка демо-персоны отправляется на скоринг
- **THEN** ответ содержит исход, статус, факторы и офферы согласно ожидаемому профилю.

### Requirement: Единые ошибки
API SHALL возвращать ошибки в форме `{code, message, details}`.

#### Scenario: Ошибка доменного перехода
- **WHEN** команда пытается выполнить недопустимый переход
- **THEN** API возвращает подходящий HTTP 409 и структурированный ErrorDTO.
