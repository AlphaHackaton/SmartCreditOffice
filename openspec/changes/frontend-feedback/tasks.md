# Tasks

## 1. Ошибки

- [ ] 1.1 (30–60 мин) Добавить ErrorBanner на Alfa с безопасным message, необязательным onRetry, pending и защитой повторного вызова до завершения Promise. Вместе добавить тесты alert, пустого текста, HTML-строки, ожидания, двойного клика и отклонения обработчика; описать props в README. Критерий: целевые Vitest, lint/typecheck и harness_check проходят, сеть не вызывается.

## 2. Подтверждение

- [ ] 2.1 (60–90 мин) Добавить управляемый ConfirmDialog на нативном dialog с Alfa-кнопками: title/description, фокус отмены, восстановление фокуса, Escape, запрет повтора/отмены при pending и Promise, безопасная ошибка. Вместе добавить компонентные тесты и README. Проверить в desktop-браузере 1280/1440: Tab/Shift+Tab внутри, Enter на отмене, Escape, ожидание, повтор после ошибки и возврат фокуса. Критерий: тесты, lint/typecheck и harness_check проходят; временный стенд удалён, бизнес-маршруты не изменены.

## 3. Интеграция

- [ ] 3.1 (30–60 мин) Прогнать scripts/check.sh, обновить docs/openapi.json и THIRD_PARTY_NOTICES.md. Критерий: harness_check exit 0, production build, `openspec validate frontend-feedback --strict` и git diff --check проходят. API/зависимости не меняются: подтвердить отсутствие diff lock/notices, не создавать отсутствующий экспорт API. Зафиксировать результат отдельными Conventional Commits без посторонних изменений.

## Workflow follow-up

- Подключить компоненты к реальным экранам после OpenAPI Dev 2; не закрывать задачи клиентского пути по наличию общих компонентов.
- Архивировать после реализации и проверки через openspec-archive-change.
