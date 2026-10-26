# Tasks

## 1. Основа
- [x] 1.1 (30–60 мин) Объединить main, generated OpenAPI, исправить runtime совместимость; проверить typecheck и backend regression tests.
- [x] 1.2 (60–90 мин) Typed HttpApi всех опубликованных операций, свежий Bearer, безопасные ошибки; проверить transport tests и README контракт.

## 2. UI
- [x] 2.1 (60–90 мин) Профиль/каталог/create/PATCH/submit/list/detail/cancel, версии и retry без дубля; проверить UI contract tests и описание запуска.
- [x] 2.2 (60–90 мин) Офферы/accept/OTP/sign/disburse и debounce simulator, guards; проверить UI tests полного пути/ошибок/старых результатов.
- [x] 2.3 (60–90 мин) Bank queue/dossier/scoring-runs/decision/rescore/metrics, API reset; проверить UI tests ролей и подтверждений, mock regression.

## 3. Проверка
- [x] 3.1 (60–90 мин) Frontend Docker/nginx/compose, документация, настоящий HTTP smoke и browser1280/1440; проверить build, compose config и доступный сервер; ограничения PostgreSQL записать явно.
- [x] 3.2 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Критерий: harness_check exit0, build, strict OpenSpec, diff --check.

## Workflow follow-up
- Синхронизировать и архивировать только собственный завершённый change, platform-api-foundation не трогать.
