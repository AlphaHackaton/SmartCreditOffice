# Design

## Context

Наблюдения: /bank/applications уже работает; /bank/applications/:id — PlaceholderPage. MockGateway хранит records/submitted/accepted в памяти; queue отдельно строит шесть seed-* строк. Клиентская Decision умышленно лишена банковских полей. Python предоставляет inputs_to_json/result_to_json, evaluate, replay и transition; явных HTTP приложения/OpenAPI/БД нет. Новый change зависит от архивированных №1–11; последующие №13/14 используют его общий store.

## Goals / Non-Goals

**Goals:** адресуемое досье, прозрачность, ручное решение и аудит, связный P6 → bank → client → выдача, автономный desktop 1280/1440.

**Non-Goals:** новый скоринг, произвольные финансовые параметры, граф FSM в TS, производственная авторизация, API/Compose, метрики и песочница. План не изменяет код, main specs или данные.

## Decisions

### 1. Границы UI и модели

- DossierPage заменяет только служебную заглушку. Панели: ScoringTrace, InputsSnapshot, AuditLog, DecisionForm. Данные грузятся scoped query bank-dossier/id; состояние страницы — loading/error/not-found/loaded. Для первой версии один согласованный снимок досье, без смешения версий независимых секций.
- Временные UI-модели, не HTTP DTO: BankDossier {application, source, inputsSnapshot, runs, currentRunId, engineRecommendation, allowedOutcomes, eligibleOffers, audit}; ScoringRun {id, inputHash, resultHash, evaluatedAt, policyVersion, policySnapshot, metrics, factors, constraints, result}; AuditEntry {id, action, actorId, at, versionBefore, versionAfter, engineOutcome, selectedOutcome, override, offerId?, comment?, policyVersion}.
- BankFactor расширяет отдельную банковскую проекцию полями source/value/bin/points/maxPoints/impact/ruleId/clientText; публичный Factor не расширять raw-данными. bin содержит bounds/включённость границ/выбранное правило, сформированные Python, без повторной классификации в JS.
- Money/проценты/точные метрики — строки. displayMoney в генераторе округляется для MoneyText отдельно от точного snapshot; даты ISO с timezone, показ Europe/Moscow. null означает отсутствие, не 0. Длинный JSON/таблица не должен расширять страницу; readonly раскрываемые секции доступны с клавиатуры.

### 2. Общая модель mock-store

- Досье, queue и client application читают один агрегат; UI не меняет статус напрямую. На этапе применения переработать существующий snapshot-overlay в хранилище согласованных агрегатов/событий, сохранив текущие публичные методы и тесты №1–11.
- Для каждого seed-* создать адресуемый банковский пример с полной Python-историей и source=example. Примеры видны только банковским чтениям; не появляются в клиентских списках и не открываются клиентскими id-чтениями. source=session сохраняет нынешнее владение; клиент видит собственные live-заявки и результат bank-команды.
- Автоматические отложенные стадии воспроизводят Python-историю; ручная команда добавляет проверенный BANK-шаблон с фактическими actorId/comment/time. Дублирующий граф переходов в JS запрещён. reset восстанавливает примеры и очищает live/accepted/decisions/audit/cache/sessions.
- На чтении/команде пересчитывать истечение по injected clock; только version из актуального агрегата. Изменение outcome/history/audit/version/eligible offers одной синхронной операцией после await wait и повторной проверки session/generation/role/version.

### 3. Ручная команда

WorkspaceGateway: dossier(token,id,signal), decide(token,id,{outcome,offerId?,comment,version}), replayDossier(token,id,runId,signal). Ответ decide — обновлённое BankDossier. API unavailable-адаптер обязан реализовать сигнатуры отказом API_NOT_CONFIGURED.

1. Форма видна только для UNDERWRITING и известных allowedOutcomes. Комментарий trim, 1–2000 символов; ограничение согласовать с будущим API, сейчас это UI/mock-правило. Положительный исход требует eligibleOfferId того же актуального прогона и непросроченный оффер, REJECTED — без offerId.
2. Выбор APPROVED допустим для готового REQUESTED-оффера, COUNTER_OFFER — для готовых альтернатив. Нельзя вручную менять сумму/ставку/платёж. Если движок не подготовил нужных условий, соответствующий исход заблокирован. Knockout не обходится кнопкой одобрения.
3. ConfirmDialog показывает engine outcome, выбранный исход, offer terms, комментарий и override. Обязательный комментарий требуется и при совпадении с рекомендацией.
4. Успех: один BANK-event, новая version, запись аудита; invalidate dossier/queue/client application+list (включая кеш иных пользователей только в том же mock-epoch, без передачи банковского ответа в client key), будущие metrics. Владелец после следующего чтения получает только публичную проекцию. Обновить текст UnderwritingPanel о следующей фиче.
5. 409: перечитать, показать конфликт, не отправлять команду заново. При прежнем UNDERWRITING сохранить ввод для нового явного подтверждения; если stage изменён, форма скрывается. 422 map fields; сеть сохраняет ввод. Одновременный клик блокируется ref+mutation. Logout/reset/unmount/смена id игнорируют поздний ответ.

### 4. Прозрачность Python

Обязательные подготовленные review-cases: исходный P6 (APPROVED recommendation/UNDERWRITING) и P6 с CAPEX 6 000 000,00 ₽ /24 мес. Проверено текущим evaluate: COUNTER_OFFER/UNDERWRITING, LONGER_TERM 6 000 000/36 и REDUCED_AMOUNT 4 890 000/24. Генератор регистрирует этот точный request variant и его публичную проекцию; прочие произвольные заявки сохраняют честный fallback UNDERWRITING без выдуманного решения. Числа офферов не контрактные константы: при обновлении policy регенерировать и сверить route/offer kinds.

Генератор экспортирует inputs_to_json, result_to_json, compute_metrics, read-only policy metadata и replay-подтверждённые BANK-переходы. Не копировать пороги в TS. Текущее POLICY_V1 — рабочий источник; ARCHITECTURE показывает ориентиры и местами отличается (M2): UI обязан показывать фактическую версию политики, не выдавать пример архитектуры за исполненный расчёт.

| Фактор | Максимум/правило текущего домена | Что выводится |
|---|---|---|
| M1 обороты | CV: <0,25 →20, <0,50 →12, иначе4 | CV, бин, баллы, источник |
| M2 нагрузка | existing payments / NCF: <0,10 →20, <0,35 →12, <0,60 →5, иначе0 | фактическая метрика; DSCR показывается отдельно как ограничение |
| M3 БКИ | <1 дня →25, <30 →15, иначе5; inquiries>5 даёт −5 | overdue, штраф и правила отдельно |
| M4 ФНС | расхождение <0,20 →15, <0,40 →8, иначе0/review | оба исходных значения/расхождение |
| M5 возраст | бины из bins_business_age, максимум20 | возраст и границы текущей политики |
| Итог | A≥75, B≥60, C≥45, D<45; DSCR_min=1,30 | score/grade либо null при knockout |

Границы (равенство/исключение), knockout и route — только экспорт из Python; таблица объясняет текущий baseline, не создаёт новый контракт скоринга. Политика содержит min_history/business_age 3 месяца, auto_limit и остальные параметры; показать их в снимке, не зашивать в JSX.

### 5. Replay и будущий HTTP

Mock replay сверяет inputHash/policyVersion/resultHash с результатом, проверенным Python при генерации, с честной подписью «Подготовленный прогон, не новый расчёт». Не создаёт решение/аудит/новые офферы и не возвращает UNDERWRITING в SCORING: такого ребра нет. Кнопка при несовпадении сообщает ошибку согласованности; не переписывает историю.

Будущие архитектурные HTTP-маршруты: GET /api/v1/bank/applications/{id}, POST .../{id}/decision, POST .../{id}/rescore. Это направление для Dev 2, не существующий контракт. После публикации OpenAPI: gen:api, mapping BankDossier/UnderwriterDecisionIn/error DTO; согласовать version, офферы, replay vs rescore и аудит. Если rescore меняет состояние, требуется отдельное согласованное изменение домена/сервиса; mock replay не подменяет этот endpoint. В этой фиче backend endpoints, схемы и миграции не реализуются.

## Risks / Trade-offs

- Нормализация store может затронуть №1–11: обязательно сохранить их regression suite, owners и TTL.
- Синтетические данные в локальных fixtures не являются security boundary. Реальная защита банковских данных — RBAC/раздельные DTO API; frontend mock подтверждает только UI-поведение.
- Неопределённый результат сетевой команды в реальном HTTP требует серверной идемпотентности/command id; mock pre-commit failure не доказывает production exactly-once.
- P6 может рекомендовать APPROVED при route UNDERWRITING: status и engine recommendation не смешивать.

## Acceptance matrix

P1: read-only approved, полная трасса. P4/P5: knockout/null score/no offers. P6 live: UNDERWRITING, обязательный comment, одобрение → client sign/disburse. Override P6→REJECTED: флаг/причина в аудите, подписи нет. P6 CAPEX6млн/24→COUNTER_OFFER: только актуальный eligible offer; этот regression case обязателен, не условный. Seed-* доступны в bank, недоступны client. 401/403/404/409/422/503, двойной клик, поздний ответ, replay и reset — отдельные тесты.
