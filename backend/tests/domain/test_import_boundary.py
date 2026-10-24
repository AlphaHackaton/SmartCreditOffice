"""Граница импортов домена: только stdlib и app.domain.* (AST всех файлов)."""

import ast
import sys
from pathlib import Path

DOMAIN_ROOT = Path(__file__).resolve().parents[2] / "app" / "domain"

#: Прямой запрет из tasks.md К0 — вне зависимости от allow-списка.
FORBIDDEN_ROOTS = frozenset({"fastapi", "pydantic", "sqlalchemy"})
FORBIDDEN_PREFIXES = ("app.api", "app.db", "app.mocks", "app.services", "app.seed")


def _check_module(module: str, path: Path) -> None:
    root = module.split(".", 1)[0]
    assert root not in FORBIDDEN_ROOTS, f"{path.name}: запрещённый импорт {module}"
    assert not module.startswith(FORBIDDEN_PREFIXES), f"{path.name}: запрещённый импорт {module}"
    allowed = root in sys.stdlib_module_names or module == "app" or module.startswith("app.domain.")
    assert allowed, f"{path.name}: импорт {module} вне разрешённых (stdlib, app.domain)"


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
                if node.level > 0:
                    continue  # относительный импорт внутри app.domain
                assert node.module is not None
                _check_module(node.module, path)
