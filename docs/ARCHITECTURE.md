
# Архитектура кредитного кабинета Альфа-Банка

**Session ID:** ses_e9609a8a1ffecf8TPNB2JQsoeB
**Created:** 10/23/2026, 9:11:54 PM
**Updated:** 10/24/2026, 4:49:01 PM

---

## User

Работай как Chief Fintech Architect и Tech Lead. Мы делаем «Умный
  кредитный кабинет предпринимателя» (хакатон Альфа-Банка, 3 дня, команда из
  3 человек). 
    Пиши прямо в чат, никаких файлов и bash-скриптов не создавай.
    
    Мне нужно полное системное видение проекта до написания кода:
    
    1. СУТЬ ПРОЕКТА И ПРОДУКТОВОЕ РЕШЕНИЕ:
    - В чём реальная боль малого бизнеса (ИП/ООО) при кредитовании и какую
  конкретную проблему решает именно «умный» кабинет, а не обычная веб-форма
  заявки?
    - Механика Counter-Offer (контроффера): как работает симулятор и пересчёт
  параметров кредита, если клиент не проходит по скорингу на запрошенную
  сумму.
    
    2. СЛОЖНОСТИ, РИСКИ И ИХ РЕШЕНИЕ:
    - Скоринг и Explainability: как решить проблему «чёрного ящика» скоринга
  и на основе каких 4-5 метрик (выручка, DTI, БКИ, обороты) формировать
  понятные бизнесу причины отказа/одобрения?
    - Краевые случаи и как их обрабатывать: нулевые обороты, свежее юрлицо,
  просрочки в БКИ, передача пограничных кейсов андеррайтеру.
    
    3. ГЛОБАЛЬНАЯ АРХИТЕКТУРА СИСТЕМЫ:
    - Схема архитектуры от клиента до БД: 2 UI-контура (Клиент и Банк) ->
  FastAPI Gateway -> Scoring & Explainability Engine -> Слой моков (ФНС, БКИ,
  банк) -> PostgreSQL.
    - Минимальный контракт (5-6 DTO) и FSM статусов заявки (DRAFT ->
  DISBURSED) для параллельной работы.

    4. РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ (АРХИТЕКТУРА И КОМАНДА):
    - Разделение ответственности в коде: как изолировать скоринг от API и
  моков, чтобы логика легко тестировалась.
    - Разделение на 3 разработчиков (без «выделенного девопса»): предложи 2
  реалистичные конфигурации распределения зон ответственности на команду из
  трёх человек под этот стек.

    5. ГЛОБАЛЬНЫЙ ПЛАН РАЗРАБОТКИ (ROADMAP: ТЕСТЫ -> ФИЧА):
    - Пошаговый сквозной план от чистого репозитория до сдачи MVP: в каком
  порядке строятся модули, тесты и экраны.

    6. КИЛЛЕР-ФИЧИ ДЛЯ ЖЮРИ АЛЬФА-БАНКА:
    - 2-3 сильных акцента, которые выделят проект на защите среди шаблонных
  заявок.

    Ответь структурированно, глубоко, с упором на инженерные и финтех-
  обоснования. 

---

## Assistant

# «Умный кредитный кабинет предпринимателя»: системное видение до написания кода

В репозитории сейчас только спецификация, `AGENTS.md`, OpenSpec-конфиг и скрипты проверки. Значит, всё ниже — проектное решение с нуля. Оно сверено с `SPEC_FOR_AGENT.md` (§2–§6, Q&A). Дедлайн 26.10 18:00 МСК, сегодня 23.10: у нас 3,5 календарных дня.

---

## 1. Суть проекта и продуктовое решение

### Реальная боль

Предприниматель:
- Ждёт решения днями и заново заполняет данные, которые банк о нём уже знает: обороты по счёту, реквизиты, налоговые данные.
- Получает бинарный ответ «нет» без причины. Непонятно, сколько дали бы и что исправить.
- Не может заранее прикинуть, какой платёж бизнес потянет.

Банк:
- Андеррайтер тратит время на очевидные кейсы (явно хорошие и явно плохие).
- Неформализованные решения трудно аудировать и воспроизвести.
- Отказ без альтернативы означает потерянного клиента, хотя меньшую сумму он бы обслужил (Q38, Q73).

### Чем «умный» кабинет отличается от веб-формы

| Веб-форма | Умный кабинет |
|---|---|
| Пустые поля | Профиль предзаполнен. Банк уже видит обороты, и до подачи показывается предварительный лимит |
| Ответ «да/нет» | Три исхода. Отказ по сумме превращается в контроффер с понятными альтернативами |
| «Решение принято» | Объяснение: какие факторы, сколько баллов, какое правило, что улучшить |
| Все заявки к человеку | Маршрутизация: явные случаи решаются автоматически (STP), серая зона уходит андеррайтеру |
| Статус «на рассмотрении» | Живой таймлайн конвейера (Q69) |

### Механика контроффера

Контроффер возникает, когда клиент кредитоспособен, но не на запрошенные параметры. Если сработал стоп-фактор, контроффера не бывает: это отказ.

Шаг 1. Максимальная сумма. Это минимум из независимых ограничений:

```
S_limit(n) = min(
    S_afford(n),            # долговая нагрузка
    k_rev × выручка_год,    # лимит от выручки ФНС, напр. 0.3–0.5
    product.max_amount,     # лимит продукта
    grade_cap[grade]        # лимит по риск-грейду
)

P_max       = NCF_month / DSCR_min − existing_payments
S_afford(n) = P_max × (1 − (1+i)^−n) / i        # обратный аннуитет, i = rate/12
```

Для бизнеса нагрузку корректнее мерить DSCR, а не потребительским DTI. DSCR — это чистый денежный поток (`NCF` = поступления − списания по счёту), делённый на все платежи по долгу. Типичный порог — DSCR ≥ 1,25–1,3. DTI показываем как обратную метрику: «долговая нагрузка 62% от денежного потока», так бизнесу понятнее.

Шаг 2. Поиск альтернатив по сетке (сумма, срок) в границах продукта. Порядок отражает интересы клиента:
1. LONGER_TERM: та же сумма, срок удлиняется до минимального n', при котором проходит DSCR.
2. REDUCED_AMOUNT: максимальная сумма на запрошенный срок.
3. MAX_TERM_MAX_AMOUNT: максимальная сумма на максимальный срок.

Суммы округляются вниз до 10 000 ₽. Если `S_limit < product.min_amount`, это REJECTED. Клиенту показываем 2–3 варианта.

Шаг 3. Ограничивающее условие. Движок возвращает не только сумму, но и `binding_constraint`, то есть какое ограничение сработало. Это и есть объяснение: «Сумма ограничена долговой нагрузкой: при чистом денежном потоке 410 тыс. ₽/мес платёж не должен превышать 205 тыс. ₽».

Симулятор:
- Запрос `POST /applications/{id}/simulate {amount, term}` вызывает ту же чистую функцию, что и конвейер. Расчёт идёт на сохранённом снимке входов, моки повторно не вызываются, поэтому ответ быстрый и детерминированный.
- Ответ содержит прогноз решения, ставку, платёж, переплату и список ограничений с запасом (headroom). На UI ползунки и цветовая зона.
- Главный инвариант: симулятор не может обещать то, что конвейер отклонит. Поэтому на фронте нет финансовой арифметики, деньги считает только бэкенд.

Принятие контроффера происходит внутри той же заявки (Q62). Исходный запрос сохраняется. У оффера есть TTL, после него статус EXPIRED. В оффере зафиксированы снимок условий и `policy_version`.

Ставка:

```
rate = key_rate (конфиг) + product_spread + risk_premium[grade] + term_premium
```

Результат зажимается в пределы `[floor, cap]` из конфига (Q35). Конкретное значение ключевой ставки я не фиксирую: перед сдачей возьмите актуальное с cbr.ru и положите в конфиг.

---

## 2. Сложности, риски и их решение

### Скоринг без «чёрного ящика»

Пайплайн из четырёх детерминированных стадий. Каждая пишет трассу:

```
1. Knockout-правила (стоп-факторы)  → REJECTED или UNDERWRITING
2. Scorecard (баллы по бинам)        → score 0–100 → grade A–D
3. Affordability (DSCR, лимиты)      → S_limit, binding_constraint
4. Decision matrix (grade × affordability × сумма) → исход + маршрут
```

Пять метрик. Пороги ниже — синтетические, их нужно откалибровать на персонах:

| # | Метрика | Источник (мок) | Бины → баллы | Фраза для клиента |
|---|---|---|---|---|
| M1 | Стабильность оборотов: среднемесячные поступления за 6–12 мес и коэффициент вариации (CV) | Счёт в банке | CV < 0,25 → 20; 0,25–0,5 → 12; > 0,5 → 4 | «Поступления нестабильны: колебания до ±55% по месяцам» |
| M2 | DSCR с учётом нового платежа | Счёт + БКИ (текущие платежи) | ≥ 2,0 → 20; 1,3–2,0 → 10; < 1,3 → 0 и контроффер | «Платёж займёт 62% денежного потока при допустимых 50%» |
| M3 | Кредитная история: просрочки за 24 мес, текущая просрочка, запросы за 30 дней | БКИ | чисто → 25; закрытые 1–29 → 15; закрытые 30–89 → 5; > 5 запросов за 30 дней → −5 | «Просрочка 45 дней в 03.2025 (закрыта)» |
| M4 | Сверка ФНС и счёта: расхождение выручки по декларации и оборотов | ФНС + счёт | < 20% → 15; 20–40% → 8; > 40% → 0 и флаг на ручную проверку | «Обороты по счёту ниже задекларированной выручки на 35%» |
| M5 | Возраст бизнеса | ФНС (ЕГРЮЛ/ЕГРИП) | > 36 мес → 20; 12–36 → 15; 6–12 → 8 | «Бизнесу 8 месяцев, полный лимит доступен с 12» |

Грейды: A ≥ 75, B 60–74, C 45–59 (серая зона, к андеррайтеру), D < 45 (отказ).

Как обеспечивается прозрачность (Q37):
1. Reason codes. Каждый фактор возвращает `{code, source, value, bin, points, max_points, impact, rule_id}`. Клиенту показываются топ-3 негативных фактора, по аналогии с adverse action notice.
2. Контрфактические подсказки: «при DSCR ≥ 1,3 одобрили бы 3 млн», «через 4 месяца бизнесу исполнится год». Они считаются той же функцией, что и симулятор.
3. Два уровня детализации. Клиент видит человеческий текст без точных порогов, чтобы не учить обходу. Банк видит полную трассу: входы мока, бины, баллы, правило, версию политики.
4. Воспроизводимость. В `scoring_runs` хранятся `inputs_snapshot` (JSONB), `policy_version` и `factors`. Повторный прогон на том же снимке и политике обязан дать тот же результат, это проверяется тестом.
5. LLM опционален: перефразирует reason codes и не принимает решений. Fallback — шаблоны (AGENTS.md, Q47).

### Краевые случаи

Ключевой принцип: различать «нет данных» и «плохие данные». Это разные reason codes и разные маршруты.

| Кейс | Детекция | Обработка |
|---|---|---|
| Нулевые обороты | Поступления за 3 мес = 0 или история счёта < 3 мес | Деления на ноль нет: affordability не считается. Reason `INSUFFICIENT_DATA`, а не «плохой клиент». При выручке по ФНС заявка уходит в UNDERWRITING, иначе REJECTED с подсказкой «вернитесь после 3 месяцев оборотов» |
| Свежее юрлицо | < 3 мес с регистрации | Стоп-фактор: REJECTED (`BUSINESS_TOO_YOUNG`) |
| | 3–12 мес | Штраф в баллах, потолок `grade_cap` и короткий максимальный срок. Как правило, получается контроффер «Старт» |
| Текущая просрочка в БКИ | > 0 дней | Стоп-фактор: REJECTED, контроффер невозможен |
| Просрочка 90+ за 12 мес | Флаг БКИ | Стоп-фактор: REJECTED |
| Закрытые просрочки 30–89 | Флаг БКИ | Штраф в scorecard |
| ИП и ООО | `legal_form` | Для ИП БКИ запрашивается по физлицу. Для ООО — по юрлицу и по руководителю/бенефициару. Это реальное различие процесса (Q16) |
| Ликвидация или приостановка счетов по решению ФНС | ФНС | Стоп-фактор: REJECTED |
| Пограничные кейсы | Грейд C; сумма выше авто-лимита (напр. 5 млн); флаг сверки M4; ошибка мока | UNDERWRITING с рекомендацией движка. Андеррайтер видит трассу, выбирает один из трёх исходов, комментарий обязателен. Override (решение против рекомендации) логируется в аудит |
| Мок недоступен или таймаут | Исключение в адаптере | Retry, затем UNDERWRITING с reason `SOURCE_UNAVAILABLE`. Заявка не теряется |
| Дубль и двойной клик | Активная заявка на тот же продукт; повторный submit/sign | Одна активная заявка на продукт; оптимистичная блокировка (`version`); идемпотентные команды |
| Повторная подача после отказа | Новая заявка | Cooldown 30 дней, если входные данные не изменились (хэш снимка) |

---

## 3. Глобальная архитектура

```
┌───────────────────────── React SPA (Vite, Alfa Core Components) ─────────────────────────┐
│  Контур «Клиент» /client/*                  │  Контур «Банк» /bank/*                      │
│  дашборд + предодобренный лимит, заявка,    │  очередь заявок, карточка + трасса,         │
│  симулятор, решение + причины,              │  решение андеррайтера, аудит,               │
│  подписание (OTP на экране), таймлайн       │  метрики конвейера (STP, time-to-decision)  │
└──────────────── TanStack Query (polling статуса) · JWT · переключатель роли ──────────────┘
                                         │ REST /api/v1 (OpenAPI)
┌────────────────────────────── FastAPI (backend/app) ─────────────────────────────────────┐
│ api/        роутеры, DTO, auth-зависимости, RBAC (client видит только свою компанию)     │
│ services/   use cases: submit · run_scoring · simulate · accept_offer · sign ·           │
│             underwriter_decide · disburse        (транзакционная граница)                │
│ domain/     application_status.py (FSM) · scoring/{knockout,scorecard,affordability,     │
│             counter_offer,pricing,explain,policy} — ЧИСТЫЕ функции, без I/O              │
│ ports.py    Protocol: FnsGateway · BkiGateway · AccountGateway · CoreBanking ·           │
│             Clock · Explainer(LLM)                                                       │
└──────────────┬──────────────────────────────────────────┬────────────────────────────────┘
               │ adapters                                 │ repositories (SQLAlchemy 2)
┌──────────────▼───────────────────┐        ┌─────────────▼─────────────────────────────────┐
│ mocks/ ФНС · БКИ · счёт · АБС    │        │ PostgreSQL 16                                 │
│ детерминированы по ИНН,          │        │ users, companies, products, applications,     │
│ фикстуры JSON, режим ошибки      │        │ status_history, scoring_runs (JSONB),         │
│ LLM-адаптер (OpenAI-compat, опц.)│        │ offers, signatures, audit_log                 │
└──────────────────────────────────┘        └───────────────────────────────────────────────┘
```

Решения:
- Скоринг запускается через `BackgroundTasks` после submit. Статус SCORING, этапы пишутся событиями, клиент видит движение конвейера. Celery и Redis не нужны: всё укладывается в CPU-only и 8–12 ГБ (§2.4).
- Моки работают в процессе, за протоколами. Замена на HTTP-интеграцию — это новый адаптер без правок домена (Q33).
- Свои SLA (Q42): автоматическое решение < 2 с p95, симулятор < 200 мс. Замерить и указать в README.
- Безопасность: JWT по seed-учёткам (bcrypt), роль в токене, проверка владения заявкой на каждом эндпоинте, банковские эндпоинты только для роли bank. Без этого клиент сможет читать чужие заявки по UUID.

### Минимальный контракт: 6 DTO

Деньги передаются как `Decimal`, сериализованный в строку. Фронт их только отображает.

```python
class CompanyProfile(BaseModel):            # 1. предзаполненный профиль
    id: UUID; inn: str; ogrn: str
    legal_form: Literal["IP", "OOO"]
    name: str; okved: str; registered_at: date; client_since: date
    pre_approved_limit: Decimal | None      # предскоринг по оборотам

class ApplicationIn(BaseModel):             # 2. создание/редактирование DRAFT
    product_code: str
    amount: Decimal; term_months: int
    purpose: Literal["WORKING_CAPITAL", "EQUIPMENT", "OTHER"]
    consents: list[Literal["BKI_REQUEST", "PD_PROCESSING"]]   # согласие на запрос в БКИ

class Application(BaseModel):               # 3. агрегат заявки
    id: UUID; company_id: UUID; product_code: str
    requested: Terms; status: ApplicationStatus; version: int
    history: list[StatusEvent]              # from, to, actor, reason, at
    decision: Decision | None

class Factor(BaseModel):                    # 4. единица объяснения
    code: str; source: Literal["FNS", "BKI", "ACCOUNT", "APPLICATION"]
    value: str; points: int; max_points: int
    impact: Literal["positive", "neutral", "negative", "knockout"]
    rule_id: str; client_text: str; hint: str | None   # контрфактическая подсказка

class Decision(BaseModel):
    outcome: Literal["APPROVED", "COUNTER_OFFER", "REJECTED"]
    engine_recommendation: Literal["APPROVED", "COUNTER_OFFER", "REJECTED"]
    decided_by: Literal["ENGINE", "UNDERWRITER"]; comment: str | None
    score: int; grade: Literal["A", "B", "C", "D"]; policy_version: str
    factors: list[Factor]; binding_constraint: str | None
    offers: list[Offer]

class Offer(BaseModel):                     # 5. условия
    id: UUID; kind: Literal["REQUESTED", "LONGER_TERM", "REDUCED_AMOUNT", "MAX"]
    amount: Decimal; term_months: int; rate_pct: Decimal
    monthly_payment: Decimal; overpayment: Decimal; expires_at: datetime

class SimulationIn(BaseModel): amount: Decimal; term_months: int
class SimulationOut(BaseModel):             # 6. симулятор
    predicted_outcome: str; offer: Offer
    constraints: list[Constraint]           # name, limit, actual, headroom, binding
```

Команды отдельными мелкими схемами: `AcceptOfferIn{offer_id}`, `SignIn{offer_id, otp}`, `UnderwriterDecisionIn{outcome, offer?, comment}`.

### FSM статусов

```
DRAFT ──submit──▶ SUBMITTED ──▶ SCORING ──┬──▶ APPROVED ───────┐
  │                                        ├──▶ COUNTER_OFFER ──┤──accept──▶ SIGNING ──otp──▶ SIGNED ──▶ DISBURSED
  ▼                                        ├──▶ REJECTED        │
CANCELLED                                  └──▶ UNDERWRITING ───┘ (→ APPROVED | COUNTER_OFFER | REJECTED)
                          APPROVED|COUNTER_OFFER ──decline──▶ CANCELLED · ──TTL──▶ EXPIRED
```

| Переход | Кто | Guard |
|---|---|---|
| DRAFT → SUBMITTED | client | параметры в границах продукта, согласия подписаны, нет другой активной заявки |
| SUBMITTED → SCORING → {3 исхода · UNDERWRITING} | system | результат движка |
| UNDERWRITING → {3 исхода} | bank | комментарий обязателен |
| APPROVED / COUNTER_OFFER → SIGNING | client | оффер не истёк |
| SIGNING → SIGNED | client | OTP верный, TTL 5 мин, не больше 3 попыток |
| SIGNED → DISBURSED | system (мок АБС) | открыт ссудный счёт |

Терминальные статусы: REJECTED, CANCELLED, EXPIRED, DISBURSED.

Реализация:
- Таблица `TRANSITIONS: dict[(from, to), Rule(actors, guard)]` и единственная функция `transition()` в `domain/application_status.py`.
- Запись в `status_history` идёт в той же транзакции. Колонка `version` даёт защиту от гонок.
- Подпись в UI: код показывается на экране с пометкой «демо, в проде — ПЭП в ДБО / Госключ» (Q53). В БД хранится хэш кода. Запись подписи — `sha256(текст договора + снимок оффера + user + timestamp)`, это защита от подмены условий после подписания.

---

## 4. Разделение ответственности

### В коде: порты и адаптеры

- `domain/scoring` — чистая функция `evaluate(inputs: ScoringInputs, policy: Policy) -> ScoringResult`. Без импортов FastAPI, SQLAlchemy и моков. Входы — frozen dataclasses, политика — версионированный конфиг (пороги, бины, спреды, `key_rate`).
- `services` собирают `ScoringInputs` через порты, вызывают домен, сохраняют результат, двигают FSM.
- Тестируемость:
  - Unit-тесты домена: табличные, по персонам. Миллисекунды, без БД.
  - Сервисные тесты с фейковыми портами.
  - API-интеграция с реальным Postgres из compose.
  - Свойственные инварианты. Рост оборотов никогда не ухудшает решение (монотонность). Сумма контроффера ≤ запрошенной. Платёж оффера ≤ P_max. Симулятор и конвейер дают одинаковый результат на одном снимке. Для этих проверок подойдёт `hypothesis` — это новая зависимость, её нужно добавить в lock-файл и в notices.
- Граница импортов проверяется тестом: `domain/` не импортирует `api`, `db`, `mocks`.

### Команда: две конфигурации

Конфигурация A — по слоям. Подходит, если есть сильный фронтендер.

| Роль | Зона |
|---|---|
| Dev1 — Domain/Risk | FSM, скоринг, контроффер, pricing, политика, unit- и property-тесты, seed-персоны как оракул |
| Dev2 — Platform | FastAPI, БД/Alembic, auth/RBAC, моки, сервисы, compose, `check.sh`, OpenAPI, README и notices |
| Dev3 — Frontend | оба контура, симулятор, экран объяснений, подписание, таймлайн |

Плюсы: чёткие контракты, домен изолирован. Минус: фронт становится узким местом (два контура), интеграция поздняя. Лечится заглушками роутеров с первого часа.

Конфигурация B — вертикальные срезы. Подходит, если все трое fullstack.

| Роль | Зона |
|---|---|
| Dev1 — Клиентский путь | эндпоинты и экраны: заявка → симулятор → решение → подпись → выдача |
| Dev2 — Банковский путь | очередь, карточка с трассой, андеррайтинг, аудит, метрики конвейера |
| Dev3 — Движок и данные | скоринг, моки, персоны, FSM, pricing, инфраструктура и CI |

Плюсы: каждый владеет демонстрируемым куском, интеграционный риск ниже. Минусы: двое правят FastAPI и фронт. Нужны общие соглашения и единый `api-client`, сгенерированный из OpenAPI.

В обоих вариантах: фриз контракта (DTO и FSM) в первый вечер, ежедневный интеграционный мерж, `harness_check` зелёный перед каждым мержем.

---

## 5. Roadmap: тесты → фича

Фаза 0. Пт 23.10, вечер (около 4 ч). Фундамент:
- OpenSpec-change «core-credit-pipeline»: DTO, FSM, политика.
- Таблица из 6 seed-персон с ожидаемым исходом и топ-причинами: «Идеальный ИП» → APPROVED; «Растущее ООО» → COUNTER_OFFER (LONGER_TERM); «Перекредитованный» → COUNTER_OFFER (REDUCED); «Текущая просрочка» → REJECTED; «Свежее ООО, 2 мес» → REJECTED; «Расхождение ФНС» → UNDERWRITING. Эта таблица — приёмочные тесты, её пишем до движка.
- Скелет compose (db, backend, frontend), healthcheck, зелёный `check.sh`.

Фаза 1. Сб 24.10. Домен через TDD, параллельно платформа:
- Dev1: тесты FSM → FSM; тесты по персонам → knockout и scorecard; property-тесты → affordability и контроффер; тесты pricing.
- Dev2: модели, миграции, моки по фикстурам, auth, сервисы. Роутеры сначала отдают фикстуры, чтобы фронт не ждал.
- Dev3: shell, логин, переключатель роли, профиль, форма заявки, таймлайн против заглушек.
- Вечер: API-level E2E тест (create → submit → score → accept → sign → disbursed) зелёный для «Идеального ИП».

Фаза 2. Вс 25.10. Полный сценарий:
- Реальный движок подключён к сервисам, E2E на все 6 персон.
- Клиент: экран решения с факторами, симулятор, OTP-подпись.
- Банк: очередь, карточка с трассой, решение андеррайтера, аудит.
- Vitest на симулятор и таймлайн.
- Вечер: фриз ядра, дальше только киллер-фичи из раздела 6.

Фаза 3. Пн 26.10, до 14:00. Сдача:
- README (архитектура, `.env`, запуск, учётки, демо-сценарий по персонам), `docs/openapi.json`, `THIRD_PARTY_NOTICES`, lock-файлы, docs по модели данных и допущениям (Q49).
- Прогон на чистом клоне: `docker compose up --build`, замер RAM.
- Skill `deliverables-audit`, доступ для `alfa-hack-2026`, PDF.
- С 14:00 до 18:00 только буфер, без новых фич. Последний коммит до 17:00.

Playwright не берём: браузеры тяжёлые, ROI на хакатоне низкий. E2E на уровне API плюс ручной демо-скрипт.

---

## 6. Киллер-фичи для жюри

1. Симулятор «что, если» с контрфактическими объяснениями. Не «отказ», а «одобрено 2,4 млн из 3; чтобы получить 3 млн — срок 36 мес вместо 24». Ограничивающее условие подсвечено, ползунки показывают зоны одобрения в реальном времени. Плюс предодобренный лимит на дашборде ещё до подачи. Это прямой ответ на главную боль и на Q37/Q38.

2. Прозрачное кредитное досье для банка. Полная трасса решения: ответы моков → бины → баллы → правило → версия политики. Кнопка «воспроизвести» доказывает детерминизм. Override андеррайтера идёт с обязательной причиной и пишется в аудит. Мини-дашборд конвейера: доля автоматических решений, time-to-decision, распределение исходов. Это показывает эффективность для банка (Q73), а не только UX клиента.

3. Песочница сценариев и риск-политика как конфиг. Жюри может проверять на своих синтетических сценариях (Q46). В банковском контуре дайте конструктор синтетического клиента: задать обороты, просрочки, возраст бизнеса — и прогнать конвейер. Рядом кнопка «Сбросить демо». Вторая половина: поменяли ключевую ставку в конфиге, и новые офферы пересчитались с новой `policy_version`. Это демонстрирует рыночность условий (Q35) и инженерную зрелость.

LLM-перефразирование причин — приятный бонус, но не акцент: баллов за ИИ не дают (Q47).

---

Сейчас включён Plan-режим, поэтому я ничего не создаю. Следующий шаг — оформить фазу 0 как OpenSpec-change (DTO, FSM, политика, таблица персон). Для этого переключитесь на агента build или дайте команду `/opsx-propose`.

---

## User

Мы выбрали Схему 1 (по слоям):
    - Dev 1: Доменная логика, скоринг, правила, FSM (чистый Python, TDD).
    - Dev 2: Платформа, API, база данных, интеграционные моки, инфраструктура.
    - Dev 3: Фронтенд (React, Alfa Core Components, оба контура).

    Ответь в чат без создания файлов на диске.

    1. ПЕРСОНАЛЬНЫЙ ПЛАН ДЛЯ КАЖДОГО РАЗРАБОТЧИКА (DEV 1, DEV 2, DEV 3):
    - Спроектируй структуру файлов и модулей в его зоне ответственности.
    - Дай пошаговый план работы: что делать в первые 2 часа, что во второй половине дня,
    ￹что на следующий день.
    - Сигнатуры ключевых функций, интерфейсов или компонентов, которые он должен
    ￹реализовать.
    - Как он тестирует свою часть изолированно, не дожидаясь остальных двоих.

    2. СИНХРОНИЗАЦИЯ И СВЯЗКА (ДАННЫЕ):
    - Предложи единый набор из 6 тестовых профилей бизнеса (seed-данные: реквизиты,
    ￹финансы, скоринг-факторы и итоговый вердикт), на которых сойдутся юнит-тесты Dev 1,
    ￹моки Dev 2 и демо-кнопки Dev 3.
    - Как Dev 2 в первый же час отдаёт Dev 3 заглушечный API, чтобы фронт не простаивал.

    3. ПОДВОДНЫЕ КАМНИ ИНТЕГРАЦИИ:
    - В каких точках эти 3 слоя обычно конфликтуют при сборке воедино и как это
    ￹предотвратить с самого начала?

    4. ФОРМАТ РАБОТЫ С ТОБОЙ (ОРГАНИЗАЦИЯ И ТОКЕНЫ):
    - У нас связка: ты (Claude Opus / Plan) + GLM-5 / cglm (Build) + ограниченный бюджет на
    ￹токены.
    - Как нам оптимально выстроить процесс дальше: ты сейчас выдаёшь один исчерпывающий
    ￹мастер-план и мы все этапы пишем через GLM в build-режиме, или тебя стоит подключать
    ￹повторно (например, в explore/plan) на определённых контрольных точках? Если подключать
    ￹— то на каких именно? 

---

## Assistant

# Персональные планы, общие данные и процесс до сдачи (24–26.10)

Контекст: в репозитории пока только bootstrap-коммит, `frontend/` пустой, `backend/` нет. Значит, на субботу приходятся сразу фазы 0 и 1. Воскресенье уходит на интеграцию, понедельник на сдачу. Ниже T обозначает момент старта сегодня.

Перед параллельной работой нужна общая встреча на 30 минут. На ней команда фиксирует перечисления, DTO, список эндпоинтов, таблицу персон (раздел 2) и владельцев общих файлов. Без этого все три плана расходятся.

---

## 1. Персональные планы

### Dev 1: домен, скоринг, FSM (чистый Python, TDD)

Структура:

```
backend/app/domain/
  enums.py                # ApplicationStatus, Actor, Outcome, Route, Grade, OfferKind, LegalForm, ReasonCode
  errors.py               # DomainError, TransitionError, PolicyViolation
  money.py                # аннуитет, обратный аннуитет, округления
  application_status.py   # FSM: граф, акторы, история
  scoring/
    inputs.py             # FnsData, BkiData, AccountData, LoanRequest, ScoringInputs (frozen dataclasses)
    result.py             # Factor, Constraint, OfferDraft, ScoringResult, SimulationResult
    policy.py             # Product, Policy, POLICY_V1
    knockout.py
    scorecard.py          # 5 факторов M1–M5
    pricing.py
    affordability.py      # DSCR, лимиты, binding constraint
    counter_offer.py
    explain.py            # каталог reason codes → client_text / hint
    engine.py             # evaluate / simulate / pre_approve
    serialization.py      # to_jsonable / from_jsonable для снимков в JSONB
backend/tests/domain/
  test_money.py  test_fsm.py  test_knockout.py  test_scorecard.py  test_pricing.py
  test_affordability.py  test_counter_offer.py  test_engine_personas.py
  test_properties.py  test_serialization.py  test_import_boundary.py
  golden/p1_ideal.json … p6_mismatch.json
```

Ключевые сигнатуры:

```python
# money.py — Decimal везде, float запрещён
def annuity_payment(principal: Decimal, annual_rate_pct: Decimal, term_months: int) -> Decimal: ...
def max_principal(payment: Decimal, annual_rate_pct: Decimal, term_months: int) -> Decimal: ...
def round_down(value: Decimal, step: Decimal) -> Decimal: ...          # суммы: вниз до 10 000
def to_kopecks(value: Decimal) -> Decimal: ...                          # платежи: ROUND_HALF_UP

# application_status.py
TRANSITIONS: Mapping[tuple[ApplicationStatus, ApplicationStatus], frozenset[Actor]]
TERMINAL: frozenset[ApplicationStatus]
ACTIVE: frozenset[ApplicationStatus]        # для поллинга на фронте: SUBMITTED, SCORING
@dataclass(frozen=True)
class StatusEvent: from_: ApplicationStatus | None; to: ApplicationStatus; actor: Actor; reason: str | None; at: datetime
def allowed_targets(src: ApplicationStatus, actor: Actor) -> frozenset[ApplicationStatus]: ...
def transition(src: ApplicationStatus, dst: ApplicationStatus, actor: Actor, *, at: datetime, reason: str | None = None) -> StatusEvent: ...  # raises TransitionError

# scoring
def check_knockouts(inp: ScoringInputs, p: Policy) -> list[Factor]: ...        # собирает ВСЕ стоп-факторы, без short-circuit
def score(inp: ScoringInputs, p: Policy) -> tuple[int, Grade, list[Factor]]: ...
def price(product: Product, grade: Grade, term_months: int, p: Policy) -> Decimal: ...
def amount_limit(inp: ScoringInputs, grade: Grade, term_months: int, p: Policy) -> tuple[Decimal, list[Constraint]]: ...
def build_offers(inp: ScoringInputs, grade: Grade, p: Policy) -> tuple[Outcome, list[OfferDraft], str | None]: ...
def evaluate(inp: ScoringInputs, p: Policy) -> ScoringResult: ...                # recommendation + route (AUTO | UNDERWRITING)
def simulate(inp: ScoringInputs, p: Policy, amount: Decimal, term_months: int) -> SimulationResult: ...
def pre_approve(inp_without_request: ScoringInputs, p: Policy) -> Decimal | None: ...
```

Одно изменение относительно прошлого плана. Если фактор M2 в скоринговой карте считать как DSCR с новым платежом, возникает цикл: грейд → премия за риск → ставка → платёж → DSCR → баллы → грейд. Поэтому M2 в карте — текущая долговая нагрузка (`существующие платежи / NCF`). DSCR с новым платежом остаётся жёстким ограничением на третьей стадии, уже после определения грейда.

План работы:
- T…T+2ч:
  - На общей встрече закоммитить `enums.py`, `inputs.py`, `result.py` хотя бы с полями без логики: Dev 2 нужны эти типы для портов.
  - Затем `money.py` с тестами на эталонные аннуитеты.
  - FSM с табличным тестом: каждая пара (from, to, actor) либо разрешена, либо даёт `TransitionError`.
  - `POLICY_V1`.
- Вторая половина субботы:
  - `knockout` → `scorecard` → `pricing` → `affordability` → `counter_offer` → `evaluate`, каждый шаг через красный тест.
  - К вечеру зелёный `test_engine_personas.py` на все шесть персон: исход, маршрут, грейд, виды офферов, binding constraint.
  - Выгрузить golden-файлы, Dev 2 переключит на них заглушку.
- Воскресенье:
  - `simulate` и `pre_approve`.
  - Контрфактические подсказки.
  - Краевые случаи: нулевые поступления, история меньше 3 месяцев, ИП и ООО.
  - `serialization.py` с тестом round-trip.
  - Property-тесты: монотонность по оборотам, `offer.amount ≤ requested`, `payment ≤ P_max`, `simulate == evaluate` на одном снимке.
  - Тест смены `key_rate`: меняется `policy_version` и пересчитываются ставки.
  - После обеда — помощь Dev 2 в сервисном слое и `docs/scoring.md` с методикой, порогами и обоснованием (Q37, Q49).

Изоляция: только pytest без БД и сети, тесты идут за миллисекунды. Тест `test_import_boundary.py` разбирает AST и падает, если `domain/` импортирует `fastapi`, `sqlalchemy`, `pydantic` или `app.mocks`. Оракул — таблица персон, ни от кого из коллег не зависит.

### Dev 2: платформа, API, БД, моки, инфраструктура

Структура:

```
backend/
  pyproject.toml  uv.lock  Dockerfile  alembic.ini  alembic/versions/0001_init.py
  app/
    main.py               # create_app(); БД при импорте НЕ трогать
    config.py             # Settings: DATABASE_URL, JWT_SECRET, KEY_RATE_PCT, APP_MODE=stub|real, LLM_*
    api/
      schemas.py          # DTO — контракт (Money-тип, enum'ы из domain.enums)
      mappers.py          # domain ↔ DTO ↔ ORM, единственное место конвертации
      errors.py           # DomainError → HTTP + единый ErrorDTO, переопределённый 422
      deps.py             # get_session, current_user, require_role, get_app_service
      routers/ health.py auth.py demo.py products.py companies.py applications.py bank.py
    services/
      ports.py            # Protocol'ы шлюзов + ApplicationServicePort
      applications.py     # реальный сервис
      stub.py             # in-memory сервис для фронта
      scoring_runner.py   # фоновый прогон
      signing.py          # OTP: генерация, хэш, TTL, попытки
    db/ base.py session.py models.py repositories.py
    mocks/ registry.py fns.py bki.py account.py core_banking.py
    seed/ personas.json seed.py           # python -m app.seed, идемпотентный
    llm/ explainer.py                      # опционально, OpenAI-совместимый, с fallback
  tests/ mocks/ services/ api/ e2e/
docker-compose.yml  .env.example  docs/
```

Сигнатуры:

```python
# services/ports.py
class FnsGateway(Protocol):
    def get_company(self, inn: str) -> FnsData: ...
class BkiGateway(Protocol):
    def get_report(self, inn: str, subject: Literal["COMPANY", "PERSON"]) -> BkiData: ...
class AccountGateway(Protocol):
    def get_turnover(self, company_id: UUID, months: int = 12) -> AccountData: ...
class CoreBanking(Protocol):
    def open_loan_account(self, application_id: UUID, amount: Decimal) -> str: ...
class Clock(Protocol):
    def now(self) -> datetime: ...

class ApplicationServicePort(Protocol):          # реализуют и Stub, и Real
    def create_draft(self, user: User, data: ApplicationIn) -> ApplicationOut: ...
    def update_draft(self, user: User, app_id: UUID, data: ApplicationIn, version: int) -> ApplicationOut: ...
    def submit(self, user: User, app_id: UUID, version: int) -> ApplicationOut: ...
    def simulate(self, user: User, app_id: UUID, data: SimulationIn) -> SimulationOut: ...
    def accept_offer(self, user: User, app_id: UUID, offer_id: UUID) -> SigningChallenge: ...
    def sign(self, user: User, app_id: UUID, data: SignIn) -> ApplicationOut: ...
    def cancel(self, user: User, app_id: UUID) -> ApplicationOut: ...
    def bank_queue(self, user: User, status: ApplicationStatus | None) -> list[ApplicationSummary]: ...
    def dossier(self, user: User, app_id: UUID) -> BankDossier: ...
    def decide(self, user: User, app_id: UUID, data: UnderwriterDecisionIn) -> ApplicationOut: ...
    def rescore(self, user: User, app_id: UUID) -> ScoringRunOut: ...

def run_scoring(app_id: UUID) -> None: ...      # своя сессия, SUBMITTED→SCORING→исход, идемпотентно
```

Эндпоинты `/api/v1`:

| Метод и путь | Назначение |
|---|---|
| `POST auth/login`, `GET auth/me` | вход и текущий пользователь |
| `GET demo/personas`, `POST demo/reset` | без авторизации, для кнопок входа и сброса демо |
| `GET products` | продукты |
| `GET companies/me` | профиль компании и `pre_approved_limit` |
| `GET\|POST applications`, `PATCH applications/{id}` | заявки клиента |
| `POST applications/{id}/{submit,simulate,accept,sign,cancel}` | команды по заявке |
| `GET bank/applications`, `GET bank/applications/{id}` | очередь и досье |
| `POST bank/applications/{id}/{decision,rescore}` | решение андеррайтера, повторный прогон |
| `GET bank/metrics` | метрики конвейера |

План работы:
- T…T+1ч (заглушечный API, подробности в разделе 2):
  - `uv init`, FastAPI, `schemas.py` со всеми DTO, роутеры, `StubApplicationService`.
  - Каталог `docs/` и экспорт `docs/openapi.json`, push.
- T+1…T+2ч:
  - compose с `db` и `backend`, `Settings`, `/health`, зелёный `check.sh`.
  - Вместе с Dev 1 — `personas.json`, затем моки, которые читают его через `registry.py`.
- Вторая половина субботы:
  - `models.py` и миграция `0001` (sync SQLAlchemy + psycopg 3: проще для GLM, и `BackgroundTasks` работают без async-ловушек).
  - Репозитории, JWT (PyJWT) и bcrypt, RBAC, seed пользователей.
  - Реальный `ApplicationService`. Пока движка Dev 1 нет — временный `FakeEvaluator`, который возвращает `expected` персоны.
  - Фоновый скоринг, OTP-подпись, мок АБС.
- Воскресенье:
  - Банковские эндпоинты, `rescore`, `metrics`, `demo/reset`.
  - 409 при конфликте `version`.
  - Ленивое истечение офферов при чтении и при accept: планировщик не нужен.
  - E2E на уровне API для шести персон.
  - Dockerfile фронта с nginx и проксированием `/api`.
  - `.env.example`, `THIRD_PARTY_NOTICES.md`, черновик README, замер RAM на `docker compose up`.

Изоляция:
- Моки тестируются против `personas.json`.
- Сервисы — с фейковыми портами и `FixedClock`.
- API — `TestClient` в режиме `APP_MODE=stub`, БД не нужна.
- Тесты с БД работают против Postgres из compose. Без БД они пропускаются с явной причиной в `conftest.py` (AGENTS.md требует обоснования для skip). Перед мержем их прогоняют с поднятым `db`.
- Контракт контролируется diff'ом `docs/openapi.json` в каждом PR.

### Dev 3: фронтенд (оба контура)

Структура:

```
frontend/
  package.json  package-lock.json  vite.config.ts (proxy /api → :8000)
  tsconfig.json (один, strict, без references)  eslint.config.js (ignore dist, src/api/schema.d.ts)
  Dockerfile  nginx.conf
  src/
    main.tsx  App.tsx  router.tsx
    api/
      schema.d.ts         # генерируется: npm run gen:api (openapi-typescript ← ../docs/openapi.json)
      client.ts           # fetch-обёртка: /api/v1, Bearer, ApiError из ErrorDTO, 401 → logout
      keys.ts  queries.ts # хуки TanStack Query
    auth/ AuthProvider.tsx RequireRole.tsx LoginPage.tsx
    shared/
      format.ts           # formatMoney(str) без parseFloat, formatPct, formatDate (Europe/Moscow)
      status.ts           # STATUS_LABEL, STATUS_VIEW (exhaustive по ApplicationStatus)
      components/ AppLayout StatusBadge Timeline FactorList MoneyText ErrorBanner ConfirmDialog
    client/
      DashboardPage.tsx  NewApplicationPage.tsx  ApplicationPage.tsx
      panels/ ScoringProgress DecisionPanel OffersList Simulator SigningPanel DisbursedPanel RejectedPanel
    bank/
      QueuePage.tsx  DossierPage.tsx  MetricsPage.tsx
      panels/ ScoringTrace InputsSnapshot AuditLog DecisionForm
    test/ setup.ts fixtures.ts   # фикстуры типизированы через schema.d.ts
```

Сигнатуры:

```tsx
// api/queries.ts
export function useApplication(id: string): UseQueryResult<ApplicationOut>   // refetchInterval: ACTIVE.has(status) ? 1500 : false
export function useSimulate(id: string): UseMutationResult<SimulationOut, ApiError, SimulationIn>
export function useAccept(id: string): UseMutationResult<SigningChallenge, ApiError, { offer_id: string }>
export function useSign(id: string): UseMutationResult<ApplicationOut, ApiError, SignIn>
export function useDecision(id: string): UseMutationResult<ApplicationOut, ApiError, UnderwriterDecisionIn>

// компоненты
function ApplicationPage(): JSX.Element            // switch(status) → панель; default: assertNever(status)
function Simulator(p: { applicationId: string; product: Product; initial: { amount: string; termMonths: number } }): JSX.Element // debounce 300 мс, ноль финансовой арифметики
function FactorList(p: { factors: Factor[]; audience: "client" | "bank" }): JSX.Element
function Timeline(p: { history: StatusEvent[]; current: ApplicationStatus }): JSX.Element
function OffersList(p: { offers: Offer[]; onAccept: (offerId: string) => void; pending?: boolean }): JSX.Element
function SigningPanel(p: { applicationId: string; challenge: SigningChallenge }): JSX.Element
function DecisionForm(p: { applicationId: string; recommendation: Outcome; offers: Offer[]; version: number }): JSX.Element
```

План работы:
- T…T+2ч:
  - Vite, strict TS, eslint, vitest + Testing Library, router, `AppLayout`.
  - `@alfalab/core-components`: импорты по компонентам, а стили и совместимость с React 18 сверить через context7 (сам я это не проверял).
  - `format.ts` и `status.ts` с тестами.
  - `LoginPage` на фикстурах.
  - С T+1ч сгенерировать `schema.d.ts` из заглушки.
- Вторая половина субботы — клиентский путь против заглушки: дашборд → новая заявка → страница заявки с поллингом и таймлайном → решение с факторами и офферами → подпись → «Выдано».
- Воскресенье:
  - `Simulator` с полосами ограничений.
  - Банковский контур: очередь, досье с трассой, форма решения, метрики.
  - Переход на реальный бэкенд, обработка 401/403/409/422.
  - Кнопка «Сбросить демо», Dockerfile с nginx.
- Понедельник — только багфиксы и скриншоты для README.

Изоляция:
- Компоненты тестируются в vitest с фикстурами из `test/fixtures.ts`. Фикстуры типизированы схемой, поэтому изменение контракта сразу ломает `tsc`.
- Сквозной путь гоняется против stub-бэкенда (`APP_MODE=stub uv run uvicorn app.main:app`). MSW не нужен: заглушка уже настоящий HTTP с настоящей схемой.

---

## 2. Связка через данные

### Шесть персон: единый оракул

Единый источник — `backend/app/seed/personas.json`. Его читают тесты Dev 1, моки Dev 2 и (через `GET /demo/personas`) кнопки входа Dev 3. У фронта своей копии нет.

Политика v1 для расчётов:
- Ставка: `key_rate` = 16,5% (плейсхолдер, перед сдачей сверить с cbr.ru) + спред продукта (`WC_FLEX` 4,0; `CAPEX` 3,0) + премия за риск (A 0, B 2, C 4) + премия за срок (≤12 мес 0; 13–24 мес 0,5; 25–36 мес 1,0; 37–60 мес 1,5).
- Ограничения: `DSCR_min` = 1,3; лимит от выручки — 0,4 × поступления по счёту за 12 мес; потолки по грейду A 10 млн, B 5 млн, C 3 млн.
- Сетка сроков — шаг 6 мес.
- Автоматическое решение — до 5 млн включительно, больше уходит андеррайтеру.
- Грейды: A ≥ 75, B 60–74, C 45–59 (андеррайтер), D < 45 (отказ).

| # | Логин / компания | Форма, возраст | Счёт: поступления/мес, CV, NCF | БКИ | ФНС | Запрос | Баллы M1–M5 | Вердикт (контракт) |
|---|---|---|---|---|---|---|---|---|
| P1 | `p1` / ИП Соколова, кофейни | ИП, 74 мес | 1,8 млн; 0,10; NCF 450к; долг 0 | чисто | выручка 21 млн, расхождение 3% | WC_FLEX 2 млн / 24 мес | 20/20/25/15/20 = 100 → A | APPROVED, AUTO, оффер REQUESTED ≈ 21,0%, платёж ≈ 103к |
| P2 | `p2` / ООО «СеверСтрой» | ООО, 42 мес | 1,2 млн; 0,30; NCF 200к; долг 40к/мес | закрытая просрочка 1–29 дн | расхождение 10% | WC_FLEX 2,5 млн / 12 мес | 12/12/15/15/20 = 74 → B | COUNTER_OFFER, binding `DSCR`: LONGER_TERM 2,5 млн / 30 мес ≈ 23,5%; REDUCED_AMOUNT ≈ 1,21 млн / 12 мес |
| P3 | `p3` / ООО «ТехноЛайн» | ООО, 60 мес | 2,5 млн; 0,30; NCF 500к; долг 250к/мес | чисто, 6 запросов за 30 дн | расхождение 8% | WC_FLEX 4,5 млн / 36 мес | 12/5/20/15/20 = 72 → B | COUNTER_OFFER, binding `DSCR`: только REDUCED_AMOUNT ≈ 3,45 млн / 36 мес (срок уже максимальный) |
| P4 | `p4` / ИП Морозов | ИП, 48 мес | 0,9 млн; 0,20; NCF 200к | текущая просрочка 45 дн | чисто | WC_FLEX 1 млн / 12 мес | не считаются | REJECTED, knockout `BKI_CURRENT_OVERDUE`, офферов нет |
| P5 | `p5` / ООО «Старт Плюс» | ООО, 2 мес | 2 мес истории: 300к и 450к | пусто | декларации нет | WC_FLEX 1 млн / 12 мес | не считаются | REJECTED, knockout `BUSINESS_TOO_YOUNG` и фактор `INSUFFICIENT_DATA`, подсказка с датой повторной подачи |
| P6 | `p6` / ООО «Агро-Юг» | ООО, 84 мес | 1,5 млн; 0,45 (сезонность); NCF 350к; долг 50к/мес | чисто | выручка 32 млн при 18 млн по счёту (44%) | CAPEX 3 млн / 24 мес | 12/20/25/0/20 = 77 → A | Рекомендация APPROVED, маршрут UNDERWRITING по флагу `FNS_MISMATCH`. Демо: андеррайтер одобряет с комментарием «выручка идёт через другой банк» |

Плюс банковская учётка `underwriter`. Пароль у всех `demo`, кнопки входа на `LoginPage`.

Правила для этих данных:
1. Контракт — исход, маршрут, грейд, виды офферов, binding constraint и коды топ-причин. Суммы с точностью до копейки контрактом не являются: они берутся из golden-файлов движка, а в таблице стоят ориентиры «≈».
2. Значения метрик должны отстоять от порогов бинов минимум на 20%, иначе тест упадёт при любой правке политики. P2 и P3 устойчивы к изменению ключевой ставки на ±2 п.п. (я проверял на расчётах для P3 при долге 250к).
3. Даты задаются относительно: `registered_months_ago`, `client_since_months_ago`. Seed вычисляет даты от `Clock`, тесты используют `FixedClock`. Иначе P5 через месяц после сдачи перестанет быть «свежей».
4. `outflows` — операционные расходы без платежей по кредитам. Платежи по долгу берутся только из `bki.monthly_payments`, чтобы не учесть их дважды.
5. ИНН вымышленные: 12 цифр у ИП, 10 у ООО, с корректной контрольной суммой.

Форма записи:

```json
{
  "id": "p2_longer_term", "login": "p2",
  "company": { "inn": "…", "ogrn": "…", "legal_form": "OOO", "name": "ООО «СеверСтрой»", "okved": "41.20",
               "registered_months_ago": 42, "client_since_months_ago": 30 },
  "fns": { "status": "ACTIVE", "declared_revenue_12m": "15800000", "tax_debt": "0" },
  "bki": { "current_overdue_days": 0, "max_overdue_days_12m": 0, "max_overdue_days_24m": 12,
           "inquiries_30d": 1, "monthly_payments": "40000", "active_loans": 1 },
  "account": { "months_history": 12, "inflows": ["…12 значений…"], "outflows": ["…"] },
  "draft_request": { "product_code": "WC_FLEX", "amount": "2500000", "term_months": 12, "purpose": "WORKING_CAPITAL" },
  "expected": { "outcome": "COUNTER_OFFER", "route": "AUTO", "grade": "B",
                "offer_kinds": ["LONGER_TERM", "REDUCED_AMOUNT"], "binding_constraint": "DSCR",
                "top_reasons": ["DSCR_BELOW_MIN", "TURNOVER_VOLATILE", "BKI_PAST_OVERDUE_MINOR"] }
}
```

### Заглушечный API в первый час

1. Роутеры и DTO финальные с первой минуты. Через `Depends(get_app_service)` при `APP_MODE=stub` подставляется `StubApplicationService`, при `real` — реальный сервис. Пути и схемы одни и те же, переключение — один флаг.
2. Заглушка хранит состояние в памяти:
   - `submit` переводит заявку в SCORING, через 2 с она получает исход из `expected` персоны с захардкоженными факторами и офферами;
   - `accept` возвращает `SigningChallenge` с кодом на экране;
   - `sign` проводит SIGNED → DISBURSED.
   Фронт получает живой процесс с поллингом без БД.
3. В субботу вечером заглушка переходит с `expected` на golden-файлы Dev 1: фронт видит настоящие тексты причин.
4. Push `docs/openapi.json`. Dev 3 запускает `npm run gen:api`. Vite проксирует `/api` на `localhost:8000`, в проде nginx проксирует тот же путь. CORS не нужен вообще.
5. Контракт меняется только через PR, затрагивающий `schemas.py`, с пингом команде. Diff `openapi.json` виден в ревью.

---

## 3. Подводные камни интеграции

| Точка конфликта | Симптом | Профилактика с первого дня |
|---|---|---|
| Деньги | `0.1+0.2`, `"2500000.00"` против `2500000`, в OpenAPI `anyOf number/string` | Один тип `Money = Annotated[Decimal, PlainSerializer(str), WithJsonSchema({"type":"string","format":"decimal"})]`. В JSONB — строки. Фронт не делает `parseFloat`: `formatMoney` работает со строкой |
| Разделение Input/Output-схем в FastAPI | В TS появляются `Offer-Input` и `Offer-Output`, типы раздваиваются | `FastAPI(separate_input_output_schemas=False)` |
| Расхождение enum'ов | Фронт ждёт `COUNTEROFFER`, бэк шлёт `COUNTER_OFFER` | Единственный источник — `domain/enums.py` → Pydantic → OpenAPI → TS union. Строки руками не повторяются. `assertNever` в `switch` по статусу |
| Тексты причин | Фронт сам переводит reason codes, тексты расходятся | Бэкенд отдаёт `client_text` и `hint` из `explain.py`. Фронт только отображает |
| Три представления данных (dataclass / Pydantic / ORM) | Конвертация размазана по роутерам, в снимок попадают float или date | Конвертация только в `api/mappers.py` и `domain/serialization.py`, с тестом round-trip |
| Обход FSM | Dev 2 пишет `app.status = ...`, история теряется | Изменение статуса только в `repositories.apply_transition()`: вызывает `transition()` и пишет `status_history` в той же транзакции. Архитектурный тест ищет присваивания `.status =` вне этого места |
| Фоновый скоринг | Используется сессия запроса после ответа; двойной прогон при повторном клике; первый поллинг видит SUBMITTED | Своя сессия в `run_scoring`. Идемпотентность: не запускать, если статус уже не SUBMITTED. Фронт считает SUBMITTED и SCORING одинаково «в процессе» |
| Гонки и устаревшие данные | Андеррайтер и клиент действуют одновременно | `version` в каждой команде, 409 с `code=VERSION_CONFLICT`, фронт делает refetch и показывает баннер |
| Формат ошибок | 422 Pydantic в одном формате, доменные ошибки в другом | Единый `ErrorDTO {code, message, details}`, свой обработчик 422. Маппинг: `TransitionError`→409, `NotFound`→404, `Forbidden`→403 |
| Утечка банковских данных клиенту | Клиент видит пороги и сырой БКИ | Разные DTO: `ApplicationOut.decision` (клиентский вид) и `BankDossier` (трасса и снимок). Тест: клиент получает 403 на `/bank/*` и 404 на чужую заявку |
| Время | Сдвиг на 3 часа, «свежая» компания стареет | UTC с таймзоной на бэке, `Clock`-порт, относительные даты в персонах, форматирование в Europe/Moscow на фронте |
| Специфика `check.sh` | `> ../docs/openapi.json` падает без каталога `docs/`; импорт `app.main` падает, если при импорте есть подключение к БД; `tsc --noEmit -p .` с Vite-шаблоном (`files: []` + references) ничего не проверяет; eslint ругается на `dist/` и `schema.d.ts` | Создать `docs/` в первый час. Ленивый engine. Один `tsconfig.json` без references. Игнор сгенерированных файлов в eslint |
| Compose | Порт 5432 занят на хосте; backend стартует раньше БД; повторный seed дублирует данные | Порт `db` не публиковать. `depends_on: condition: service_healthy`. Команда `alembic upgrade head && python -m app.seed && uvicorn`, seed идемпотентный |
| Lock-файлы и миграции | Конфликты в `uv.lock` и `package-lock.json`, две головы Alembic | Зависимости добавляет один человек в зоне; при конфликте lock генерируется заново, а не мержится руками. Миграции создаёт только Dev 2 |

Точки синхронизации: T+0,5ч (контракт), T+2ч (заглушка и типы), конец субботы (движок и golden-файлы), воскресенье в обед (реальный сервис вместо заглушки), воскресенье вечером (фриз фич), понедельник 12:00 (release candidate на чистом клоне). Мерж в `main` только при зелёном `harness_check`.

---

## 4. Как работать со мной при ограниченном бюджете

Один исчерпывающий мастер-план для GLM я не рекомендую. Он устареет к вечеру субботы, а GLM на длинном контексте начнёт отклоняться от него. Рабочая схема такая: GLM пишет, Opus проверяет на нескольких контрольных точках. Ревью diff'а стоит в разы дешевле генерации, а ошибки в финансовой математике и FSM — самые дорогие.

Сразу (GLM, build):
- Превратить `opus_ans.md` (он лежит в корне и не закоммичен) и этот ответ в OpenSpec-change через `/opsx-propose`: proposal, design (DTO, FSM, политика, персоны), `tasks.md` с тремя блоками по разработчикам.
- Каждая сессия GLM грузит только свой блок `tasks.md` и нужный раздел design, а не весь документ.

Где подключать меня:

| КТ | Когда | Что принести | Что я делаю |
|---|---|---|---|
| КТ1 | Сегодня, сразу после `/opsx-propose` | Пути к артефактам change | Ревью контракта: DTO, enum'ы, FSM, `personas.json`. Самая высокая окупаемость: ошибка здесь бьёт по всем троим |
| КТ2 | Суббота, вечер | `git diff main -- backend/app/domain backend/tests/domain` | Финансовая корректность: аннуитеты, округление, binding constraint, инварианты, полнота тестов |
| КТ3 | Воскресенье, обед | Diff `services/`, `api/deps.py`, `db/repositories.py` | Транзакционные границы, FSM, RBAC, OTP, идемпотентность. Это зона безопасности |
| КТ4 | Понедельник, утро | Результат skill `deliverables-audit` (его запускает GLM), README, `docs/scoring.md` | Аудит перед сдачей, формулировки для жюри, демо-сценарий по персонам |
| Эскалация | Когда GLM дважды не может починить одну проблему | Минимальное воспроизведение и вывод теста | Диагностика первопричины |

Экономия токенов:
- Приносить мне diff и пути, а не просить «посмотри проект».
- SPEC в контекст целиком не грузить, ссылаться на § и номера Q&A (это уже правило в AGENTS.md).
- От меня брать списки замечаний, а не переписанный код. Правки применяет GLM.
- GLM пишет тесты первыми, по таблице персон. Тесты сдерживают более слабую модель, а мне дешевле проверить 150 строк тестов, чем 600 строк реализации.
- Короткие сессии GLM: одна задача из `tasks.md`, в конце `harness_check`, потом новая сессия.

Сейчас включён Plan-режим, поэтому файлы я не создавал. Следующий шаг — переключиться на build и запустить `/opsx-propose` с этим ответом на входе, потом позвать меня на КТ1.
