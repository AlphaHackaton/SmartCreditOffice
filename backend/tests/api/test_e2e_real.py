"""E2E: API create → submit → score → sign → disburse against real PostgreSQL.

Requires a running PostgreSQL (compose `db` or local) reachable via
`TEST_DATABASE_URL`; skipped with an explicit reason otherwise (AGENTS.md).
"""

import os
import time
from collections.abc import Iterator

import pytest

fastapi_testclient = pytest.importorskip("fastapi.testclient")

from app.config import Settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import create_app  # noqa: E402

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://credit:credit@localhost:5432/credit_test"
)


def _database_available(url: str) -> bool:
    from sqlalchemy import create_engine, text

    try:
        engine = create_engine(url)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
    except Exception:
        return False
    return True


pytestmark = pytest.mark.skipif(
    not _database_available(TEST_DATABASE_URL),
    reason=f"E2E требует PostgreSQL ({TEST_DATABASE_URL}); поднимите compose `db`",
)


@pytest.fixture()
def app_client() -> Iterator[object]:
    from sqlalchemy import create_engine, text

    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(engine)

    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    app = create_app(Settings(app_mode="real", database_url=TEST_DATABASE_URL))
    client = fastapi_testclient.TestClient(app)
    with client:
        yield client
    engine.dispose()


def test_full_pipeline_create_submit_score_sign_disburse(app_client: object) -> None:
    client = app_client

    # --- login as the ideal persona client ---
    login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert login.json()["user"]["role"] == "CLIENT"

    # --- company profile with pre-approved limit ---
    company = client.get("/api/v1/companies/me", headers=headers)
    assert company.status_code == 200, company.text
    assert company.json()["inn"] == "770123456703"
    assert company.json()["pre_approved_limit"] is not None

    # --- product catalog ---
    products = client.get("/api/v1/products")
    assert products.status_code == 200
    codes = {item["code"] for item in products.json()["items"]}
    assert {"WC_FLEX", "CAPEX"} <= codes

    # --- create draft ---
    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
    )
    assert created.status_code == 201, created.text
    application = created.json()
    assert application["status"] == "DRAFT"
    application_id = application["id"]

    # --- simulate before submitting ---
    simulation = client.post(
        f"/api/v1/applications/{application_id}/simulate",
        headers=headers,
        json={"amount": "2000000.00", "term_months": 24},
    )
    assert simulation.status_code == 200, simulation.text
    assert simulation.json()["predicted_outcome"] == "APPROVED"

    # --- submit → background scoring → APPROVED with a transparent decision ---
    submitted = client.post(
        f"/api/v1/applications/{application_id}/submit?version={application['version']}",
        headers=headers,
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "SUBMITTED"

    decision_state = _await_status(client, headers, application_id, {"APPROVED", "COUNTER_OFFER"})
    assert decision_state["decision"] is not None
    assert decision_state["decision"]["outcome"] == "APPROVED"
    assert decision_state["decision"]["factors"], "decision must be explainable"
    assert decision_state["decision"]["offers"], "approved application must carry offers"

    # --- accept the offer → OTP challenge inside the UI ---
    accepted = client.post(
        f"/api/v1/applications/{application_id}/accept?version={decision_state['version']}",
        headers=headers,
    )
    assert accepted.status_code == 200, accepted.text
    code = accepted.json()["code"]
    assert len(code) == 6

    # --- sign with the on-screen code ---
    sign_version = _version(client, headers, application_id)
    signed = client.post(
        f"/api/v1/applications/{application_id}/sign?version={sign_version}",
        headers=headers,
        json={"code": code},
    )
    assert signed.status_code == 200, signed.text
    assert signed.json()["status"] == "SIGNED"

    # --- background disbursement → terminal DISBURSED ---
    disbursed = _await_status(client, headers, application_id, {"DISBURSED"}, timeout=10.0)
    assert disbursed["status"] == "DISBURSED"

    # --- full status history preserved through the FSM ---
    statuses = [event["to_status"] for event in disbursed["history"]]
    assert statuses == [
        "DRAFT",
        "SUBMITTED",
        "SCORING",
        "APPROVED",
        "SIGNING",
        "SIGNED",
        "DISBURSED",
    ]


def test_bank_contour_sees_dossier_and_metrics(app_client: object) -> None:
    client = app_client
    login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
    )
    application_id = created.json()["id"]
    client.post(
        f"/api/v1/applications/{application_id}/submit?version=1",
        headers=headers,
    )
    _await_status(client, headers, application_id, {"APPROVED", "COUNTER_OFFER"})

    bank_login = client.post(
        "/api/v1/auth/login", json={"login": "underwriter", "password": "demo"}
    )
    bank_headers = {"Authorization": f"Bearer {bank_login.json()['access_token']}"}

    queue = client.get("/api/v1/bank/applications", headers=bank_headers)
    assert queue.status_code == 200
    assert any(item["id"] == application_id for item in queue.json()["items"])

    dossier = client.get(f"/api/v1/bank/applications/{application_id}", headers=bank_headers)
    assert dossier.status_code == 200, dossier.text
    assert dossier.json()["inputs_snapshot"], "dossier must show the scoring inputs snapshot"

    runs = client.get(
        f"/api/v1/bank/applications/{application_id}/scoring-runs", headers=bank_headers
    )
    assert runs.status_code == 200
    assert len(runs.json()) == 1

    metrics = client.get("/api/v1/bank/metrics", headers=bank_headers)
    assert metrics.status_code == 200
    assert metrics.json()["total_applications"] >= 1

    # client cannot see the bank contour
    forbidden = client.get("/api/v1/bank/applications", headers=headers)
    assert forbidden.status_code == 403


def test_otp_attempts_and_version_conflict(app_client: object) -> None:
    client = app_client
    login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
    )
    application_id = created.json()["id"]
    client.post(f"/api/v1/applications/{application_id}/submit?version=1", headers=headers)
    approved = _await_status(client, headers, application_id, {"APPROVED", "COUNTER_OFFER"})

    # stale version on accept → 409
    stale = client.post(f"/api/v1/applications/{application_id}/accept?version=1", headers=headers)
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"

    accepted = client.post(
        f"/api/v1/applications/{application_id}/accept?version={approved['version']}",
        headers=headers,
    )
    assert accepted.status_code == 200

    # wrong OTP three times → attempt limit
    current_version = _version(client, headers, application_id)
    for _ in range(3):
        bad = client.post(
            f"/api/v1/applications/{application_id}/sign?version={current_version}",
            headers=headers,
            json={"code": "000000"},
        )
        assert bad.status_code == 400
        assert bad.json()["code"] == "INVALID_OTP"
    blocked = client.post(
        f"/api/v1/applications/{application_id}/sign?version={current_version}",
        headers=headers,
        json={"code": accepted.json()["code"]},
    )
    assert blocked.status_code == 400
    assert blocked.json()["code"] == "SIGNING_ATTEMPTS_EXCEEDED"


# ---------- helpers ----------


def _get_application(client: object, headers: dict, application_id: str) -> dict:
    listing = client.get("/api/v1/applications", headers=headers)
    assert listing.status_code == 200
    for item in listing.json()["items"]:
        if item["id"] == application_id:
            return item
    raise AssertionError("application disappeared from the client list")


def _await_status(
    client: object, headers: dict, application_id: str, expected: set[str], timeout: float = 5.0
) -> dict:
    """Poll until the background task moves the application to one of `expected`."""
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        last = _get_application(client, headers, application_id)
        if last["status"] in expected:
            return last
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {expected}, last={last!r}")


def _version(client: object, headers: dict, application_id: str) -> int:
    return int(_get_application(client, headers, application_id)["version"])


def test_counter_offer_flow_uses_accepted_offer_terms(app_client: object) -> None:
    client = app_client

    # p2 requests 2.5M for 12 months but DSCR forces a counter-offer.
    login = client.post("/api/v1/auth/login", json={"login": "p2", "password": "demo"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2500000.00", "term_months": 12},
    )
    application_id = created.json()["id"]
    client.post(f"/api/v1/applications/{application_id}/submit?version=1", headers=headers)
    state = _await_status(client, headers, application_id, {"COUNTER_OFFER"})
    assert state["decision"]["outcome"] == "COUNTER_OFFER"
    offers = state["decision"]["offers"]
    assert offers, "counter-offer must carry offers"

    # accept without choosing an offer is rejected (no transition happened,
    # so the version is still the one reported by the counter-offer)
    stable_version = _version(client, headers, application_id)
    rejected = client.post(
        f"/api/v1/applications/{application_id}/accept?version={stable_version}",
        headers=headers,
    )
    assert rejected.status_code == 400
    assert rejected.json()["code"] == "OFFER_REQUIRED"

    # pick the REDUCED_AMOUNT offer: 1.21M instead of the requested 2.5M
    reduced = next(offer for offer in offers if offer["kind"] == "REDUCED_AMOUNT")
    accepted = client.post(
        f"/api/v1/applications/{application_id}/accept",
        headers=headers,
        params={"version": stable_version, "offer_id": str(reduced["id"])},
    )
    assert accepted.status_code == 200, accepted.text
    code = accepted.json()["code"]

    signing = _get_application(client, headers, application_id)
    assert signing["selected_offer"] == reduced
    assert signing["amount"] == state["amount"]
    assert signing["term_months"] == state["term_months"]

    sign_version = _version(client, headers, application_id)
    signed = client.post(
        f"/api/v1/applications/{application_id}/sign?version={sign_version}",
        headers=headers,
        json={"code": code},
    )
    assert signed.status_code == 200, signed.text
    assert signed.json()["selected_offer"] == reduced

    disbursed = _await_status(client, headers, application_id, {"DISBURSED"}, timeout=10.0)
    assert disbursed["status"] == "DISBURSED"
    assert disbursed["selected_offer"] == reduced
    assert disbursed["amount"] == state["amount"]
    assert disbursed["term_months"] == state["term_months"]

    # the bank dossier proves disbursement used the accepted offer terms,
    # and the signature carries a non-empty contract hash
    bank_login = client.post(
        "/api/v1/auth/login", json={"login": "underwriter", "password": "demo"}
    )
    bank_headers = {"Authorization": f"Bearer {bank_login.json()['access_token']}"}
    dossier = client.get(f"/api/v1/bank/applications/{application_id}", headers=bank_headers).json()
    disbursed_entries = [entry for entry in dossier["audit"] if entry["action"] == "DISBURSED"]
    assert disbursed_entries, "disbursement audit entry must exist"
    assert disbursed_entries[-1]["payload"]["amount"] == reduced["amount"]
    assert str(disbursed_entries[-1]["payload"]["term_months"]) == str(reduced["term_months"])
    signed_entries = [entry for entry in dossier["audit"] if entry["action"] == "SIGNED"]
    assert signed_entries, "signing audit entry must exist"
    contract_hash = signed_entries[-1]["payload"]["contract_hash"]
    assert contract_hash and len(contract_hash) == 64


def test_key_rate_from_settings_flows_into_offered_rate(app_client: object) -> None:
    """KEY_RATE_PCT flows into pricing: rate = key rate + spread + premiums."""
    client = app_client
    login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
    )
    application_id = created.json()["id"]
    client.post(f"/api/v1/applications/{application_id}/submit?version=1", headers=headers)
    state = _await_status(client, headers, application_id, {"APPROVED", "COUNTER_OFFER"})
    from decimal import Decimal

    rate = Decimal(state["decision"]["offers"][0]["rate_pct"])
    # KEY_RATE_PCT=16.5 + WC_FLEX spread 4.0 + grade A premium 0 + term premium 0.5
    assert rate == Decimal("21.0000"), f"rate {rate} does not reflect KEY_RATE_PCT=16.5"
