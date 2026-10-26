# Tasks

## 1. Продуктовый кабинет

- [x] 1.1 Убрать диагностику из каркаса, оставить вход по логину и паролю, обновить продуктовые тексты обоих источников и банковское представление данных; сохранить анализ условий, решения, трассу, аудит и клиентский путь. Обновить тесты входа/маршрутов/сценариев и frontend/README.md. Проверка: vitest, build, браузерная проверка desktop, harness_check exit 0.

## 2. Итоговая проверка

- [x] 2.1 Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md; проверить, что генерация не изменила контракт и зависимости. Проверка: harness_check exit 0 и openspec validate product-workspace-cleanup --strict.

## Verification

- harness_check: exit 0; backend 807 passed, 3 существующих DB-теста skipped; frontend 333 passed.
- Production build: exit 0; предупреждение Vite о размере основного bundle сохранено.
- Desktop: 1280 и 1440, ручной вход клиента и сотрудника, подача заявки, очередь и досье; горизонтального переполнения не обнаружено.
- docs/openapi.json перегенерирован без изменения контракта; lock-файлы не изменились. THIRD_PARTY_NOTICES.md обновлён по существующему npm lock (364 пакета).
