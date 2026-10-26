## Requirements

### Requirement: Вход внутри UI
Система SHALL выполнять вход по seed-учётке через HTTP API и выдавать JWT без SMS/email.

#### Scenario: Успешный вход
- **WHEN** пользователь передаёт корректные логин и пароль в `POST /api/v1/auth/login`
- **THEN** API возвращает bearer token и профиль пользователя.

### Requirement: Ролевой доступ
Система SHALL разделять доступ клиента и банка и проверять владение заявкой.

#### Scenario: Клиент открывает банковский endpoint
- **WHEN** JWT с ролью `CLIENT` вызывает `/api/v1/bank/*`
- **THEN** API возвращает HTTP 403 и не раскрывает банковские данные.
