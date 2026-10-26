# Proposal

## Why

Dev 2 завершил platform-api-foundation (main 2cf159e). Пользователь поручил закончить frontend и полностью интегрировать опубликованный API. Основание: SPEC §4, §5 Q4/Q5/Q6/Q11/Q37/Q43/Q69/Q73, ARCHITECTURE Dev 3 (строки 621–690). Ранняя интеграция 12 операций устарела после появления полного клиентского пути.

## What Changes

- Объединить main, обновить generated TS и typed transport с Bearer, безопасными ошибками и изоляцией сессий.
- Подключить профиль/каталог/черновики/PATCH/submit, симулятор, реальные офферы, accept→код в UI→sign→DISBURSED, cancel и reset.
- Подключить очередь, досье, scoring-runs, decision/rescore и шесть серверных метрик без вымышленных полей.
- Сохранить отдельный Mock и отсутствие fallback. Production nginx + Docker frontend с /api proxy; команды запуска и ограничения документировать.
- Исправлять обнаруженные контрактные ошибки запуска узко, без изменения скоринговых правил/FSM.

## Capabilities

### New Capabilities
- `published-api-workspace`: полный frontend для опубликованного HTTP контракта.

### Modified Capabilities
Нет. Богатая mock-песочница/replay не объявляются серверными возможностями.

## Impact

Frontend API/UI/tests/build/container, compose frontend, generated OpenAPI types, документация и минимальные исправления совместимости backend при необходимости. Новые frontend зависимости не нужны.

## Вне скоупа

Новые бизнес-API, новые модели/скоринг, внешние системы, SMS/email, deploy/push. Нет API sandbox/replay и восстановления signing challenge после reload; эти ограничения показываются явно. PostgreSQL проверять при доступности Docker, не менять права пользователя/хоста.
