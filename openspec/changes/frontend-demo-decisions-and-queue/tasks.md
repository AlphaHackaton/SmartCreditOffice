# Tasks

## 7. Одобрение и офферы
- [x] 7.1 (60–90 мин) Сгенерировать client-safe решение/офферы; FactorList, DecisionPanel, OffersList с expiry/подтверждением/конфликтами и gateway accept. Проверка: генератор --check, gateway/UI tests, harness_check exit 0, README.

## 8. Подписание и выдача
- [x] 8.1 (60–90 мин) Challenge/sign, TTL/3 попытки, восстановление SIGNING, SIGNED→DISBURSED, условия/история и защита поздних команд. Проверка: fake clock gateway/UI tests (неверный код, expiry, повтор, выход), harness_check exit 0.

## 9. Контроффер и симулятор
- [x] 9.1 (60–90 мин) Сравнение альтернатив, ограничения Python, конечная сетка simulate, debounce/cancellation без изменений заявки. Проверка: counter-offer, границы, гонки, неизвестная комбинация, harness_check exit 0.

## 10. Отказ и рассмотрение
- [x] 10.1 (30–60 мин) RejectedPanel и UnderwritingPanel, причины/hints/безопасные действия, без утечки трассы и обещания решения. Проверка: P4/P5/P6 и custom, отсутствие подписания, harness_check exit 0.

## 11. Очередь
- [x] 11.1 (60–90 мин) Bank QueuePage, синтетические и текущие заявки, фильтры/сортировка/поиск, loading/empty/error/retry, ссылка в досье. Проверка: bank/client isolation, filter/sort, reset, harness_check exit 0.

## 12. Проверка
- [ ] 12.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Проверка: harness_check exit 0, build, OpenSpec strict, browser 1280/1440, diff --check; без HTTP/новых зависимостей экспорт и notices не менять искусственно. Обновить README и DEV_CODEX.

## Workflow follow-up

После всех проверок синхронизировать обе новые спецификации и архивировать изменение; сохранить небольшие Conventional Commits. Пользователь разрешил реализацию без промежуточного ревью.
