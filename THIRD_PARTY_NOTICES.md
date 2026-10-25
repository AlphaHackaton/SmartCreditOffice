# THIRD_PARTY_NOTICES

Проект: «Умный кредитный кабинет предпринимателя» (хакатон Альфа-Будущее 2026).  
Дата формирования: 2026-10-25.

Как воспроизвести:
- Backend: `cd backend && uv export --format requirements-txt --no-hashes`
- Лицензии Python: `uv run python -c "import importlib.metadata as m; [print(p.name, p.version, (m.metadata(p.name).get('License') or m.metadata(p.name).get('License-Expression') or 'UNKNOWN')) for p in m.distributions()]"`

---

## 1. Backend (Python)

Зависимости зафиксированы в `backend/uv.lock` и `backend/pyproject.toml`.  
Все текущие пакеты являются инструментами разработки/тестирования (dev-only, в runtime поставку docker-образа не входят).

### Прямые зависимости (dev-only)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `hypothesis` | 6.170.9 | MPL-2.0 | https://hypothesis.readthedocs.io/ |
| `mypy` | 2.4.0 | MIT | https://www.mypy-lang.org/ |
| `pytest` | 9.1.1 | MIT | https://docs.pytest.org/ |
| `ruff` | 0.17.2 | MIT | https://docs.astral.sh/ruff |

### Транзитивные зависимости (dev-only)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `ast-serialize` | 0.13.1 | MIT | https://github.com/mypyc/ast_serialize |
| `colorama` | 0.4.6 | BSD-3-Clause | https://github.com/tartley/colorama |
| `iniconfig` | 2.3.1 | MIT | https://github.com/pytest-dev/iniconfig |
| `librt` | 0.16.0 | MIT | https://github.com/mypyc/librt |
| `mypy-extensions` | 1.1.0 | MIT | https://github.com/python/mypy_extensions |
| `packaging` | 26.3 | Apache-2.0 OR BSD-2-Clause | https://packaging.pypa.io/ |
| `pathspec` | 1.1.1 | MPL-2.0 | https://github.com/cpburnz/python-pathspec |
| `pluggy` | 1.7.0 | MIT | https://github.com/pytest-dev/pluggy |
| `pygments` | 2.21.0 | BSD-2-Clause | https://pygments.org/ |
| `sortedcontainers` | 2.4.0 | Apache-2.0 | http://www.grantjenks.com/docs/sortedcontainers/ |
| `typing-extensions` | 4.16.0 | PSF-2.0 | https://github.com/python/typing_extensions |

---

## 2. Frontend (npm)

В текущей версии (КТ C / этап ядра скоринга) frontend ещё не инициализирован. Зависимости будут зафиксированы в `frontend/package-lock.json` при подключении UI.

---

## 3. Модели и моки

- **Open-weights модели:** В текущей версии внешние ML/LLM-модели не задействованы; скоринг, правила андеррайтинга и объяснения решений полностью детерминированы (правила скоринговой карты M1–M5, FSM, кредитная политика).
- **Локальные моки:** Синтетические персоны P1–P6 (`backend/app/seed/personas.json`) и будущие моки внешних сервисов (ФНС, БКИ, выписки) в `backend/app/mocks/` — synthetic data, no real integration.
