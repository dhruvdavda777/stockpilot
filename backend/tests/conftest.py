"""Test fixtures.

By default tests run against in-memory SQLite so `pytest` works with zero setup.
Set TEST_DATABASE_URL to run the same suite against a real PostgreSQL (CI does).
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import database
from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")


def _make_engine():
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            TEST_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(engine, "connect")
        def _enable_fks(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(TEST_DATABASE_URL)


@pytest.fixture()
def engine(monkeypatch):
    engine = _make_engine()
    Base.metadata.create_all(engine)
    monkeypatch.setattr(database, "engine", engine)  # used by /ready
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def category(client):
    return client.post("/api/categories", json={"name": "Electronics"}).json()


@pytest.fixture()
def product(client, category):
    payload = {
        "sku": "EL-1001",
        "name": "Wireless Mouse",
        "category_id": category["id"],
        "quantity": 50,
        "reorder_level": 10,
        "unit_price": 24.99,
        "supplier": "Logitech",
    }
    return client.post("/api/products", json=payload).json()
