"""Golden-файлы К5: тестовый сериализатор `ScoringResult` и diff по полям.

Полноценный `app/domain/serialization.py` появится в К6; до него golden
сравнивается по этому стабильному JSON-представлению: `Decimal` → строка
(масштаб сохраняется), enum → значение, tuple → список.

Разовая генерация (только с разрешения владельца):
`UPDATE_GOLDEN=1 uv run pytest tests/domain/test_engine_personas.py`.
"""

import json
import os
from collections.abc import Mapping
from dataclasses import fields, is_dataclass
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any, Final, cast

from app.domain.scoring.result import ScoringResult

#: Каталог golden-файлов: по одному на персону.
GOLDEN_DIR: Final[Path] = Path(__file__).resolve().parent / "golden"

#: Переменная окружения для разовой генерации golden.
UPDATE_ENV: Final = "UPDATE_GOLDEN"


def _jsonable(value: object) -> Any:
    """Детерминированное JSON-представление: Decimal → строка, Enum → значение."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if is_dataclass(value) and not isinstance(value, type):
        record = cast(Any, value)
        return {field.name: _jsonable(getattr(record, field.name)) for field in fields(record)}
    if isinstance(value, (tuple, list)):
        return [_jsonable(item) for item in value]
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    return value


def result_to_payload(result: ScoringResult) -> dict[str, Any]:
    """Полный `ScoringResult` в JSON-совместимый словарь."""
    return cast(dict[str, Any], _jsonable(result))


def golden_path(persona_id: str) -> Path:
    """Путь golden-файла персоны."""
    return GOLDEN_DIR / f"{persona_id}.json"


def load_golden(persona_id: str) -> dict[str, Any]:
    """Прочитать golden-файл персоны."""
    with golden_path(persona_id).open(encoding="utf-8") as fh:
        return cast(dict[str, Any], json.load(fh))


def write_golden(persona_id: str, result: ScoringResult) -> Path:
    """Записать golden-файл персоны (разовая генерация)."""
    path = golden_path(persona_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = result_to_payload(result)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def update_requested() -> bool:
    """Запрошена ли генерация golden через окружение."""
    return os.environ.get(UPDATE_ENV) == "1"


def diff_payload(expected: Any, actual: Any, path: str = "") -> list[str]:
    """Плоский diff по полям: «путь: golden=… actual=…»."""
    if isinstance(expected, dict) and isinstance(actual, dict):
        lines: list[str] = []
        for key in sorted(set(expected) | set(actual)):
            child = f"{path}.{key}" if path else str(key)
            if key not in expected:
                lines.append(f"{child}: нет в golden, actual={actual[key]!r}")
            elif key not in actual:
                lines.append(f"{child}: нет в actual, golden={expected[key]!r}")
            else:
                lines.extend(diff_payload(expected[key], actual[key], child))
        return lines
    if isinstance(expected, list) and isinstance(actual, list):
        lines = []
        if len(expected) != len(actual):
            lines.append(f"{path}: длина golden={len(expected)} actual={len(actual)}")
        for index, (left, right) in enumerate(zip(expected, actual, strict=False)):
            lines.extend(diff_payload(left, right, f"{path}[{index}]"))
        return lines
    if expected != actual:
        return [f"{path}: golden={expected!r} actual={actual!r}"]
    return []
