"""Объяснения решения: каталог текстов, `client_text`, порядок `top_reasons`.

Текст клиенту не раскрывает порогов политики (никаких «DSCR 1,18 < 1,30» и
чисел вообще): числа остаются в банковской трассе через `Factor.value`.
Шаблоны — `str.format` с именованными полями; в политике v1 тексты полей не
требуют, `render` принимает их для будущих редакций и подсказок К6.
"""

from collections.abc import Mapping, Sequence
from dataclasses import replace
from typing import Final

from ..enums import ConstraintName, Impact, Outcome, ReasonCode
from .result import Factor

#: Тексты причин для клиента: полный каталог всех `ReasonCode`.
CATALOG: Final[Mapping[ReasonCode, str]] = {
    # M1–M5: скоринговая карта
    ReasonCode.TURNOVER_STABLE: "Поступления по счёту стабильные.",
    ReasonCode.TURNOVER_MODERATE: "Поступления по счёту умеренно колеблются.",
    ReasonCode.TURNOVER_VOLATILE: "Поступления по счёту нестабильны.",
    ReasonCode.DEBT_BURDEN_NONE: "Действующей долговой нагрузки нет.",
    ReasonCode.DEBT_BURDEN_MODERATE: "Текущая долговая нагрузка умеренная.",
    ReasonCode.DEBT_BURDEN_HIGH: "Текущая долговая нагрузка высокая.",
    ReasonCode.DEBT_BURDEN_CRITICAL: "Текущая долговая нагрузка критическая.",
    ReasonCode.BKI_CLEAN: "Кредитная история без просрочек.",
    ReasonCode.BKI_PAST_OVERDUE_MINOR: "В кредитной истории была короткая просрочка.",
    ReasonCode.BKI_PAST_OVERDUE_MAJOR: "В кредитной истории была длительная просрочка.",
    ReasonCode.BKI_MANY_INQUIRIES: "За последний месяц было много запросов в бюро.",
    ReasonCode.FNS_MATCH: "Обороты по счёту соответствуют отчётности.",
    ReasonCode.FNS_MISMATCH_MODERATE: "Отчётность расходится с оборотами по счёту.",
    ReasonCode.FNS_MISMATCH: "Отчётность существенно расходится с оборотами по счёту.",
    ReasonCode.FNS_NO_DECLARATION: "Нет налоговой декларации за последний год.",
    ReasonCode.BUSINESS_MATURE: "Бизнес работает давно.",
    ReasonCode.BUSINESS_ESTABLISHED: "Бизнес работает достаточно долго.",
    ReasonCode.BUSINESS_YOUNG: "Бизнес работает недавно.",
    ReasonCode.BUSINESS_VERY_YOUNG: "Бизнес работает совсем недавно.",
    # Стоп-факторы и данные
    ReasonCode.BKI_CURRENT_OVERDUE: "Есть текущая просрочка по действующим обязательствам.",
    ReasonCode.BKI_OVERDUE_90_12M: "За последний год была просрочка дольше трёх месяцев.",
    ReasonCode.BUSINESS_TOO_YOUNG: "Бизнес зарегистрирован слишком недавно.",
    ReasonCode.FNS_INACTIVE: "По данным ФНС бизнес не ведёт деятельность.",
    ReasonCode.FNS_ACCOUNTS_BLOCKED: "Счета бизнеса приостановлены.",
    ReasonCode.INSUFFICIENT_DATA: "Недостаточно данных для автоматического решения.",
    # Решение
    ReasonCode.DSCR_BELOW_MIN: "Нагрузка по кредиту выше допустимой.",
    ReasonCode.REVENUE_LIMIT: "Сумма ограничена оборотами по счёту.",
    ReasonCode.GRADE_CAP_LIMIT: "Сумма ограничена кредитным грейдом.",
    ReasonCode.PRODUCT_MAX_LIMIT: "Запрошена максимальная сумма по продукту.",
    ReasonCode.AMOUNT_BELOW_MIN: "Доступная сумма меньше минимальной суммы продукта.",
    ReasonCode.NO_DEBT_CAPACITY: "Свободного денежного потока не хватает для нового кредита.",
    ReasonCode.SCORE_TOO_LOW: "Итоговый балл ниже порога одобрения.",
}

#: Код причины по связывающему ограничению (в порядке `ConstraintName`).
BINDING_CODES: Final[Mapping[ConstraintName, ReasonCode]] = {
    ConstraintName.DSCR: ReasonCode.DSCR_BELOW_MIN,
    ConstraintName.REVENUE: ReasonCode.REVENUE_LIMIT,
    ConstraintName.GRADE_CAP: ReasonCode.GRADE_CAP_LIMIT,
    ConstraintName.PRODUCT_MAX: ReasonCode.PRODUCT_MAX_LIMIT,
}

#: Максимум причин в `top_reasons` (design.md §2).
TOP_LIMIT: Final = 3


def render(f: Factor, **ctx: str) -> Factor:
    """Копия фактора с заполненным `client_text`; прочие поля не меняются."""
    return replace(f, client_text=CATALOG[f.code].format(**ctx))


def top_reasons(
    factors: Sequence[Factor],
    binding: ConstraintName | None,
    outcome: Outcome,
) -> tuple[ReasonCode, ...]:
    """Главные причины решения: стоп-факторы, binding, затем негативные.

    Порядок design.md §2: стоп-факторы, код связывающего ограничения (только
    для контроффера), негативные факторы по потерянным баллам (`max − points`)
    по убыванию, при равенстве — по коду в алфавитном порядке. Максимум 3.
    """
    codes: list[ReasonCode] = [f.code for f in factors if f.impact is Impact.KNOCKOUT]
    if outcome is Outcome.COUNTER_OFFER and binding is not None:
        codes.append(BINDING_CODES[binding])
    negatives = sorted(
        (f for f in factors if f.impact is Impact.NEGATIVE),
        key=lambda f: (f.points - f.max_points, f.code.value),
    )
    codes.extend(f.code for f in negatives)

    unique: list[ReasonCode] = []
    for code in codes:
        if code not in unique:
            unique.append(code)
    return tuple(unique[:TOP_LIMIT])


__all__ = ["BINDING_CODES", "CATALOG", "TOP_LIMIT", "render", "top_reasons"]
