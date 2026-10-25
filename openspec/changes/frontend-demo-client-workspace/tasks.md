# Tasks

## 1. Мок-режим
- [x] 1.1 (60–90 мин) Генератор backend-фикстур и статусов, gateway/mock-state, задержки/ошибки/reset и отмена/изоляция; README и тесты. Проверка: тесты gateway, typecheck, harness_check exit 0, повторная генерация без diff.

## 2. Вход и роли
- [x] 2.1 (60–90 мин) AuthProvider, LoginPage, RequireRole, выход, безопасный returnTo, явный режим и демо-панель. Тесты навигации, ролей, refresh, ошибок и позднего входа; README. Проверка: Vitest/typecheck/harness_check exit 0.

## 3. Статусы
- [x] 3.1 (30–60 мин) Exhaustive статус-карта, StatusBadge и Timeline с московскими датами и защитой неизвестного статуса. Тесты и README. Проверка: целевые тесты, lint и harness_check exit 0.

## 4. Кабинет
- [x] 4.1 (60–90 мин) Query keys/хуки профиля, продуктов и заявок; DashboardPage с независимыми состояниями и ссылками. Тесты загрузки, empty/error/retry и сессий; README. Проверка: Vitest/typecheck/harness_check exit 0.

## 5. Форма
- [ ] 5.1 (60–90 мин) NewApplicationPage: ограничения продуктов, денежная строка, срок/цель, согласия, сохранение/продолжение черновика и однократная подача с version. Тесты границ, ошибок, согласий и повтора без дубля; README. Проверка: Vitest/typecheck/harness_check exit 0.

## 6. Заявка
- [ ] 6.1 (60–90 мин) ApplicationPage: условия, история, стадии/результат, polling 1500 мс только ожидания, безопасные ошибки и неизвестный статус. Тесты поллинга, ухода/logout и доступа; README. Проверка: Vitest/typecheck/harness_check exit 0 и браузерный проход 1280/1440.

## 7. Интеграция
- [ ] 7.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Проверка: harness_check exit 0, build, OpenSpec strict, git diff --check; при отсутствии API экспорт не создавать, без новых зависимостей lock/notices не менять искусственно. Проверить демо в браузере, синхронизировать specs и архивировать после реализации, сохранить коммиты.
