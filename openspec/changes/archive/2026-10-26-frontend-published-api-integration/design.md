# Design

## Context

main 2cf159e содержит APP_MODE=real PostgreSQL и stub с доменным engine. Опубликованы 21 HTTP операция (проверено по OpenAPI), включая PATCH, simulate, accept, sign, cancel, company/products, scoring-runs и demo/reset. GET application/id отсутствует: читать из собственного списка.

## Goals / Non-Goals

Полный доступный клиентский путь и банковский контур через реальные DTO. Никаких seed fallback, финансовых расчётов в JS, выдуманных KPI или новых бизнес-маршрутов.

## Decisions

- Generated schema.d.ts является источником DTO. HttpApi охватывает каждый опубликованный маршрут; version и offer_id передаются query, SignIn только code. authToken конкретного запроса защищает новый login/me от старой сессии.
- Отдельные HTTP views не заполняют отсутствующие поля богатых mock-моделей. Query keys включают mode/user/epoch, AbortSignal на чтениях; команды без retry, двойных кликов, позднего redirect после logout. Ошибки 401/403/409/422 и ErrorDTO/detail обрабатываются безопасно.
- Профиль и каталог запрашиваются независимо. Форма выбирает серверный продукт; деньги строками, срок int; сохранение/редактирование DRAFT по PATCH с version. Локальные согласия перед submit явно не хранятся API. Повтор submit использует уже созданный id.
- Поллинг 1500 мс для SUBMITTED/SCORING/SIGNED и ожидания UNDERWRITING (чтобы показать решение сотрудника). При ошибке поллинг останавливается. Решение показывает клиентские объяснения и офферы, не банковские raw values. Статусы сервера определяют действия.
- Симулятор debounce300 + AbortSignal, результат только последнего ввода, amount строка. Предложение симуляции не становится оффером заявки. Для изменения заявки нужна новая заявка; симулятор не обещает одобрение.
- Accept требует подтверждения и actual offer_id/version; возвращает SigningChallenge code/expires_at. Код хранится только в памяти текущей страницы. После accept читается актуальная version, sign передаёт её. Ошибки и expiry не имитируют повторный challenge: API такого метода не имеет. При reload SIGNING честно предлагает отмену/новую заявку. Выдача только по DISBURSED.
- Очередь показывает реальные ID и поля; досье запрашивает scoring-runs и показывает входы, факторы, result/policy и аудит. Решение outcome/comment после confirm; rescore отдельная команда (не replay). Не обещать optimistic version, которого нет в bank DTO. Метрики шесть счётчиков; sandbox/replay остаются только Mock.
- Demo reset после подтверждения POST /demo/reset и logout/cache clear. Локальные presets/failure injection доступны только Mock.
- Nginx SPA fallback, /api proxy на backend:8000; frontend Docker multistage npm ci/build, compose frontend:8080. Vite proxy локально backend8000. Production default API, mock явно переключаем.

## API / Data changes

Новых API/моделей нет. Допустимы минимальные исправления обнаруженных несоответствий реализации опубликованным DTO (каталог stub, сигнатуры bank stub), с регрессионными тестами. Доменные scoring/FSM/политики не меняются.

## Risks / Trade-offs

Контракт не хранит согласия/purpose в ApplicationOut, не даёт GET/id, восстановления OTP, sandbox/replay, расширенных KPI и банковских названий компаний. UI явно сохраняет эти пределы. Docker socket может быть недоступен пользователю: HTTP stub smoke обязателен, PostgreSQL проверка честно помечается непроведённой, если запуск невозможен; это не повод подменять БД.
