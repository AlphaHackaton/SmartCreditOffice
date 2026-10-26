# Design

## Context

Зависимость: frontend-bank-dossier-decisions (№12) — единый store, example/session и фактические события решения. Сейчас MetricsPage отсутствует, маршрут показывает PlaceholderPage. queue содержит шесть seed-* примеров плюс live; gateway.metrics нет. Определения KPI ниже — продуктовые решения для демо, а не существующий HTTP-контракт. Требования: ARCHITECTURE.md:199/377/592/680, SPEC Q42/Q73.

## Goals / Non-Goals

**Goals:** согласованный snapshot из тех же данных, однозначные показатели, фильтры, связь с queue, безопасные ошибки и ролевой доступ.

**Non-Goals:** финансовая доходность, экспорт, внешняя аналитика, автопуллинг метрик, новые risk rules или бенчмарки backend. Код пока не реализуется.

## Decisions

### 1. Временная модель и API

WorkspaceGateway.metrics(token,filter,signal) → PipelineMetrics. Filter: {fromDate?: YYYY-MM-DD,toDate?: YYYY-MM-DD,productCode?: string,source: all|example|session}. Даты либо обе отсутствуют, либо обе валидны и from≤to. Полуинтервал исполнения [начало from по Москве, начало дня после to по Москве); date helper не зависит от timezone машины. Период — по createdAt, результаты — на asOf.

PipelineMetrics {asOf,filter,total,submitted,decided,awaitingDecision,automaticDecisions,stpPct:string|null,timeToDecision:{meanMs:number|null,p95Ms:number|null,sampleCount,invalidCount},currentStatuses:[{status,count}],outcomes:[{outcome,count}],dataIssuesCount}. Числа count — целые; длительности — целые ms; процент STP — десятичная строка с одним знаком. Unknown current status — отдельный bucket «Неизвестно» с data issue, без падения exhaustive UI. Никаких денежных полей и ручных rates.

Будущий путь: GET /api/v1/bank/metrics из архитектуры; query/schema/поля/p95-метод согласовать с Dev 2, затем gen:api и mapping. Сейчас HTTP/БД не меняются, API-mode отвечает API_NOT_CONFIGURED. Mock считает операционные counters/time в адаптере; компоненты только форматируют/рендерят. Это не финансовая арифметика: ставки/лимиты/платежи остаются Python.

### 2. Точные определения

| Метрика | Определение |
|---|---|
| total | количество уникальных application id в cohort по createdAt/product/source |
| submitted | записи с первым SUBMITTED в истории; DRAFT не входит |
| decided | записи с первым переходом в APPROVED/COUNTER_OFFER/REJECTED; рекомендация при UNDERWRITING не считается |
| awaitingDecision | текущий SUBMITTED/SCORING/UNDERWRITING; DRAFT/SIGNING/SIGNED не входят |
| currentStatuses | текущий статус всех total, включая DRAFT/CANCELLED/EXPIRED/DISBURSED; сумма buckets=total |
| outcomes | первый зафиксированный бизнес-исход всех decided; три buckets суммируются в decided |
| automaticDecisions | первый бизнес-исход создан SYSTEM и до него не было BANK; replay/просмотр не решения |
| STP | automaticDecisions / decided ×100, один знак; при decided=0 null |
| duration | firstDecision.at − firstSubmitted.at; валидны только обе aware timestamps и duration≥0 |
| mean | округлённое до целой ms среднее валидных duration |
| p95 | сортировка duration, элемент ceil(0,95×N) с нумерацией от1; N=0 →null |
| invalidCount | decided без валидной длительности; исключаются из duration sample, но не из decided/outcome |

Повторные события/дубли audit не увеличивают counters. Итог подписи/выдачи/отмены после решения не стирает первый исход. Финальный отказ bank — ручной даже при совпадении с recommendation. История с решением без подачи: decided/outcome учитываются, duration invalid; показать проблему данных. Несуществующие products/invalid timestamps из адаптера не подменять валидными нулями.

Для seed baseline после №12: total=6, submitted=6, decided=5, awaitingDecision=1, automatic=5, STP=100,0%; outcomes APPROVED1/COUNTER_OFFER2/REJECTED2. Длительности брать из реальных сгенерированных timestamps, не из чисел в этой таблице. После ручного P6: decided=6, awaiting=0, auto=5, STP≈83,3%; выбранный outcome увеличился на1. Примеры — синтетические, не доказательство SLA.

### 3. UI и запросы

- MetricsPage: h1, заметный mock banner/asOf; date from/to, product/source; кнопки «Применить», «Сбросить фильтры», «Обновить». Редактируемый filter отдельно от applied, запрос только после валидации/Apply; смена applied key отменяет прежний signal.
- Key: workspace/mode/epoch/userId/metrics/canonicalFilter. Запрет читать до bank auth. Единственный gateway-вызов возвращает весь snapshot; не собирать карточки из ответов разных asOf.
- Cards: total/decided/awaiting/STP/mean/p95, определения раскрываются рядом с числами. Распределения — доступные горизонтальные CSS полосы и текстовые таблицы; библиотека графиков не нужна. Доли в графике операционные, CSS presentation, не кредитный расчёт.
- Loading skeleton/status, first error без цифр, refresh с aria-busy и неактивным drilldown до завершения. При ошибке обновления не выдавать старые цифры за актуальные: явно обозначить прошлый snapshot либо скрыть; для 401/403 скрыть обязательно. Empty distinct от ошибки, undefined ratio/duration показывать «—».
- Без фонового polling: refetch при входе/явном refresh и invalidation после bank decision/reset. После reset/logout/mode смены querycache очищен, старый ответ не восстанавливает snapshot.

### 4. Drill-down и очередь

При выборе bucket текущего статуса переход /bank/applications?status=...&product=...&source=...&from=...&to=.... QueuePage из №11 сейчас хранит фильтры локально — расширить чтением/записью URL и теми же правилами cohort. Добавить source/date controls, поиск/сортировка сохраняются как прежде. Невалидный URL показывает ошибку/сброс, не запускает непонятную выборку. Back восстанавливает applied metrics filter через URL /bank/metrics; search/sort не передавать как новую семантику метрики.

Из outcomes не делать ссылку как будто это current status: APPROVED-исход включает DISBURSED. В первой версии drilldown только status-бакеты. Подпись на диаграммах различает «Текущий статус» и «Принятое решение».

### 5. Проверка и интеграционный шлюз

Operational calculator тестируется отдельно на известных историях: 0/1/N, p95 nearest-rank, время до/после подачи, mixed roles, повторные записи, cancelled/expired after decision. UI тестируется на готовом адаптере, не повторяет формулы JSX. Проверить клиентский запрет, фильтры/date bounds, AbortSignal, 403 after cache, reset/invalidation. После будущего HTTP выполнять ту же матрицу против реального stub, не считать это выполненным по mock.

## Risks / Trade-offs

- Время демо искусственно; подписи обязаны исключать вывод об SLA реального сервера.
- Источник all смешивает examples/session, поэтому по умолчанию явно показывать «Все демо-данные» и возможность session-only.
- Диапазон createdAt и asOf означают «что сейчас с заявками этой когорты», а не исторический срез на конец периода. Это объясняется в UI.
- Показатели не покрывают финансовую эффективность/ROI; SPEC не требует её выдумывать.
