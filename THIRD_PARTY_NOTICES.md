# Сторонние компоненты

Состояние: 25.10.2026. Runtime-зависимости в backend/pyproject.toml пока отсутствуют.

## Backend: инструменты разработки

Версии из backend/uv.lock и установленного окружения; dev-only, в поставку не входят.
Воспроизведение: `uv sync --project backend --locked`, затем чтение `importlib.metadata` в backend/.venv.

| Пакет | Версия | Лицензия |
|---|---|---|
| ast_serialize | 0.13.1 | MIT |
| iniconfig | 2.3.1 | MIT |
| librt | 0.16.0 | MIT |
| mypy | 2.4.0 | MIT |
| mypy_extensions | 1.1.0 | MIT |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pathspec | 1.1.1 | MPL-2.0 (из dist-info/licenses/LICENSE) |
| pluggy | 1.7.0 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| pytest | 9.1.1 | MIT |
| ruff | 0.17.2 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |

## Frontend

Пока не создан; frontend/package-lock.json отсутствует.

## Локальные инструменты

OpenSpec 1.15.0 — MIT (https://github.com/Fission-AI/OpenSpec).
uv 0.13.5 — MIT / Apache-2.0 (https://github.com/astral-sh/uv).
Установлены для разработки, в приложение не включаются.

## Модели и моки

Веса моделей не установлены. Персоны backend/app/seed/personas.json — синтетические данные.
Интеграции ФНС, БКИ и выручки при реализации должны быть локальными моками: synthetic data, no real integration.
