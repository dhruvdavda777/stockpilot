from app import database


def test_root(client):
    body = client.get("/").json()
    assert body["service"] == "StockPilot API"
    assert body["docs"] == "/docs"


def test_health_is_up(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_ready_checks_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "READY"


def test_ready_returns_503_when_database_is_down(client, monkeypatch):
    from sqlalchemy import create_engine

    # Port 1 on localhost: nothing listens there, so connect fails fast.
    broken = create_engine("postgresql+psycopg://x:x@127.0.0.1:1/x", connect_args={"connect_timeout": 1})
    monkeypatch.setattr(database, "engine", broken)
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "NOT_READY"


def test_metrics_exposed_for_prometheus(client):
    client.get("/api/products")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "stockpilot_stock_movements_total" in response.text
