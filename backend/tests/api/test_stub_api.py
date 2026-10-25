from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_and_demo_personas() -> None:
    assert client.get("/api/v1/health").json() == {"status": "ok", "mode": "stub"}
    response = client.get("/api/v1/demo/personas")
    assert response.status_code == 200
    assert len(response.json()) == 6


def test_stub_application_lifecycle() -> None:
    login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "2000000.00", "term_months": 24},
    )
    assert created.status_code == 201
    application_id = created.json()["id"]
    assert created.json()["status"] == "DRAFT"

    submitted = client.post(f"/api/v1/applications/{application_id}/submit", headers=headers)
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "APPROVED"
    assert submitted.json()["decision"]["outcome"] == "APPROVED"


def test_unauthenticated_application_access_is_rejected() -> None:
    response = client.get("/api/v1/applications")
    assert response.status_code == 401


def test_invalid_credentials_are_rejected() -> None:
    response = client.post("/api/v1/auth/login", json={"login": "p1", "password": "wrong"})
    assert response.status_code == 401


def test_bank_user_cannot_create_client_application() -> None:
    login = client.post("/api/v1/auth/login", json={"login": "underwriter", "password": "demo"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        "/api/v1/applications",
        headers=headers,
        json={"product_code": "WC_FLEX", "amount": "1000000.00", "term_months": 12},
    )
    assert response.status_code == 403


def test_client_cannot_submit_another_clients_application() -> None:
    first_login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    first_headers = {"Authorization": f"Bearer {first_login.json()['access_token']}"}
    created = client.post(
        "/api/v1/applications",
        headers=first_headers,
        json={"product_code": "WC_FLEX", "amount": "1000000.00", "term_months": 12},
    )
    application_id = created.json()["id"]

    second_login = client.post("/api/v1/auth/login", json={"login": "p2", "password": "demo"})
    second_headers = {"Authorization": f"Bearer {second_login.json()['access_token']}"}
    response = client.post(f"/api/v1/applications/{application_id}/submit", headers=second_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "APPLICATION_NOT_FOUND"


def test_bank_contour_requires_bank_role_and_hides_dossier_from_client() -> None:
    client_login = client.post("/api/v1/auth/login", json={"login": "p1", "password": "demo"})
    client_headers = {"Authorization": f"Bearer {client_login.json()['access_token']}"}
    forbidden = client.get("/api/v1/bank/applications", headers=client_headers)
    assert forbidden.status_code == 403

    bank_login = client.post(
        "/api/v1/auth/login", json={"login": "underwriter", "password": "demo"}
    )
    bank_headers = {"Authorization": f"Bearer {bank_login.json()['access_token']}"}
    queue = client.get("/api/v1/bank/applications", headers=bank_headers)
    assert queue.status_code == 200
    assert "items" in queue.json()


def test_bank_metrics_are_available_only_to_bank() -> None:
    bank_login = client.post(
        "/api/v1/auth/login", json={"login": "underwriter", "password": "demo"}
    )
    bank_headers = {"Authorization": f"Bearer {bank_login.json()['access_token']}"}
    response = client.get("/api/v1/bank/metrics", headers=bank_headers)
    assert response.status_code == 200
    assert response.json()["total_applications"] >= 0
