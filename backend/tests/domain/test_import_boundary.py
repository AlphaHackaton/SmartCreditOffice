"""Граница импортов домена: только stdlib и app.domain.* (AST всех файлов)."""

import ast
import sys
from pathlib import Path

import pytest

DOMAIN_ROOT = Path(__file__).resolve().parents[2] / "app" / "domain"

#: Прямой запрет из tasks.md К0 — вне зависимости от allow-списка.
FORBIDDEN_ROOTS = frozenset({"fastapi", "pydantic", "sqlalchemy"})
FORBIDDEN_PREFIXES = ("app.api", "app.db", "app.mocks", "app.services", "app.seed")


def _check_module(module: str, path: Path) -> None:
    root = module.split(".", 1)[0]
    assert root not in FORBIDDEN_ROOTS, f"{path.name}: запрещённый импорт {module}"
    assert not module.startswith(FORBIDDEN_PREFIXES), f"{path.name}: запрещённый импорт {module}"
    allowed = (
        root in sys.stdlib_module_names
        or module == "app.domain"
        or module.startswith("app.domain.")
    )
    assert allowed, f"{path.name}: импорт {module} вне разрешённых (stdlib, app.domain)"


def _check_import_from(node: ast.ImportFrom, path: Path) -> None:
    if node.level > 0:
        backend_root = DOMAIN_ROOT.parents[1]
        rel = path.relative_to(backend_root)
        pkg_parts = list(rel.parent.parts)
        if node.level > len(pkg_parts):
            raise AssertionError(
                f"{path.name}: относительный импорт выходит за пределы app (level={node.level})"
            )
        base_parts = pkg_parts[: len(pkg_parts) - (node.level - 1)]
        if node.module:
            resolved = ".".join(base_parts + [node.module]) if base_parts else node.module
            if resolved == "app":
                for alias in node.names:
                    _check_module(f"app.{alias.name}", path)
            else:
                _check_module(resolved, path)
        else:
            for alias in node.names:
                resolved = ".".join(base_parts + [alias.name]) if base_parts else alias.name
                _check_module(resolved, path)
    else:
        assert node.module is not None
        if node.module == "app":
            for alias in node.names:
                _check_module(f"app.{alias.name}", path)
        else:
            _check_module(node.module, path)


def test_domain_imports_only_stdlib_and_domain() -> None:
    files = sorted(DOMAIN_ROOT.rglob("*.py"))
    assert files, "пакет app/domain пуст"
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    _check_module(alias.name, path)
            elif isinstance(node, ast.ImportFrom):
                _check_import_from(node, path)


def test_import_boundary_catches_relative_escape() -> None:
    scoring_file = DOMAIN_ROOT / "scoring" / "engine.py"

    # 1. Попытка уйти на уровень app.seed через относительный импорт
    node_seed = ast.parse("from ...seed import personas").body[0]
    assert isinstance(node_seed, ast.ImportFrom)
    with pytest.raises(AssertionError, match="запрещённый импорт app.seed"):
        _check_import_from(node_seed, scoring_file)

    # 2. Попытка импортировать app.mocks через относительный импорт
    node_mocks = ast.parse("from ...mocks import fns").body[0]
    assert isinstance(node_mocks, ast.ImportFrom)
    with pytest.raises(AssertionError, match="запрещённый импорт app.mocks"):
        _check_import_from(node_mocks, scoring_file)

    # 3. Попытка выйти за пределы app
    node_outside = ast.parse("from .....something import foo").body[0]
    assert isinstance(node_outside, ast.ImportFrom)
    with pytest.raises(AssertionError, match="относительный импорт выходит за пределы app"):
        _check_import_from(node_outside, scoring_file)

    # 4. Попытка импорта seed без указания модуля в from (... import seed)
    node_from_dots = ast.parse("from ... import seed").body[0]
    assert isinstance(node_from_dots, ast.ImportFrom)
    with pytest.raises(AssertionError, match="запрещённый импорт app.seed"):
        _check_import_from(node_from_dots, scoring_file)

    # 5. Попытка абсолютного импорта из app (from app import seed / mocks)
    node_abs_seed = ast.parse("from app import seed").body[0]
    assert isinstance(node_abs_seed, ast.ImportFrom)
    with pytest.raises(AssertionError, match="запрещённый импорт app.seed"):
        _check_import_from(node_abs_seed, scoring_file)

    node_abs_mocks = ast.parse("from app import mocks").body[0]
    assert isinstance(node_abs_mocks, ast.ImportFrom)
    with pytest.raises(AssertionError, match="запрещённый импорт app.mocks"):
        _check_import_from(node_abs_mocks, scoring_file)

    # 6. Запрет прямого `import app`
    node_import_app = ast.parse("import app").body[0]
    assert isinstance(node_import_app, ast.Import)
    with pytest.raises(AssertionError, match="импорт app вне разрешённых"):
        _check_module(node_import_app.names[0].name, scoring_file)

    # 7. Разрешённые импорты из домена
    node_domain = ast.parse("from app.domain import money").body[0]
    assert isinstance(node_domain, ast.ImportFrom)
    _check_import_from(node_domain, scoring_file)

    node_domain_from_app = ast.parse("from app import domain").body[0]
    assert isinstance(node_domain_from_app, ast.ImportFrom)
    _check_import_from(node_domain_from_app, scoring_file)
