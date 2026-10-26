# Frontend: оставшиеся фичи №12–14

Статус на 25.10.2026: №1–11 реализованы и архивированы; следующие изменения **только спланированы**. Наличие всех OpenSpec-артефактов не означает реализацию: ни одна задача ниже не выполнена. Пользователь явно поручил пока не писать код.

Источники: [SPEC](../docs/SPEC_FOR_AGENT.md), [архитектура Dev 3](../docs/ARCHITECTURE.md#dev-3-фронтенд-оба-контура), [текущая реализация](../frontend/README.md). Номера соответствуют исходному frontend-бэклогу.

| Порядок | Change / подробные требования | Дизайн | Задачи | Зависимость |
|---|---|---|---|---|
| 12 | [Досье, трасса, решение и аудит](changes/frontend-bank-dossier-decisions/specs/demo-bank-dossier/spec.md) | [design](changes/frontend-bank-dossier-decisions/design.md) | [8 задач](changes/frontend-bank-dossier-decisions/tasks.md) | готовые №1–11 |
| 13 | [Метрики конвейера](changes/frontend-bank-pipeline-metrics/specs/bank-pipeline-metrics/spec.md) | [design](changes/frontend-bank-pipeline-metrics/design.md) | [7 задач](changes/frontend-bank-pipeline-metrics/tasks.md) | №12: общий store/история/аудит |
| 14 | [Сценарии, ошибки и песочница](changes/frontend-demo-scenarios-and-failure-recovery/specs/demo-scenario-controls/spec.md) | [design](changes/frontend-demo-scenarios-and-failure-recovery/design.md) | [10 задач](changes/frontend-demo-scenarios-and-failure-recovery/tasks.md) | №12 и №13 |

## №12 — завершить банковский путь

Адресуемое досье, snapshots ФНС/БКИ/оборотов, bins/points/rules и политика; обязательный комментарий, подтверждение, три исхода только из UNDERWRITING; готовые офферы без JS-арифметики, audit override и атомарная version. Проверить P6 live → bank → client → подпись/выдача. Для обязательного COUNTER_OFFER есть проверенный Python review-вариант P6 CAPEX 6 млн/24. Seed-* примеры не должны внезапно становиться клиентскими заявками. Дополнительно [дельта существующей очереди](changes/frontend-bank-dossier-decisions/specs/demo-bank-queue/spec.md).

Replay — сверка подготовленного прогона, не новый скоринг: текущая FSM не разрешает UNDERWRITING→SCORING. Не обещать runtime evaluate без API. Детали и ошибки — в requirements/design.

## №13 — сделать показатели проверяемыми

Единые определения cohort по createdAt, трёх исходов и текущих статусов. STP — automatic/decided, ручной исход не становится автоматическим при совпадении с рекомендацией. Mean/p95 от первой подачи до первого решения; null при пустой выборке, ошибки timestamps видны отдельно. Product/date/source фильтры, asOf, drill-down по status в очередь с URL/Back. Операционные показатели допустимо считать в mock-адаптере; финансовая арифметика остаётся Python.

## №14 — воспроизводимое демо и негативные сценарии

Каталог P1–P6 и подготовленных стадий, подтверждённый launch/reset, адресные one-shot ошибки/сеть/задержка, проверки late responses и двойных кликов. Bank-only sandbox с конечной Python-сеткой входов/политик и отдельным readonly-результатом; не создаёт заявки/решения/метрики. Произвольный ввод без подготовленного расчёта явно недоступен. Нет внешних сообщений, данных и сервисов.

## Отдельный интеграционный шлюз с Dev 2

Эти три изменения готовят mock-first UI. До публикации API не создавать ручную schema.d.ts и фиктивный docs/openapi.json. Для настоящего HTTP остаётся [API_HANDOFF](changes/archive/2026-10-25-frontend-client-flow/API_HANDOFF.md):

1. Получить работающий stub и OpenAPI: auth/me, клиентские команды, bank dossier/decision/rescore/metrics, demo/reset. Согласовать version/idempotency, TTL, error fields, replay semantics и определения KPI.
2. Выполнить gen:api, создать отдельный HTTP gateway mapping из generated DTO. Не менять Python FSM/risk policy ради обхода интеграции.
3. Проверить ролевую изоляцию сервером: client не получает bank inputs/audit; чужие заявки скрыты; 401/403/404/409/422 и abort/network корректны.
4. Повторить P1/P2/P3/P4/P5/P6 и P6 review-counter через HTTP, проверить acceptance/signature/disbursement, решение/audit/metrics/reset, отсутствие mock fallback.
5. Зафиксировать результаты интеграции, реальный OpenAPI, сборку/Compose и ограничения. Mock-тесты этот шлюз не закрывают. Отсутствующий API не блокирует работу над указанными конечными mock-сценариями.

## Применение и завершение

Применять по одному change через openspec-apply-change после отдельного запроса на реализацию. Для каждой задачи — quick-check и harness_check exit0 перед отметкой выполнения. После завершения — browser1280/1440, build, regression; только затем синхронизировать delta specs и архивировать. Пока изменения активны, main specs сохраняют контракт уже реализованных №1–11.
