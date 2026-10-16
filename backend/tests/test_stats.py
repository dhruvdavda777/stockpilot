def test_stats_on_empty_inventory(client):
    stats = client.get("/api/stats").json()
    assert stats["total_products"] == 0
    assert stats["inventory_value"] == 0
    assert stats["by_category"] == []


def test_stats_aggregates(client, category):
    client.post(
        "/api/products",
        json={"sku": "A", "name": "A", "category_id": category["id"], "quantity": 10, "unit_price": 2.5},
    )
    client.post("/api/products", json={"sku": "B", "name": "B", "quantity": 0, "unit_price": 100})
    client.post("/api/products", json={"sku": "C", "name": "C", "quantity": 50, "reorder_level": 5, "unit_price": 1})

    stats = client.get("/api/stats").json()
    assert stats["total_products"] == 3
    assert stats["total_units"] == 60
    assert stats["inventory_value"] == 75.0
    assert (stats["in_stock"], stats["low_stock"], stats["out_of_stock"]) == (1, 1, 1)
    assert stats["categories"] == 1
    assert stats["movements_last_24h"] == 2  # initial movements for A and C
    by_cat = {row["category"]: row for row in stats["by_category"]}
    assert by_cat["Electronics"]["value"] == 25.0
    assert by_cat["Uncategorised"]["products"] == 2


def test_seed_demo_data_is_idempotent(engine):
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from app.models import Product
    from app.seed import PRODUCTS, seed_demo_data

    with Session(engine) as db:
        seed_demo_data(db)
        seed_demo_data(db)
        assert db.scalar(select(func.count(Product.id))) == len(PRODUCTS)
