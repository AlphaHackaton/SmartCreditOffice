"""Объяснения решения: каталог текстов, `client_text`, порядок `top_reasons`.

Текст клиенту не раскрывает порогов политики (никаких «DSCR 1,18 < 1,30» и
чисел вообще): числа остаются в банковской трассе через `Factor.value`.
Шаблоны — `str.format` с именованными полями; в политике v1 тексты полей не
требуют, `render` принимает их для будущих редакций и подсказок К6.
"""

from collections.abc import Mapping, Sequence
from dataclasses import replace
from decimal import Decimal
from typing import Final, Protocol

from ..dates import add_months
from ..enums import ConstraintName, Impact, OfferKind, Outcome, ReasonCode
from .inputs import ScoringInputs
from .metrics import Metrics
from .policy import Policy
from .result import Factor, OfferDraft

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


class ResultCore(Protocol):
    """Протокол для сущностей, хранящих офферы и связывающее ограничение."""

    @property
    def offers(self) -> tuple[OfferDraft, ...]: ...

    @property
    def binding_constraint(self) -> ConstraintName | None: ...


def hints(
    m: Metrics,
    result_core: ResultCore,
    inp: ScoringInputs,
    p: Policy,
) -> Mapping[ReasonCode, str]:
    """Контрфактические подсказки клиенту (design.md §4, SPEC_FOR_AGENT).

    Подсказки контрфактически честные: проигрывание через `simulate` даёт
    обещанный исход.
    - P5: дата регистрации + 3 мес (ДД.ММ.ГГГГ) для `BUSINESS_TOO_YOUNG`.
    - P2: увеличение срока (например, "30 мес") при `DSCR_BELOW_MIN`.
    - P3: снижение суммы (максимально доступная) при `DSCR_BELOW_MIN`.
    """
    res: dict[ReasonCode, str] = {}

    if m.business_age_months < p.min_business_age_months:
        eligible_date = add_months(inp.company.registered_at, p.min_business_age_months)
        date_str = eligible_date.strftime("%d.%m.%Y")
        res[ReasonCode.BUSINESS_TOO_YOUNG] = (
            f"Подайте заявку после {date_str}, когда бизнесу исполнится "
            f"{p.min_business_age_months} мес."
        )

    if result_core.binding_constraint is ConstraintName.DSCR:
        longer = next((o for o in result_core.offers if o.kind is OfferKind.LONGER_TERM), None)
        if longer is not None:
            res[ReasonCode.DSCR_BELOW_MIN] = (
                f"Увеличьте срок кредита до {longer.term_months} мес, "
                "чтобы снизить ежемесячный платёж."
            )
        else:
            reduced = next(
                (
                    o
                    for o in result_core.offers
                    if o.kind in {OfferKind.REDUCED_AMOUNT, OfferKind.MAX}
                ),
                None,
            )
            if reduced is not None:
                amount_str = f"{reduced.amount:,.0f}".replace(",", " ")
                res[ReasonCode.DSCR_BELOW_MIN] = (
                    f"Снизьте сумму кредита до {amount_str} ₽ "
                    "(максимально доступная сумма на этом сроке)."
                )

    if result_core.binding_constraint is ConstraintName.REVENUE:
        reduced = next(
            (o for o in result_core.offers if o.kind in {OfferKind.REDUCED_AMOUNT, OfferKind.MAX}),
            None,
        )
        if reduced is not None:
            amount_str = f"{reduced.amount:,.0f}".replace(",", " ")
            res[ReasonCode.REVENUE_LIMIT] = (
                f"Снизьте сумму кредита до {amount_str} ₽ в соответствии с оборотами по счёту."
            )

    if m.ncf <= Decimal("0"):
        res[ReasonCode.NO_DEBT_CAPACITY] = (
            "Увеличьте свободный денежный поток (NCF) бизнеса для получения кредита."
        )

    return res


__all__ = [
    "BINDING_CODES",
    "CATALOG",
    "ResultCore",
    "TOP_LIMIT",
    "hints",
    "render",
    "top_reasons",
]
