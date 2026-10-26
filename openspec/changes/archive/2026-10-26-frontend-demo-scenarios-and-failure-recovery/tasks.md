# Tasks

План №14 применяется после №12 и №13. Реализация завершена; все задачи выполнены и проверены. Реальный HTTP gate не закрывается тестами mock.

## 1. Каталог и данные
- [x] 1.1 (60–90 мин) Генератор пресетов и ScenarioDataset/schemaVersion: factory, P1 draft/approved/signing/signed/expired/disbursed, P2/P3 counter, P4/P5 reject, P6 review. Проверить полные FSM истории/consents/офферы/TTL, retime через injected clock. Критерий: replay всех историй, стабильная генерация, --check, никакой одиночной подмены status или автоматической авторизации.
- [x] 1.2 (60–90 мин) loadScenario через единый store/provider: transactional dataset replace, session/cache/generation cleanup, отмена старых операций, отдельный full reset factory. Критерий: cancel confirm сохраняет запись/форму/pending, confirm уничтожает stale response, repeated reset идемпотентен; mock-only без fetch.
- [x] 1.3 (45–75 мин) Каталог сценариев в UI с title/стартом/ожидаемыми шагами, launch confirmation и подсказкой входа нужной персоной. Критерий: keyboard/desktop1280/1440, начальная роль не назначается пресетом; API-mode controls недоступны, direct methods не обходят ограничения.

## 2. Сбои и восстановление
- [x] 2.1 (60–90 мин) Адресные FailurePlan/read/command слоты, network status=null, безопасные field errors, ожидает/сработал/отмена; сохранить legacy global next-operation. Критерий: wrong target/abort не потребляет сбой, два concurrent target получают один отказ, reset/mode очищают план; невалидные пары отклонены.
- [x] 2.2 (60–90 мин) UI управления сбоями/задержкой и регрессионная матрица client flows: login/save/submit/accept/sign. Критерий: 401/403/404/409/422/503/network, pending double click, expiration/3 attempts, input retention, no auto retry, no false issuance; старые №1–11 tests проходят.
- [x] 2.3 (60–90 мин) Матрица bank reads/decide/metrics, refresh/reset/logout/mode и late responses. Критерий: сбой до commit не добавляет event/audit/version, конфликт перечитывает без повторного решения, 403 скрывает кеш, метрики/queue/dossier согласованы после успеха.

## 3. Синтетическая песочница
- [x] 3.1 (60–90 мин) Python-реестр 144 комбинаций и исходные baseline-снимки по трём policy; готовые inputs/metrics/results/traces/hashes, отдельный bank export. Критерий: каждый UI tuple существует, evaluate совпадает, policy.version и одинаковый inputHash при сравнении политик, повторная генерация без diff; никакого runtime JS-scoring.
- [x] 3.2 (60–90 мин) Gateway sandboxCatalog/sandboxRun с bank auth и полной scoped key, отсутствие комбинации→422. SandboxPanel с selectors/result/trace/сравнением политик. Критерий: pending/cancel/stale query, неизвестный tuple не показывает старый результат, client запрещён; sandbox не создаёт application/audit и не меняет KPI.
- [x] 3.3 (45–75 мин) Единый reset очищает presets/failures/preview/decisions/challenges и возвращает factory counts; обновить README/DEV_CODEX walkthrough №1–14, HMR reload и mock limits. Критерий: browser P1/P2/P4/P6, ошибка sign/decide, sandbox baseline/просрочка/policy compare, затем reset и корректная очередь/метрики.

## 4. Финальная проверка
- [x] 4.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Критерий: harness_check exit 0, build/размер bundle, strict OpenSpec, diff --check, полный regression №1–13. Не добавлять фиктивный API/ручную schema.d.ts; без новых зависимостей lock/notices не менять искусственно. HTTP E2E остаётся gate после Dev 2.
