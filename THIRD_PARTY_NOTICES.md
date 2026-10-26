# THIRD_PARTY_NOTICES

Проект: «Умный кредитный кабинет предпринимателя» (хакатон Альфа-Будущее 2026).  
Дата формирования: 2026-10-26.

Как воспроизвести:
- Backend: `cd backend && uv export --format requirements-txt --no-hashes`
- Лицензии Python: `uv run python -c "import importlib.metadata as m; [print(p.name, p.version, (m.metadata(p.name).get('License') or m.metadata(p.name).get('License-Expression') or 'UNKNOWN')) for p in m.distributions()]"`

---

## 1. Backend (Python)

Зависимости зафиксированы в `backend/uv.lock` и `backend/pyproject.toml`.

### Прямые зависимости (runtime, входят в docker-образ)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `alembic` | 1.20.1 | MIT | https://alembic.sqlalchemy.org/ |
| `bcrypt` | 5.0.0 | Apache-2.0 | https://github.com/pyca/bcrypt/ |
| `fastapi` | 0.162.0 | MIT | https://fastapi.tiangolo.com/ |
| `psycopg` | 3.3.6 | LGPL-3.0-only | https://www.psycopg.org/ |
| `psycopg-binary` | 3.3.6 | LGPL-3.0-only | https://www.psycopg.org/ |
| `pydantic` | 2.14.1 | MIT | https://docs.pydantic.dev/ |
| `pydantic-core` | 2.50.1 | MIT | https://github.com/pydantic/pydantic-core |
| `pyjwt` | 2.15.1 | MIT | https://github.com/jpadilla/pyjwt |
| `sqlalchemy` | 2.1.6 | MIT | https://www.sqlalchemy.org/ |
| `uvicorn` | 0.54.0 | BSD-3-Clause | https://www.uvicorn.org/ |

### Транзитивные зависимости (runtime, входят в docker-образ)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `annotated-doc` | 0.0.5 | MIT | https://github.com/wyfo/annotated_doc |
| `annotated-types` | 0.8.0 | MIT | https://github.com/annotated-types/annotated-types |
| `anyio` | 4.15.1 | MIT | https://anyio.readthedocs.io/ |
| `click` | 8.5.0 | BSD-3-Clause | https://click.palletsprojects.com/ |
| `h11` | 0.16.0 | MIT | https://github.com/python-hyper/h11 |
| `httptools` | 0.9.0 | MIT | https://github.com/MagicStack/httptools |
| `idna` | 3.20 | BSD-3-Clause | https://github.com/kjd/idna |
| `mako` | 1.4.3 | MIT | https://www.makotemplates.org/ |
| `markupsafe` | 3.0.4 | BSD-3-Clause | https://palletsprojects.com/p/markupsafe/ |
| `opentelemetry-api` | 1.45.1 | Apache-2.0 | https://opentelemetry.io/ |
| `python-dotenv` | 1.2.4 | BSD-3-Clause | https://github.com/theskumar/python-dotenv |
| `pyyaml` | 6.0.3 | MIT | https://pyyaml.org/ |
| `sniffio` | 1.3.1 | MIT | https://github.com/python-trio/sniffio |
| `starlette` | 1.10.0 | BSD-3-Clause | https://www.starlette.io/ |
| `typing-extensions` | 4.16.0 | PSF-2.0 | https://github.com/python/typing_extensions |
| `typing-inspection` | 0.4.4 | MIT | https://github.com/pydantic/typing-inspection |
| `uvloop` | 0.23.0 | MIT | https://github.com/MagicStack/uvloop |
| `watchfiles` | 1.3.0 | MIT | https://github.com/samuelcolvin/watchfiles |
| `websockets` | 17.3 | BSD-3-Clause | https://websockets.readthedocs.io/ |

### Зависимости разработки (dev-only, в docker-образ не входят)

| Пакет | Версия | Лицензия | Ссылка / Репозиторий |
|---|---|---|---|
| `hypothesis` | 6.170.9 | MPL-2.0 | https://hypothesis.readthedocs.io/ |
| `httpx` | 0.28 | BSD-3-Clause | https://www.python-httpx.org/ |
| `mypy` | 2.4.0 | MIT | https://www.mypy-lang.org/ |
| `pytest` | 9.1.1 | MIT | https://docs.pytest.org/ |
| `ruff` | 0.17.2 | MIT | https://docs.astral.sh/ruff |

### Транзитивные зависимости разработки (dev-only)

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

---

## 2. Frontend (npm)

В текущей версии (КТ C / этап ядра скоринга) frontend ещё не инициализирован. Зависимости будут зафиксированы в `frontend/package-lock.json` при подключении UI.

---

## 3. Модели и моки

- **Open-weights модели:** В текущей версии внешние ML/LLM-модели не задействованы; скоринг, правила андеррайтинга и объяснения решений полностью детерминированы (правила скоринговой карты M1–M5, FSM, кредитная политика).
- **Локальные моки:** Синтетические персоны P1–P6 (`backend/app/seed/personas.json`) и будущие моки внешних сервисов (ФНС, БКИ, выписки) в `backend/app/mocks/` — synthetic data, no real integration.
