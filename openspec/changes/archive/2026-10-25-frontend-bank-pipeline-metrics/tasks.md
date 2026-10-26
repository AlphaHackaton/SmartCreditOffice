# Tasks

Реализация не начата. Применять после №12, когда досье/аудит/общий store завершены. Все задачи остаются открытыми.

## 1. Данные и операционные показатели
- [x] 1.1 (60–90 мин) Реализовать mock metrics(snapshot,filters) и временные модели; валидировать Moscow date interval, product/source, уникальные ids и role. Критерий: unit-тесты cohort/границ/примеров/session, исходный seed total6/decided5/awaiting1, клиент получает403; API-mode не использует mock.
- [x] 1.2 (45–75 мин) Реализовать счётчики outcome/current status/STP/mean/p95/data issues по design; history first decision, duration excludes invalid, null при пустом знаменателе. Критерий: таблица тестов 0/1/N, p95 nearest-rank, override/UNDERWRITING, DISBURSED/EXPIRED/CANCELLED, повторный replay не увеличивает counters; без финансовых вычислений.

## 2. Экран и навигация
- [x] 2.1 (60–90 мин) Заменить /bank/metrics заглушку, добавить scoped metrics query и фильтры draft/applied. Критерий: loading/empty/error/refetch, отмена stale request, 401 logout/403 очистка, filter validation, snapshot/asOf и отсутствие смешения ответов; UI tests/typecheck.
- [x] 2.2 (45–75 мин) Карточки и доступные распределения с таблицами/определениями знаменателей, null/zero, Moscow time и mock note. Критерий: keyboard и desktop1280/1440, длинные названия не ломают layout, нет NaN/Infinity, текст доступен без цвета; компонентные тесты.
- [x] 2.3 (60–90 мин) URL-фильтры MetricsPage/QueuePage, общий cohort predicate, source/date controls очереди и drilldown по current status. Критерий: прямой адрес, Back, сохранение product/date/source, совпадение count очереди с bucket, invalid query reset; прежние фильтры/сортировка №11 не сломаны.
- [x] 2.4 (45–75 мин) Invalidation после решения №12/reset; обновить README/DEV_CODEX формулами и ограничениями. Критерий: P6 manual decision изменяет decided/STP/исход; replay не меняет KPI, logout/смена пользователя не показывает старое; browser mock walkthrough.

## 3. Финальная проверка
- [x] 3.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Критерий: harness_check exit 0, build, strict OpenSpec, git diff --check; regression №1–12. При отсутствии HTTP/новых зависимостей не создавать OpenAPI/не менять notices и lock формально; реальная интеграция остаётся отдельной проверкой после handoff Dev 2.
