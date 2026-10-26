"""Export public and bank demo fixtures from the real domain; never an HTTP/OpenAPI schema."""

import json
import sys
from dataclasses import asdict, replace
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.domain.application_status import IN_PROGRESS, initial_event, replay, transition
from app.domain.enums import Actor, ApplicationStatus
from app.domain.scoring.engine import evaluate, simulate
from app.domain.scoring.inputs import LoanRequest
from app.domain.scoring.policy import POLICY_V1
from app.domain.scoring.explain import hints
from app.domain.scoring.metrics import compute_metrics
from app.domain.serialization import canonical, inputs_to_json, result_to_json
from app.seed.personas import load_inputs, load_raw, load_request


def hash_data(data):
    s = json.dumps(canonical(data), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(s.encode("utf-8")).hexdigest()


def journey(outcome):
    start = datetime(2026, 10, 25, tzinfo=timezone.utc)
    events = [initial_event(Actor.CLIENT, start)]
    for index, status in enumerate(
        (ApplicationStatus.SUBMITTED, ApplicationStatus.SCORING, outcome), 1
    ):
        actor = Actor.CLIENT if index == 1 else Actor.SYSTEM
        events.append(
            transition(events[-1].to_status, status, actor, at=start + timedelta(seconds=index))
        )
    replay(events)
    return [{"from": e.from_status, "to": e.to_status, "actor": e.actor} for e in events]


def client_constraints(constraints):
    # Presentation precision only; the domain keeps the original exact limits.
    return [
        {
            "name": c.name.value if hasattr(c.name, "value") else str(c.name),
            "limit": str(c.limit.quantize(Decimal("0.01"))),
            "binding": c.binding,
        }
        for c in constraints
    ]


def simulations(persona_id, result):
    req = load_request(persona_id)
    product = POLICY_V1.product(req.product_code)
    amounts = sorted(
        {
            product.min_amount,
            req.amount,
            max(
                product.min_amount,
                (req.amount / 2 // POLICY_V1.amount_step) * POLICY_V1.amount_step,
            ),
            *(o.amount for o in result.offers),
        }
    )
    terms = list(range(product.min_term, product.max_term + 1, POLICY_V1.term_step))
    rows = []
    for amount in amounts:
        for term in terms:
            value = simulate(
                load_inputs(persona_id),
                replace(req, amount=Decimal(amount), term_months=term),
                POLICY_V1,
            )
            rows.append(
                {
                    "amount": str(amount),
                    "termMonths": term,
                    "outcome": value.predicted_outcome,
                    "requiresReview": value.requires_review,
                    "offers": canonical(value.offers),
                    "constraints": client_constraints(value.constraints),
                    "maxAmount": str(value.max_amount_for_term),
                    "headroom": str(value.headroom),
                }
            )
    return {"amounts": [str(a) for a in amounts], "terms": terms, "rows": rows}


def metrics_to_json(m):
    return {
        "history_months": m.history_months,
        "mean_inflow": str(m.mean_inflow),
        "inflows_12m": str(m.inflows_12m),
        "cv": str(m.cv) if m.cv is not None else None,
        "ncf": str(m.ncf),
        "existing_payments": str(m.existing_payments),
        "debt_burden": str(m.debt_burden) if m.debt_burden is not None else None,
        "worst_overdue_24m": m.worst_overdue_24m,
        "worst_overdue_12m": m.worst_overdue_12m,
        "current_overdue": m.current_overdue,
        "inquiries_30d": m.inquiries_30d,
        "fns_mismatch": str(m.fns_mismatch) if m.fns_mismatch is not None else None,
        "business_age_months": m.business_age_months,
    }


def get_bin_info(rule_id, factor, policy, metrics):
    bins_map = {
        "M1": (policy.bins_turnover_cv, metrics.cv),
        "M2": (policy.bins_debt_burden, metrics.debt_burden),
        "M3": (policy.bins_overdue_24m, Decimal(metrics.worst_overdue_24m)),
        "M4": (policy.bins_fns_mismatch, metrics.fns_mismatch),
        "M5": (policy.bins_business_age, Decimal(metrics.business_age_months)),
    }
    if rule_id not in bins_map:
        return None
    bins, val = bins_map[rule_id]
    if val is None:
        return None
    prev_upper = None
    for b in bins:
        upper = b.upper
        if b.code.value == factor.code.value:
            return {
                "lower": str(prev_upper) if prev_upper is not None else None,
                "upper": str(upper) if upper is not None else None,
                "inclusive_upper": False,
                "points": b.points,
                "code": b.code.value,
                "rule": rule_id,
            }
        prev_upper = upper
    return None


def bank_factors(factors, policy, metrics):
    res = []
    for f in factors:
        res.append(
            {
                "code": f.code.value,
                "source": f.source.value,
                "value": f.value,
                "points": f.points,
                "maxPoints": f.max_points,
                "impact": f.impact.value,
                "ruleId": f.rule_id,
                "clientText": f.client_text,
                "hint": f.hint,
                "bin": get_bin_info(f.rule_id, f, policy, metrics),
            }
        )
    return res


def scoring_run_dict(run_id, inp, req, result, evaluated_at, policy=POLICY_V1):
    m = compute_metrics(inp)
    ihash = hash_data(inputs_to_json(inp))
    rhash = hash_data(result_to_json(result))
    return {
        "id": run_id,
        "inputHash": ihash,
        "resultHash": rhash,
        "evaluatedAt": evaluated_at,
        "policyVersion": policy.version,
        "metrics": metrics_to_json(m),
        "factors": bank_factors(result.factors, policy, m),
        "constraints": client_constraints(result.constraints),
        "result": {
            "recommendation": result.recommendation.value,
            "route": result.route.value,
            "score": result.score,
            "grade": result.grade.value if result.grade is not None else None,
            "bindingConstraint": result.binding_constraint.value
            if result.binding_constraint is not None
            else None,
            "topReasons": [tr.value for tr in result.top_reasons],
            "reviewFlags": [rf.value for rf in result.review_flags],
        },
        "offers": result_to_json(result)["offers"],
    }


def policy_to_json(p):
    return {
        "name": p.name,
        "version": p.version,
        "key_rate_pct": str(p.key_rate_pct),
        "dscr_min": str(p.dscr_min),
        "revenue_multiplier": str(p.revenue_multiplier),
        "auto_limit": str(p.auto_limit),
        "amount_step": str(p.amount_step),
        "term_step": p.term_step,
        "min_history_months": p.min_history_months,
        "min_business_age_months": p.min_business_age_months,
        "inquiries_threshold": p.inquiries_threshold,
        "inquiries_penalty": p.inquiries_penalty,
        "grade_thresholds": [[g.value, t] for g, t in p.grade_thresholds],
        "grade_caps": [[g.value, str(cap)] for g, cap in p.grade_caps.items()],
        "risk_premium": [[g.value, str(prem)] for g, prem in p.risk_premium.items()],
        "term_premium": [[t, str(prem)] for t, prem in p.term_premium],
        "rate_floor_add": str(p.rate_floor_add),
        "rate_cap_add": str(p.rate_cap_add),
        "products": [
            {
                **asdict(prod),
                "min_amount": str(prod.min_amount),
                "max_amount": str(prod.max_amount),
                "spread_pct": str(prod.spread_pct),
            }
            for prod in p.products
        ],
        "bins_turnover_cv": [
            {
                "upper": str(b.upper) if b.upper is not None else None,
                "points": b.points,
                "code": b.code.value,
            }
            for b in p.bins_turnover_cv
        ],
        "bins_debt_burden": [
            {
                "upper": str(b.upper) if b.upper is not None else None,
                "points": b.points,
                "code": b.code.value,
            }
            for b in p.bins_debt_burden
        ],
        "bins_overdue_24m": [
            {
                "upper": str(b.upper) if b.upper is not None else None,
                "points": b.points,
                "code": b.code.value,
            }
            for b in p.bins_overdue_24m
        ],
        "bins_fns_mismatch": [
            {
                "upper": str(b.upper) if b.upper is not None else None,
                "points": b.points,
                "code": b.code.value,
            }
            for b in p.bins_fns_mismatch
        ],
        "bins_business_age": [
            {
                "upper": str(b.upper) if b.upper is not None else None,
                "points": b.points,
                "code": b.code.value,
            }
            for b in p.bins_business_age
        ],
    }


personas = []
bank_dossiers = {}
scoring_runs = {}

for raw in load_raw()["personas"]:
    inp = load_inputs(raw["id"])
    req = load_request(raw["id"])
    result = evaluate(inp, req, POLICY_V1)
    final = (
        ApplicationStatus.UNDERWRITING
        if result.route.value == "UNDERWRITING"
        else ApplicationStatus(result.recommendation.value)
    )

    # Client persona definition (Decision factors contain ONLY public fields, no raw fields)
    personas.append(
        {
            "id": raw["id"],
            "login": raw["login"],
            "label": f"Демо {raw['login']} · ИНН {raw['company']['inn']}",
            "company": {
                "id": raw["id"],
                "name": f"{'ИП' if raw['company']['legal_form'] == 'IP' else 'ООО'} · {raw['company']['inn']}",
                **raw["company"],
            },
            "request": {**raw["request"], "term_months": int(raw["request"]["term_months"])},
            "journey": journey(final),
            "simulation": simulations(raw["id"], result),
            "decision": {
                "factors": [
                    {
                        "code": f.code.value,
                        "text": f.client_text,
                        "hint": f.hint,
                        "impact": f.impact.value,
                    }
                    for f in result.factors
                ],
                "offers": result_to_json(result)["offers"],
                "constraints": client_constraints(result.constraints),
                "binding": result.binding_constraint.value
                if result.binding_constraint is not None
                else None,
                "recommendations": list(
                    hints(compute_metrics(inp), result, inp, POLICY_V1).values()
                ),
                "policyVersion": result.policy_version,
            },
        }
    )

    run_id = f"run-seed-{raw['id']}"
    run_data = scoring_run_dict(run_id, inp, req, result, "2026-10-25T09:00:00Z", POLICY_V1)
    scoring_runs[raw["id"]] = run_data

    # Allowed outcomes when reviewing an application from UNDERWRITING
    allowed_outcomes = []
    if final == ApplicationStatus.UNDERWRITING:
        offers_json = result_to_json(result)["offers"]
        if any(o["kind"] == "REQUESTED" for o in offers_json):
            allowed_outcomes.append("APPROVED")
        if any(o["kind"] in ("LONGER_TERM", "REDUCED_AMOUNT") for o in offers_json):
            allowed_outcomes.append("COUNTER_OFFER")
        allowed_outcomes.append("REJECTED")

    bank_dossiers[raw["id"]] = {
        "personaId": raw["id"],
        "seedId": f"seed-{raw['id']}",
        "company": {
            "id": raw["id"],
            "name": f"{'ИП' if raw['company']['legal_form'] == 'IP' else 'ООО'} · {raw['company']['inn']}",
            **raw["company"],
        },
        "request": {**raw["request"], "term_months": int(raw["request"]["term_months"])},
        "status": final.value,
        "journey": journey(final),
        "inputsSnapshot": inputs_to_json(inp),
        "runs": [run_data],
        "currentRunId": run_id,
        "engineRecommendation": result.recommendation.value,
        "allowedOutcomes": allowed_outcomes,
        "eligibleOffers": result_to_json(result)["offers"],
    }

# Review-variant: P6 CAPEX 6,000,000 / 24 months
p6_raw = next(p for p in load_raw()["personas"] if p["id"] == "p6_mismatch")
p6_inp = load_inputs("p6_mismatch")
p6_capex_req = LoanRequest("CAPEX", Decimal("6000000.00"), 24)
p6_capex_res = evaluate(p6_inp, p6_capex_req, POLICY_V1)
p6_capex_run_id = "run-p6-capex-6m-24m"
p6_capex_run = scoring_run_dict(
    p6_capex_run_id, p6_inp, p6_capex_req, p6_capex_res, "2026-10-25T09:00:00Z", POLICY_V1
)

p6_capex_offers = result_to_json(p6_capex_res)["offers"]
p6_capex_allowed = ["COUNTER_OFFER", "REJECTED"]  # DSCR knockout prevents direct APPROVED

review_variants = {
    "p6_capex_6m_24m": {
        "personaId": "p6_mismatch",
        "request": {
            "product_code": "CAPEX",
            "amount": "6000000.00",
            "term_months": 24,
            "purpose": "EQUIPMENT",
        },
        "journey": journey(ApplicationStatus.UNDERWRITING),
        "scoringRun": p6_capex_run,
        "allowedOutcomes": p6_capex_allowed,
        "eligibleOffers": p6_capex_offers,
        "clientDecision": {
            "factors": [
                {
                    "code": f.code.value,
                    "text": f.client_text,
                    "hint": f.hint,
                    "impact": f.impact.value,
                }
                for f in p6_capex_res.factors
            ],
            "offers": p6_capex_offers,
            "constraints": client_constraints(p6_capex_res.constraints),
            "binding": p6_capex_res.binding_constraint.value
            if p6_capex_res.binding_constraint is not None
            else None,
            "recommendations": list(
                hints(compute_metrics(p6_inp), p6_capex_res, p6_inp, POLICY_V1).values()
            ),
            "policyVersion": p6_capex_res.policy_version,
        },
    }
}

# Python FSM validated BANK transitions from UNDERWRITING
bank_transitions = {}
for target_status in (
    ApplicationStatus.APPROVED,
    ApplicationStatus.COUNTER_OFFER,
    ApplicationStatus.REJECTED,
):
    ev = transition(
        ApplicationStatus.UNDERWRITING,
        target_status,
        Actor.BANK,
        at=datetime(2026, 10, 25, tzinfo=timezone.utc),
        reason="Согласовано андеррайтером",
    )
    bank_transitions[f"UNDERWRITING_{target_status.value}"] = {
        "from": ev.from_status,
        "to": ev.to_status,
        "actor": ev.actor,
        "reasonRequired": True,
    }

# Demo Scenarios Catalog and Presets
scenarios_catalog = [
    {
        "id": "factory",
        "title": "Заводское состояние (6 примеров)",
        "description": "Шесть исходных банковских примеров (P1–P6), пустые заявки сеанса.",
        "personaLogin": "p1",
        "startingStage": "DRAFT",
        "expectedSteps": "Исходный демо-бейзлайн для проверки очереди и создания новой заявки.",
    },
    {
        "id": "p1-apply",
        "title": "P1: Новая заявка и сквозной путь",
        "description": "Черновик P1 (ИП, 2 млн ₽ / 24 мес). Создание, согласия, подача и автоматическое одобрение.",
        "personaLogin": "p1",
        "startingStage": "DRAFT",
        "expectedSteps": "Вход p1 → продолжение черновика → чекбоксы согласий → подача заявки → скоринг → APPROVED.",
    },
    {
        "id": "p1-approved",
        "title": "P1: Одобрено (выбор предложения)",
        "description": "Заявка P1 одобрена скорингом, сформировано кредитное предложение.",
        "personaLogin": "p1",
        "startingStage": "APPROVED",
        "expectedSteps": "Вход p1 → карточка предложения → диалог подтверждения → переход к подписанию.",
    },
    {
        "id": "p2-counter",
        "title": "P2: Контроффер (увеличение срока)",
        "description": "Запрос на 24 мес превышает лимит платежа. Предложен альтернативный срок 36 мес.",
        "personaLogin": "p2",
        "startingStage": "COUNTER_OFFER",
        "expectedSteps": "Вход p2 → изучение причин и ограничений → симуляция параметров → принятие альтернативы.",
    },
    {
        "id": "p3-counter",
        "title": "P3: Контроффер (снижение суммы)",
        "description": "Запрос на 5 млн ₽ ограничен лимитом DSCR (допустимо 4.89 млн ₽).",
        "personaLogin": "p3",
        "startingStage": "COUNTER_OFFER",
        "expectedSteps": "Вход p3 → анализ лимитирующего фактора DSCR → принятие сниженной суммы.",
    },
    {
        "id": "p4-reject",
        "title": "P4: Отказ (текущая просрочка БКИ)",
        "description": "Стоп-фактор BKI_CURRENT_OVERDUE. Отсутствие офферов, кредитование заблокировано.",
        "personaLogin": "p4",
        "startingStage": "REJECTED",
        "expectedSteps": "Вход p4 → карточка отказа со стоп-фактором → отсутствие предложений и подписи.",
    },
    {
        "id": "p5-young",
        "title": "P5: Отказ (молодой бизнес) и рекомендация",
        "description": "Возраст бизнеса менее 3 месяцев (BUSINESS_TOO_YOUNG). Рекомендация повторной подачи.",
        "personaLogin": "p5",
        "startingStage": "REJECTED",
        "expectedSteps": "Вход p5 → причины отказа → дата допустимой повторной подачи в рекомендациях.",
    },
    {
        "id": "p6-review",
        "title": "P6: Ручное рассмотрение андеррайтером",
        "description": "Несовпадение выручки ФНС и счетов требует ручной верификации кредитным специалистом.",
        "personaLogin": "underwriter",
        "startingStage": "UNDERWRITING",
        "expectedSteps": "Вход underwriter → досье заявки → проверка трассы → ручное решение с комментарием → клиент p6.",
    },
    {
        "id": "p1-signing",
        "title": "P1: Подписание СМС-кодом",
        "description": "Оффер принят, сформирован проверочный код 123456 на экране (3 попытки ввода).",
        "personaLogin": "p1",
        "startingStage": "SIGNING",
        "expectedSteps": "Вход p1 → ввод кода подписи → проверка счётчика попыток при ошибке → статус SIGNED.",
    },
    {
        "id": "p1-signed",
        "title": "P1: Подписано (ожидание выдачи)",
        "description": "Договор подписан, заявка ожидает завершения межбанковских процедур.",
        "personaLogin": "p1",
        "startingStage": "SIGNED",
        "expectedSteps": "Вход p1 → статус «Подписано» → поллинг конвейера → автоматический переход в «Кредит выдан».",
    },
    {
        "id": "p1-expired",
        "title": "P1: Истёкший срок условий",
        "description": "30-минутный срок действия одобренных условий истёк.",
        "personaLogin": "p1",
        "startingStage": "EXPIRED",
        "expectedSteps": "Вход p1 → экран с истёкшими условиями → блокировка выбора и кнопка подачи новой заявки.",
    },
    {
        "id": "p1-disbursed",
        "title": "P1: Кредит выдан (финал)",
        "description": "Финальная стадия: деньги зачислены на счёт, завершённый таймлайн, остановка опроса.",
        "personaLogin": "p1",
        "startingStage": "DISBURSED",
        "expectedSteps": "Вход p1 → экран «Кредит выдан» → полная история этапов.",
    },
]


def build_preset_application(preset_id):
    p1 = personas[0]
    now_base = datetime(2026, 10, 25, 9, 0, 0, tzinfo=timezone.utc)

    if preset_id == "factory":
        return None

    if preset_id == "p1-apply":
        return {
            "id": "live-p1-draft",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": [],
            "status": "DRAFT",
            "version": 1,
            "history": [
                {"from": None, "to": "DRAFT", "actor": "CLIENT", "at": now_base.isoformat()}
            ],
            "createdAt": now_base.isoformat(),
        }

    if preset_id == "p1-approved":
        return {
            "id": "live-p1-approved",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": ["BKI_REQUEST", "PD_PROCESSING"],
            "status": "APPROVED",
            "version": 4,
            "history": [
                {**e, "at": (now_base + timedelta(seconds=i)).isoformat()}
                for i, e in enumerate(journey(ApplicationStatus.APPROVED))
            ],
            "createdAt": now_base.isoformat(),
            "decision": p1["decision"],
        }

    for target_id, persona_key, status_enum in [
        ("p2-counter", "p2_longer_term", ApplicationStatus.COUNTER_OFFER),
        ("p3-counter", "p3_reduced", ApplicationStatus.COUNTER_OFFER),
        ("p4-reject", "p4_overdue", ApplicationStatus.REJECTED),
        ("p5-young", "p5_young", ApplicationStatus.REJECTED),
        ("p6-review", "p6_mismatch", ApplicationStatus.UNDERWRITING),
    ]:
        if preset_id == target_id:
            p_obj = next(p for p in personas if p["id"] == persona_key)
            return {
                "id": f"live-{target_id}",
                "companyId": persona_key,
                "companyName": p_obj["company"]["name"],
                "productCode": p_obj["request"]["product_code"],
                "amount": p_obj["request"]["amount"],
                "termMonths": p_obj["request"]["term_months"],
                "purpose": "WORKING_CAPITAL",
                "consents": ["BKI_REQUEST", "PD_PROCESSING"],
                "status": status_enum.value,
                "version": 4,
                "history": [
                    {**e, "at": (now_base + timedelta(seconds=i)).isoformat()}
                    for i, e in enumerate(journey(status_enum))
                ],
                "createdAt": now_base.isoformat(),
                "decision": p_obj["decision"],
            }

    if preset_id == "p1-signing":
        j = journey(ApplicationStatus.APPROVED)
        j.append({"from": "APPROVED", "to": "SIGNING", "actor": "CLIENT"})
        replay(
            [initial_event(Actor.CLIENT, now_base)]
            + [
                transition(
                    e["from"],
                    ApplicationStatus(e["to"]),
                    Actor(e["actor"]),
                    at=now_base + timedelta(seconds=i),
                )
                for i, e in enumerate(j[1:], 1)
            ]
        )
        return {
            "id": "live-p1-signing",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": ["BKI_REQUEST", "PD_PROCESSING"],
            "status": "SIGNING",
            "version": 5,
            "history": [
                {**e, "at": (now_base + timedelta(seconds=i)).isoformat()} for i, e in enumerate(j)
            ],
            "createdAt": now_base.isoformat(),
            "decision": p1["decision"],
            "selectedOffer": p1["decision"]["offers"][0],
            "challenge": {
                "id": "challenge-p1-signing",
                "code": "123456",
                "attemptsLeft": 3,
                "expiresInMs": 300000,
            },
        }

    if preset_id == "p1-signed":
        j = journey(ApplicationStatus.APPROVED)
        j.append({"from": "APPROVED", "to": "SIGNING", "actor": "CLIENT"})
        j.append({"from": "SIGNING", "to": "SIGNED", "actor": "CLIENT"})
        return {
            "id": "live-p1-signed",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": ["BKI_REQUEST", "PD_PROCESSING"],
            "status": "SIGNED",
            "version": 6,
            "history": [
                {**e, "at": (now_base + timedelta(seconds=i)).isoformat()} for i, e in enumerate(j)
            ],
            "createdAt": now_base.isoformat(),
            "decision": p1["decision"],
            "selectedOffer": p1["decision"]["offers"][0],
        }

    if preset_id == "p1-expired":
        j = journey(ApplicationStatus.APPROVED)
        j.append({"from": "APPROVED", "to": "EXPIRED", "actor": "SYSTEM"})
        return {
            "id": "live-p1-expired",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": ["BKI_REQUEST", "PD_PROCESSING"],
            "status": "EXPIRED",
            "version": 5,
            "history": [
                {**e, "at": (now_base + timedelta(seconds=i)).isoformat()} for i, e in enumerate(j)
            ],
            "createdAt": now_base.isoformat(),
            "decision": p1["decision"],
            "selectedOffer": p1["decision"]["offers"][0],
        }

    if preset_id == "p1-disbursed":
        j = journey(ApplicationStatus.APPROVED)
        j.append({"from": "APPROVED", "to": "SIGNING", "actor": "CLIENT"})
        j.append({"from": "SIGNING", "to": "SIGNED", "actor": "CLIENT"})
        j.append({"from": "SIGNED", "to": "DISBURSED", "actor": "SYSTEM"})
        return {
            "id": "live-p1-disbursed",
            "companyId": "p1_ideal",
            "companyName": p1["company"]["name"],
            "productCode": "WC_FLEX",
            "amount": "2000000.00",
            "termMonths": 24,
            "purpose": "WORKING_CAPITAL",
            "consents": ["BKI_REQUEST", "PD_PROCESSING"],
            "status": "DISBURSED",
            "version": 7,
            "history": [
                {**e, "at": (now_base + timedelta(seconds=i)).isoformat()} for i, e in enumerate(j)
            ],
            "createdAt": now_base.isoformat(),
            "decision": p1["decision"],
            "selectedOffer": p1["decision"]["offers"][0],
        }

    raise ValueError(f"Unknown preset {preset_id}")


scenario_presets = {
    s["id"]: {
        "scenario": s,
        "application": build_preset_application(s["id"]),
    }
    for s in scenarios_catalog
}

# 144 Combinations Sandbox Registry & Catalog
sandbox_policies = [
    ("policy_v1", "Базовая демо-политика (16.5%)", POLICY_V1),
    (
        "policy_minus_2",
        "Сниженная ставка (-2 п.п., 14.5%)",
        POLICY_V1.with_key_rate(POLICY_V1.key_rate_pct - Decimal("2.00")),
    ),
    (
        "policy_plus_2",
        "Повышенная ставка (+2 п.п., 18.5%)",
        POLICY_V1.with_key_rate(POLICY_V1.key_rate_pct + Decimal("2.00")),
    ),
]

sandbox_catalog = {
    "personas": [
        {
            "id": p["id"],
            "label": p["label"],
            "companyName": p["company"]["name"],
            "inn": p["company"]["inn"],
            "productCode": p["request"]["product_code"],
        }
        for p in personas
    ],
    "turnoverVariants": [
        {"id": "baseline", "label": "Базовые обороты (100%)"},
        {"id": "reduced", "label": "Сниженные обороты (-20%)"},
    ],
    "overdueVariants": [
        {"id": 0, "label": "Без текущей просрочки (0 дней)"},
        {"id": 45, "label": "Текущая просрочка (45 дней)"},
    ],
    "businessAgeVariants": [
        {"id": 1, "label": "Новый бизнес (1 мес.)"},
        {"id": 48, "label": "Зрелый бизнес (48 мес.)"},
    ],
    "policies": [
        {
            "id": pol_id,
            "name": pol_label,
            "keyRatePct": str(pol_obj.key_rate_pct),
            "version": pol_obj.version,
        }
        for pol_id, pol_label, pol_obj in sandbox_policies
    ],
}

sandbox_registry = {}
for raw in load_raw()["personas"]:
    pid = raw["id"]
    base_inp = load_inputs(pid)
    base_req = load_request(pid)

    # Precompute exact baseline cases for "Исходный снимок"
    for pol_id, pol_label, pol_obj in sandbox_policies:
        base_res = evaluate(base_inp, base_req, pol_obj)
        base_met = compute_metrics(base_inp)
        b_key = f"{pid}:exact_baseline:{pol_id}"
        sandbox_registry[b_key] = {
            "inputHash": hash_data(inputs_to_json(base_inp)),
            "resultHash": hash_data(result_to_json(base_res)),
            "policyId": pol_id,
            "policyVersion": pol_obj.version,
            "keyRatePct": str(pol_obj.key_rate_pct),
            "inputSnapshot": inputs_to_json(base_inp),
            "metrics": {
                k: (str(v) if isinstance(v, Decimal) else v) for k, v in asdict(base_met).items()
            },
            "result": {
                "recommendation": base_res.recommendation.value,
                "route": base_res.route.value,
                "score": base_res.score,
                "grade": base_res.grade.value if base_res.grade is not None else None,
                "bindingConstraint": base_res.binding_constraint.value
                if base_res.binding_constraint is not None
                else None,
                "topReasons": [r.value for r in base_res.top_reasons],
                "reviewFlags": [f.value for f in base_res.review_flags],
            },
            "offers": result_to_json(base_res)["offers"],
            "constraints": [
                {
                    "name": c.name.value,
                    "limit": str(c.limit.quantize(Decimal("0.01"))),
                    "binding": c.binding,
                }
                for c in base_res.constraints
            ],
            "factors": [
                {
                    "code": f.code.value,
                    "impact": f.impact.value,
                    "clientText": f.client_text,
                    "hint": f.hint,
                }
                for f in base_res.factors
            ],
            "disclaimer": "Синтетический демо-расчёт в песочнице. Не создаёт заявку, не меняет очередь и метрики конвейера.",
        }

    # 144 combinatorial runs
    for turnover in ("baseline", "reduced"):
        acc = base_inp.account
        if turnover == "reduced":
            acc = replace(
                acc,
                inflows=tuple((x * Decimal("0.80")).quantize(Decimal("0.01")) for x in acc.inflows),
                outflows=tuple(
                    (x * Decimal("0.80")).quantize(Decimal("0.01")) for x in acc.outflows
                ),
            )
        for overdue in (0, 45):
            bki = tuple(
                replace(
                    b,
                    current_overdue_days=overdue,
                    max_overdue_days_12m=overdue,
                    max_overdue_days_24m=overdue,
                )
                for b in base_inp.bki
            )
            for age in (1, 48):
                reg_date = date(2026, 9, 24) if age == 1 else date(2022, 10, 24)
                comp = replace(base_inp.company, registered_at=reg_date)
                comb_inp = replace(base_inp, account=acc, bki=bki, company=comp)
                for pol_id, pol_label, pol_obj in sandbox_policies:
                    res = evaluate(comb_inp, base_req, pol_obj)
                    met = compute_metrics(comb_inp)
                    key = f"{pid}:{turnover}:{overdue}:{age}:{pol_id}"
                    sandbox_registry[key] = {
                        "inputHash": hash_data(inputs_to_json(comb_inp)),
                        "resultHash": hash_data(result_to_json(res)),
                        "policyId": pol_id,
                        "policyVersion": pol_obj.version,
                        "keyRatePct": str(pol_obj.key_rate_pct),
                        "inputSnapshot": inputs_to_json(comb_inp),
                        "metrics": {
                            k: (str(v) if isinstance(v, Decimal) else v)
                            for k, v in asdict(met).items()
                        },
                        "result": {
                            "recommendation": res.recommendation.value,
                            "route": res.route.value,
                            "score": res.score,
                            "grade": res.grade.value if res.grade is not None else None,
                            "bindingConstraint": res.binding_constraint.value
                            if res.binding_constraint is not None
                            else None,
                            "topReasons": [r.value for r in res.top_reasons],
                            "reviewFlags": [f.value for f in res.review_flags],
                        },
                        "offers": result_to_json(res)["offers"],
                        "constraints": [
                            {
                                "name": c.name.value,
                                "limit": str(c.limit.quantize(Decimal("0.01"))),
                                "binding": c.binding,
                            }
                            for c in res.constraints
                        ],
                        "factors": [
                            {
                                "code": f.code.value,
                                "impact": f.impact.value,
                                "clientText": f.client_text,
                                "hint": f.hint,
                            }
                            for f in res.factors
                        ],
                        "disclaimer": "Синтетический демо-расчёт в песочнице. Не создаёт заявку, не меняет очередь и метрики конвейера.",
                    }

data = {
    "policyVersion": POLICY_V1.version,
    "products": [
        {
            **asdict(p),
            "min_amount": str(p.min_amount),
            "max_amount": str(p.max_amount),
            "spread_pct": str(p.spread_pct),
        }
        for p in POLICY_V1.products
    ],
    "amountStep": str(POLICY_V1.amount_step),
    "termStep": POLICY_V1.term_step,
    "personas": personas,
    "customJourney": journey(ApplicationStatus.UNDERWRITING),
    "signingEvents": {
        f"{src.value}_{dst.value}": {"from": e.from_status, "to": e.to_status, "actor": e.actor}
        for src, dst, actor in (
            (ApplicationStatus.SIGNING, ApplicationStatus.SIGNED, Actor.CLIENT),
            (ApplicationStatus.SIGNING, ApplicationStatus.EXPIRED, Actor.SYSTEM),
            (ApplicationStatus.SIGNED, ApplicationStatus.DISBURSED, Actor.SYSTEM),
        )
        for e in [transition(src, dst, actor, at=datetime(2026, 10, 25, tzinfo=timezone.utc))]
    },
    "decisionEvents": {
        f"{src.value}_{dst.value}": {"from": e.from_status, "to": e.to_status, "actor": e.actor}
        for src in (ApplicationStatus.APPROVED, ApplicationStatus.COUNTER_OFFER)
        for dst, actor in (
            (ApplicationStatus.SIGNING, Actor.CLIENT),
            (ApplicationStatus.EXPIRED, Actor.SYSTEM),
        )
        for e in [transition(src, dst, actor, at=datetime(2026, 10, 25, tzinfo=timezone.utc))]
    },
    "scenarios": scenarios_catalog,
}

bank_data = {
    "policy": policy_to_json(POLICY_V1),
    "scoringRuns": scoring_runs,
    "dossiers": bank_dossiers,
    "reviewVariants": review_variants,
    "bankTransitions": bank_transitions,
    "scenarioPresets": scenario_presets,
    "sandboxCatalog": sandbox_catalog,
    "sandboxRegistry": sandbox_registry,
}

output = "// Generated by scripts/export_frontend_demo.py. Do not edit. Not an HTTP contract.\n"
output += (
    "export const DOMAIN_STATUSES = "
    + json.dumps([s.value for s in ApplicationStatus])
    + " as const;\n"
)
output += "export type ApplicationStatus = typeof DOMAIN_STATUSES[number];\n"
output += (
    "export const POLLING_STATUSES: readonly ApplicationStatus[] = "
    + json.dumps(sorted(s.value for s in IN_PROGRESS))
    + ";\n"
)
output += (
    "export const demoData = " + json.dumps(data, ensure_ascii=False, indent=2) + " as const;\n"
)
output += (
    "export const bankDemoData = "
    + json.dumps(bank_data, ensure_ascii=False, indent=2)
    + " as const;\n"
)

target = ROOT / "frontend/src/demo/generated.ts"
target.parent.mkdir(parents=True, exist_ok=True)
if "--check" in sys.argv:
    if not target.exists() or target.read_text() != output:
        raise SystemExit("Demo fixtures are stale. Run npm run gen:demo --prefix frontend")
    print("Demo fixtures match backend seed, policy and FSM")
else:
    target.write_text(output)
    print(
        f"Exported {len(personas)} personas, {len(POLICY_V1.products)} products, public demoData, and bankDemoData with bank projection"
    )
