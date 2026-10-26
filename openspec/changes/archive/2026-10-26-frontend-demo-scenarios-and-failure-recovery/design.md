# Design

## Context

Зависимости: №12 общий store/dossier/decide/audit, №13 единый snapshot metrics. Нынешние DemoControls поддерживают delay 0/400/1500, failNext(read|command,status), reset/смену mode с logout. Сбои глобальны и могут потребляться служебным чтением вместо нужного действия. Пресетов и sandbox нет. Политика Python умеет with_key_rate, inputs_from_json/canonical; реального API нет.

## Goals / Non-Goals

**Goals:** воспроизводимые исходы/стадии, адресные pre-commit сбои, гонки и восстановление, конечная синтетическая песочница, проверяемая инструкция демо №1–14.

**Non-Goals:** runtime Python в браузере, произвольные финансовые вычисления, внешние сервисы, произвольный пользовательский JSON, реальный reset БД, изменение домена/глобальной политики. Этот change — план, без кода.

## Decisions

### 1. Каталог и запуск пресетов

Временные модели: DemoScenario {id,title,description,personaLogin,startingStage,expectedSteps,fixtureId}; ScenarioDataset {schemaVersion,policyVersion,examples,sessionApplications,preparedRuns,expectedSummary}; loadScenario(id)/reset доступны только mock-реализации WorkspaceProvider, без HTTP. Идентификаторы сценариев не дают сессию/роль. Перед запуском валидируется schemaVersion и проверка генератора.

Минимальный каталог, сгенерированный Python и проверенный replay:

| Пресет | Источник/старт | Что проверить |
|---|---|---|
| factory | шесть банковских примеров, пустые live | исходное состояние и reset |
| p1-apply | live P1 DRAFT | create/consents/submit → APPROVED → sign/disburse |
| p1-approved | live P1 APPROVED | выбор оффера/подписание |
| p2-counter | live P2 COUNTER_OFFER | альтернативы/simulation/accept |
| p3-counter | live P3 COUNTER_OFFER | меньшая сумма/binding constraint |
| p4-reject | live P4 REJECTED | текущая просрочка, нет оффера |
| p5-young | live P5 REJECTED | дата/рекомендация повторной подачи |
| p6-review | live P6 UNDERWRITING | bank decision/override/audit → client |
| p1-signing | live P1 SIGNING | восстановление challenge, неверный код/3 попытки |
| p1-signed | live P1 SIGNED | ожидание, только затем DISBURSED |
| p1-expired | live P1 EXPIRED | истёкшие условия, нет принятия |
| p1-disbursed | live P1 DISBURSED | финальный экран/история, остановка polling |

Все snapshot histories, consent/offer/challenge поля согласованы; не присваивать только status. Генератор проверяет последовательность/актора/обязательные reason. При запуске retime относительно injected clock: свежие офферы/подтверждения получают корректные TTL, expired остаётся истёкшим. Пользователь видит новый старт и выполняет обычный login нужной персоной; логин не означает пропуск me/RequireRole.

Публичный каталог раскрывает только описание синтетического сценария, не bank snapshot. Sandbox доступна только bank. Если есть сессия либо изменён store, перед заменой ConfirmDialog; на пустом factory запуск может быть без подтверждения. Отмена не вызывает reset и не отменяет pending-запрос. Подтверждение: generation++, cancelQueries/clear/logout, атомарная установка dataset, очистка pending failures/preview, переход /login. Указатель activePreset хранится в памяти, рядом дата запуска/подсказка входа. Полный reset всегда factory, не текущий preset.

### 2. Адресные сбои

FailurePlan {kind:read|command,target,variant,status?,fieldErrors?,state:pending|consumed}. Сохранить знакомые legacy selectors «следующее любое чтение/команда», добавить понятные человеку цели (чтение заявки/досье/метрик, вход, подача, выбор условий, подпись, решение сотрудника). Максимум один ожидающий план каждого kind; новая настройка явно заменяет предыдущую. UI показывает «ожидает», «применён», «отменён», отдельную кнопку отмены.

Операция использует общую wait(kind,target,signal,token). План потребляется ровно один раз только совпавшим target после delay и проверки generation; AbortError до этого не потребляет план. Два совпавших запроса конкурируют за один план, а не получают два сбоя. Сбои применяются до commit store, никаких частично добавленных history/audit/challenge. В тестах используется injected clock, а не продолжительные wall sleeps.

| Вариант | Применимость / UI |
|---|---|
| 401 | authenticated reads/commands → expire именно requestToken; поздний старый401 не разлогинивает новую сессию |
| 403 | защищённые чтения/команды → отказ, cached private data скрыты |
| 404 | application/dossier/offer id → unavailable без чужих данных |
| 409 | versioned command → reread/no replay; реальный конфликт отдельным тестом двух команд |
| 422 | save/submit/sign/decide/sandbox → известное поле/общая ошибка, ввод сохранён |
| 503 | чтения и команды → явный retry; без fake success |
| network | ApiError с status=null, safe message; отличать от пользовательского abort |

Недопустимые пары (например, field error для metrics GET) не показывать как выбираемые варианты; не инжектировать raw stack/token/пароль. API-mode: controls скрыты/disabled, ни одного fetch для локальной инъекции. Mock failure pre-commit проверяет UI, но не exactly-once при потере HTTP-ответа после server commit — это будущая интеграционная задача.

### 3. Sandbox: конечные входы и Python-проекция

Служебная панель в банковском контуре (рядом с demo controls, раскрываемая «Синтетическая песочница»), не замена DossierPage и не клиентский калькулятор. Не добавлять новый публичный маршрут без необходимости.

WorkspaceGateway.sandboxCatalog(token,signal) → allowed values/policies/labels; sandboxRun(token,{basePersonaId,turnoverVariant,overdueDays,businessAgeMonths,policyId},signal) → SandboxResult. Реализация читает подготовленный реестр, проверяет bank и точное совпадение ключа; missing →422 NO_DEMO_CASE. result {inputHash,policyVersion,keyRatePct,inputSnapshot,metrics,fullResult,trace,disclaimer}. Результат предыдущего набора скрывается сразу при редактировании; расчёт по кнопке, с отменой старого чтения и scoped key всех параметров. Во время pending форма/повторный запуск блокируются; reset/logout уничтожают preview.

Базовый обязательный набор для генератора:
- Шесть персон из seed, без ручного копирования компаний.
- turnoverVariant: baseline либо reduced. Для reduced Python умножает все месячные inflows и outflows на Decimal('0.80') с monetary quantization, сохраняя синтетическое происхождение. UI показывает готовые значения, не умножает деньги.
- overdueDays: 0 либо45, одинаково для отчётов данной персоны; остальные поля БКИ остаются из seed.
- businessAgeMonths: 1 либо48; Python вычисляет registered_at от inputs.as_of через domain dates, корректно для конца месяца.
- policy: POLICY_V1, with_key_rate(base−2 п.п.), with_key_rate(base+2 п.п.). Названия «Базовая демо-политика», «−2 п.п.», «+2 п.п.»; это не текущая ставка ЦБ и не рекомендация клиенту.

Генерировать все 6×2×2×2×3=144 комбинации (малый CPU-only набор) через inputs_from_json/evaluate/compute_metrics; canonical hashes и фактическую policy.version вычисляет Python. Каждый показанный selector tuple имеет результат; unsupported ручной/прямой запрос возвращает явный422. У исходной персоны baseline может отличаться по возрасту/просрочке — рядом отдельная кнопка «Исходный снимок», добавленный baseline-case генерируется для каждой политики без подмены исходных полей. Генератор проверяет допуски/детерминизм и сохраняет банк-проекцию отдельно от клиентской; export --check покрывает реестр. Ставки/платежи/финансовые метрики ни разу не вычисляются в JSX/TS.

Scorecard не меняется: M1/M2/M3/M4/M5 max 20/20/25/15/20, штраф inquiries из policy; thresholds/bins/knockouts только Python (подробная baseline-таблица в design №12). Изменение key rate меняет pricing/version, но не должно переписывать решения прежних application snapshots. Не строить JS таблицу решений по признакам.

Сравнение политик: два готовых результата одного inputHash с разными policyVersion; показать обе версии/key rate/готовые условия. Нельзя сравнить два разных inputHash как чистое влияние политики. SandboxResult read-only: нет application id, BANK-decision event, audit решения, accept/sign. Метрики конвейера не включают preview; публикация в заявку не входит в эту фичу.

### 4. Единый reset и тесты восстановления

Расширить единый WorkspaceProvider reset, не делать второй reset в sandbox. Очищаются store №12, timers/accepted/challenges/failures, cache/auth, activePreset и preview. Смена mode вызывает ту же очистку. Пресеты/schemaVersion mismatch не устанавливаются частично; ошибка оставляет текущий набор до подтверждённого успешного commit.

Для всех команд проверить no automatic retry; после failed command перечитать актуальные данные по правилам страницы и предложить явное действие. При logout/reset/id change ignore late success. Для чтений AbortSignal; запрет продолжения polling после доступа/терминала. Продолжить существующие тесты, не отключать старые проверки через skip/ignore.

### 5. Будущий HTTP: отдельный шлюз

Архитектура задаёт GET demo/personas и POST demo/reset. Новые sandbox/scenario/failure endpoints не опубликованы и не выдумываются как контракт. После Dev 2: согласовать доступность demo-only режима и RBAC reset, input schema для sandbox, source политика/время/version/idempotency и return DTO. Сгенерировать schema.d.ts из настоящего docs/openapi.json; временные UI-модели преобразуются адаптером. До этого произвольный ввод вне реестра не считается реализованным и UI не пытается выполнить Python в runtime.

HTTP E2E gate: client P1 до выдачи; P2/P3 контроффер/симуляция; P4/P5 отказ; P6 bank decision/audit/client continuation; 401/403/404/409/422/network; reset/metrics; проверка отсутствия служебных данных в client DTO. Mock test pass не закрывает этот gate.

## Risks / Trade-offs

- Генерируемый банковский реестр увеличивает bundle; ленивый импорт для bank при необходимости без новых библиотек. Зафиксировать размер production build, не класть модели/weights.
- Выбор пресета разрушает текущее демо только после подтверждения. Нельзя молча запускать его при случайной смене select.
- Синтетические fixture assets доступны разработчику браузера; не обещать секретность mock. Настоящая изоляция — backend DTO/RBAC.
- HMR может удержать старый gateway: после gen:demo инструкция требует reload. Это не сохранение данных между production reload.
- Глобальная политика/файлы backend не меняются из UI; контрольная ставка перед сдачей — ответственность домена/конфига, а не sandbox.
