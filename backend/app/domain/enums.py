"""Enums домена.

Все StrEnum с ЯВНЫМИ значениями: `auto()` в StrEnum даёт lowercase, а контракту
нужно `value == name` (значения уходят в OpenAPI/TS и не переименовываются).
"""

from enum import StrEnum


class ApplicationStatus(StrEnum):
    """Статусы заявки (FSM, 12 статусов, 20 рёбер)."""

    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    SCORING = "SCORING"
    UNDERWRITING = "UNDERWRITING"
    APPROVED = "APPROVED"
    COUNTER_OFFER = "COUNTER_OFFER"
    REJECTED = "REJECTED"
    SIGNING = "SIGNING"
    SIGNED = "SIGNED"
    DISBURSED = "DISBURSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class Actor(StrEnum):
    """Инициатор перехода статуса."""

    CLIENT = "CLIENT"
    BANK = "BANK"
    SYSTEM = "SYSTEM"


class Outcome(StrEnum):
    """Рекомендация по заявке."""

    APPROVED = "APPROVED"
    COUNTER_OFFER = "COUNTER_OFFER"
    REJECTED = "REJECTED"


class Route(StrEnum):
    """Маршрут решения: авто или ручная проверка."""

    AUTO = "AUTO"
    UNDERWRITING = "UNDERWRITING"


class Grade(StrEnum):
    """Кредитный грейд по итогу скоринга."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"


class OfferKind(StrEnum):
    """Вид оффера в контроффере."""

    REQUESTED = "REQUESTED"
    LONGER_TERM = "LONGER_TERM"
    REDUCED_AMOUNT = "REDUCED_AMOUNT"
    MAX = "MAX"


class LegalForm(StrEnum):
    """Организационная форма заёмщика."""

    IP = "IP"
    OOO = "OOO"


class BkiSubject(StrEnum):
    """Субъект отчёта БКИ."""

    COMPANY = "COMPANY"
    PERSON = "PERSON"


class FnsStatus(StrEnum):
    """Статус контрагента в ФНС."""

    ACTIVE = "ACTIVE"
    LIQUIDATING = "LIQUIDATING"
    LIQUIDATED = "LIQUIDATED"


class Source(StrEnum):
    """Источник данных фактора."""

    FNS = "FNS"
    BKI = "BKI"
    ACCOUNT = "ACCOUNT"
    APPLICATION = "APPLICATION"
    POLICY = "POLICY"


class Impact(StrEnum):
    """Влияние фактора на решение."""

    POSITIVE = "POSITIVE"
    NEGATIVE = "NEGATIVE"
    NEUTRAL = "NEUTRAL"
    KNOCKOUT = "KNOCKOUT"


class ConstraintName(StrEnum):
    """Ограничение лимита суммы. Порядок = tie-break при равенстве ограничений."""

    DSCR = "DSCR"
    REVENUE = "REVENUE"
    GRADE_CAP = "GRADE_CAP"
    PRODUCT_MAX = "PRODUCT_MAX"


class ReviewFlag(StrEnum):
    """Флаг ручной проверки (переводит маршрут в UNDERWRITING)."""

    GRADE_C = "GRADE_C"
    FNS_MISMATCH = "FNS_MISMATCH"
    AMOUNT_ABOVE_AUTO_LIMIT = "AMOUNT_ABOVE_AUTO_LIMIT"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"


class ReasonCode(StrEnum):
    """Код причины/фактора скоринга."""

    # M1–M5: скоринговая карта
    TURNOVER_STABLE = "TURNOVER_STABLE"
    TURNOVER_MODERATE = "TURNOVER_MODERATE"
    TURNOVER_VOLATILE = "TURNOVER_VOLATILE"
    DEBT_BURDEN_NONE = "DEBT_BURDEN_NONE"
    DEBT_BURDEN_MODERATE = "DEBT_BURDEN_MODERATE"
    DEBT_BURDEN_HIGH = "DEBT_BURDEN_HIGH"
    DEBT_BURDEN_CRITICAL = "DEBT_BURDEN_CRITICAL"
    BKI_CLEAN = "BKI_CLEAN"
    BKI_PAST_OVERDUE_MINOR = "BKI_PAST_OVERDUE_MINOR"
    BKI_PAST_OVERDUE_MAJOR = "BKI_PAST_OVERDUE_MAJOR"
    BKI_MANY_INQUIRIES = "BKI_MANY_INQUIRIES"
    FNS_MATCH = "FNS_MATCH"
    FNS_MISMATCH_MODERATE = "FNS_MISMATCH_MODERATE"
    FNS_MISMATCH = "FNS_MISMATCH"
    FNS_NO_DECLARATION = "FNS_NO_DECLARATION"
    BUSINESS_MATURE = "BUSINESS_MATURE"
    BUSINESS_ESTABLISHED = "BUSINESS_ESTABLISHED"
    BUSINESS_YOUNG = "BUSINESS_YOUNG"
    BUSINESS_VERY_YOUNG = "BUSINESS_VERY_YOUNG"
    # Стоп-факторы и данные
    BKI_CURRENT_OVERDUE = "BKI_CURRENT_OVERDUE"
    BKI_OVERDUE_90_12M = "BKI_OVERDUE_90_12M"
    BUSINESS_TOO_YOUNG = "BUSINESS_TOO_YOUNG"
    FNS_INACTIVE = "FNS_INACTIVE"
    FNS_ACCOUNTS_BLOCKED = "FNS_ACCOUNTS_BLOCKED"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    # Решение
    DSCR_BELOW_MIN = "DSCR_BELOW_MIN"
    REVENUE_LIMIT = "REVENUE_LIMIT"
    GRADE_CAP_LIMIT = "GRADE_CAP_LIMIT"
    PRODUCT_MAX_LIMIT = "PRODUCT_MAX_LIMIT"
    AMOUNT_BELOW_MIN = "AMOUNT_BELOW_MIN"
    NO_DEBT_CAPACITY = "NO_DEBT_CAPACITY"
    SCORE_TOO_LOW = "SCORE_TOO_LOW"
