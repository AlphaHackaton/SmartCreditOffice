---
name: deliverables-audit
description: Use when preparing the repository for submission or before archiving a major change. Audits the repo against SPEC_FOR_AGENT.md §6 and QUICK_GUIDE.md §6 delivery checklist and returns a ✅/❌ table with fixes.
---

# Аудит сдачи (перед дедлайном и перед архивацией крупных изменений)

Сверься с обоими чек-листами: SPEC §6 (полный) и QUICK_GUIDE §6 (сокращённый). Проверь каждый пункт фактически (файлы существуют, команды выполняются), не «на глаз»:

1. **docker-compose.yml** — `docker compose config -q` валиден; сервисы db/backend/frontend; запуск одной командой `docker compose up --build`.
2. **README.md** — есть: схема архитектуры, порты, `.env` (со ссылкой на `.env.example`), инструкция запуска, тестовые учётки, E2E-сценарий (путь клиента от потребности до «Кредит выдан»).
3. **THIRD_PARTY_NOTICES.md** — непустой, соответствует lock-файлам (запусти скилл third-party-notices для пересборки).
4. **Lock-файлы** — `backend/uv.lock`, `frontend/package-lock.json` существуют и актуальны (`git status` чист после установки зависимостей).
5. **Спецификация API** — `docs/openapi.json` существует и свежий (регенерируется `scripts/check.sh`).
6. **Синтетические данные** — seed-скрипт создаёт тестовых клиентов (ИП и ООО) и заявки во всех статусах.
7. **Секреты** — `git grep -iE "api[_-]?key|password" -- ':!*.example'` не находит реальных секретов; `.env` в `.gitignore`.
8. **Запрещённые API** — `grep -rInE "api\.openai\.com|anthropic\.com|gigachat|ocr\.api\.cloud\.yandex" backend frontend` пуст (это же делает scripts/check.sh).
9. **Размер репо** — `git count-objects -vH` и суммарный размер без node_modules: укладываемся (плюс помнить лимит 18 МБ на файл сдачи; PDF из src/ не толкать в git, если > 10 МБ).
10. **LLM-совместимость** — если LLM используется: `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` настраиваются без правки кода; без LLM сквозной сценарий проходит (fallback).

Результат выведи таблицей: | Пункт | Статус ✅/❌ | Что чинить |. Для ❌ — конкретное действие, а не «улучшить».
