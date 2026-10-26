"""Published DTOs must also work with the database-free HTTP demo."""

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_selected_counter_offer_survives_rereading_and_disbursement() -> None:
    with TestClient(create_app(Settings(app_mode="stub"))) as client:
        login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        created = client.post(
            "/api/v1/applications",
            headers=headers,
            json={"product_code": "WC_FLEX", "amount": "5000000.00", "term_months": 6},
        ).json()
        path = f"/api/v1/applications/{created['id']}"
        decision = client.post(f"{path}/submit?version=1", headers=headers).json()
        assert decision["status"] == "COUNTER_OFFER"
        assert decision["selected_offer"] is None
        offers = decision["decision"]["offers"]
        assert len(offers) == 2
        selected = offers[1]
        assert selected["amount"] != decision["amount"]

        # Invalid or missing choices must not change the application or its version.
        for offer_id, error in [
            (None, "OFFER_REQUIRED"),
            ("00000000-0000-4000-8000-000000000000", "OFFER_NOT_FOUND"),
        ]:
            params = {"version": decision["version"]}
            if offer_id is not None:
                params["offer_id"] = offer_id
            rejected = client.post(f"{path}/accept", params=params, headers=headers)
            assert rejected.status_code == 400
            assert rejected.json()["code"] == error

        accepted = client.post(
            f"{path}/accept",
            params={"version": decision["version"], "offer_id": selected["id"]},
            headers=headers,
        )
        assert accepted.status_code == 200, accepted.text

        def reread(status: str) -> dict:
            listing = client.get("/api/v1/applications", headers=headers).json()["items"]
            record = next(item for item in listing if item["id"] == created["id"])
            assert record["status"] == status
            assert record["selected_offer"] == selected
            assert record["amount"] == "5000000.00"
            assert record["term_months"] == 6
            return record

        signing = reread("SIGNING")
        signed = client.post(
            f"{path}/sign?version={signing['version']}",
            json={"code": accepted.json()["code"]},
            headers=headers,
        )
        assert signed.status_code == 200, signed.text
        assert signed.json()["selected_offer"] == selected
        reread("DISBURSED")


def test_stub_catalog_and_bank_commands_match_published_contract() -> None:
    with TestClient(create_app(Settings(app_mode="stub"))) as client:
        products = client.get("/api/v1/products")
        assert products.status_code == 200
        assert products.json()["items"][0]["code"] == "WC_FLEX"
        assert isinstance(products.json()["items"][0]["min_amount"], str)

        def login(name: str) -> dict[str, str]:
            response = client.post("/api/v1/auth/login", json={"login": name, "password": "demo"})
            assert response.status_code == 200
            return {"Authorization": f"Bearer {response.json()['access_token']}"}

        customer = login("p6")
        employee = login("underwriter")
        created = client.post(
            "/api/v1/applications",
            headers=customer,
            json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
        )
        assert created.status_code == 201
        identifier = created.json()["id"]
        submitted = client.post(
            f"/api/v1/applications/{identifier}/submit?version=1", headers=customer
        )
        assert submitted.status_code == 200
        assert submitted.json()["status"] == "UNDERWRITING"
        rescore = client.post(f"/api/v1/bank/applications/{identifier}/rescore", headers=employee)
        assert rescore.status_code == 200
        assert rescore.json()["id"] == identifier
        decided = client.post(
            f"/api/v1/bank/applications/{identifier}/decision",
            headers=employee,
            json={"outcome": "REJECTED", "comment": "Synthetic frontend contract review"},
        )
        assert decided.status_code == 200
        assert decided.json()["status"] == "REJECTED"
        dossier = client.get(f"/api/v1/bank/applications/{identifier}", headers=employee).json()
        assert [event["action"] for event in dossier["audit"]] == [
            "RESCORE",
            "UNDERWRITER_DECISION",
        ]
