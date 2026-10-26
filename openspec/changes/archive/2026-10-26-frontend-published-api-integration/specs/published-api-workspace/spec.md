# Spec Delta

## Purpose

Завершить frontend по опубликованному API Dev 2 с доменным конвейером и локальными синтетическими внешними источниками.

## ADDED Requirements

### Requirement: Контракт и транспорт
API-mode SHALL использовать generated OpenAPI DTO, /api/v1, корректный per-request Bearer, безопасные ErrorDTO/detail/validation. 401 SHALL завершать только соответствующую сессию; fallback SHALL отсутствовать.

#### Scenario: Реальный вход
- **WHEN** login и me подтверждают CLIENT/BANK
- **THEN** UI открывает соответствующий контур и очищает старый кеш

### Requirement: Клиентский путь
Клиент SHALL читать профиль/каталог/свои заявки, создавать и редактировать DRAFT, submit с version после локальных согласий. Повтор submit SHALL сохранять id. Решение/офферы/история SHALL приходить с сервера. Симулятор SHALL использовать debounce300 и отменять устаревшие ответы без финансовой арифметики в JS.

#### Scenario: Черновик и решение
- **WHEN** пользователь сохраняет, редактирует и подаёт заявку
- **THEN** PATCH и submit используют актуальную version, поллинг показывает действительное решение

### Requirement: Подписание и выдача
Принятие SHALL передавать actual offer_id/version после подтверждения, показать код/срок SigningChallenge внутри UI и sign с актуальной version. Только DISBURSED SHALL означать выдачу. Reload SIGNING SHALL честно сообщать отсутствие восстановления кода. Cancel SHALL подтверждаться.

#### Scenario: Сквозной путь
- **WHEN** клиент принимает оффер и вводит код API
- **THEN** sign отправляет только code, а UI ждёт подтверждённый DISBURSED

### Requirement: Банковский контур
Bank SHALL получать queue/dossier/scoring-runs/metrics и подтверждать decision/rescore. SHALL показывать факторы, policy, raw inputs/result, audit без seed. Метрики SHALL ограничиваться опубликованными счётчиками, sandbox/replay не имитируются.

#### Scenario: Ручное решение
- **WHEN** сотрудник подтверждает решение UNDERWRITING
- **THEN** API получает outcome/comment, досье/очередь/метрики перечитываются

### Requirement: Запуск и проверка
Frontend SHALL собираться в nginx Docker и входить в compose, /api SHALL проксироваться без CORS. Reset SHALL вызывать сервер только после подтверждения. HTTP smoke SHALL проверять client lifecycle и доступ по ролям; UI tests SHALL покрывать retry/версии/OTP/симулятор. PostgreSQL недоступность SHALL быть явно отражена в отчёте.

#### Scenario: Изоляция
- **WHEN** logout/reset/смена режима происходят во время запроса
- **THEN** поздний ответ не восстанавливает прежние данные и действия
