# Tasks

Все задачи реализации открыты. Применять после отдельного запроса пользователя. Порядок №12 → №13 → №14; main specs синхронизировать и архивировать только после реализации/проверок.

## 1. Доменные фикстуры и согласованное состояние
- [x] 1.1 (60–90 мин) Расширить генератор банковской проекцией: inputs/result/metrics/policy/bin metadata, hashes и допустимые BANK-шаблоны с reason через Python FSM. Развести public/bank экспорты. Критерий: повторная генерация без diff, --check ловит drift; P1/P4/P5/P6 и review-вариант P6 CAPEX6млн/24 соответствуют evaluate, null не превращается в 0; нет raw-полей в клиентской Decision.
- [x] 1.2 (60–90 мин) Материализовать seed-* и live в общем mock-store с origin, версиями, историей и отдельным аудитом. Сохранить сигнатуры №1–11, владельцев, временные стадии и TTL. Критерий: старые gateway/auth/client тесты проходят; seed не появляется у клиента, queue/dossier читают один статус; reset возвращает начальные шесть примеров.
- [x] 1.3 (60–90 мин) Добавить dossier/decide/replayDossier и unavailable API-ветку. Проверять роль/статус/version/comment/eligible offer после задержки, фиксировать event+audit+version атомарно. Критерий: тесты 401/403/404/409/422, expiry, double command, reset in-flight; запрет произвольных условий и решения из финала; отказ не несёт оффер.

## 2. Досье и ручная команда
- [x] 2.1 (60–90 мин) Заменить placeholder на DossierPage; scoped hooks bank-dossier/id, loading/error/retry/not-found, link в queue. Добавить readonly InputsSnapshot и ScoringTrace с раскрытием, null и Moscow time. Критерий: direct route, keyboard, 1280/1440, P1/P4/P6; client не отправляет банковские чтения; 403/404 скрывают старые данные.
- [x] 2.2 (60–90 мин) DecisionForm с allowed outcomes, выбором готового offer, comment 1–2000 после trim и ConfirmDialog с override. Обработать pending, 409 refetch, 422 fields, поздний logout/reset/id change без утечки в кеш. Критерий: компонентные тесты обязательного комментария, отсутствия оффера, двух кликов, конфликта и сохранения ввода; только UNDERWRITING отправляет команду.
- [x] 2.3 (45–75 мин) AuditLog и отдельная engine recommendation/final outcome; replay подготовленного снимка с hashes и честным текстом. Критерий: override содержит actor/time/comment/policy/versions, replay не меняет статус/оффер/аудит; mismatch показывает ошибку; служебный комментарий не попадает клиенту.
- [x] 2.4 (60–90 мин) Связать live bank decision с queue/client; invalidate только нужные scoped keys, обновить UnderwritingPanel/README. Критерий: P6 client create → bank approve → client accept/sign/DISBURSED с общей историей; reject блокирует подпись, counter-offer проверяется обязательно на review-варианте P6 CAPEX6млн/24 и допускает только Python-альтернативу. Сквозной UI тест и browser QA.

## 3. Финальная проверка
- [x] 3.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Критерий: harness_check exit 0, production build, строгая OpenSpec-валидация, git diff --check, regression №1–11; README содержит учётки/сценарии/ограничения. Без API и новых зависимостей не создавать фиктивный OpenAPI и не менять lock/notices искусственно.
