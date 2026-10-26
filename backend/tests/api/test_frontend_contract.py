"""Published DTOs must also work with the database-free HTTP demo."""

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


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
