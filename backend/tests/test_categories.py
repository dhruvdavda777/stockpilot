def test_create_and_list_categories(client):
    response = client.post("/api/categories", json={"name": "Furniture", "description": "Desks"})
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Furniture"
    assert created["product_count"] == 0

    listing = client.get("/api/categories").json()
    assert [c["name"] for c in listing] == ["Furniture"]


def test_duplicate_category_name_conflicts(client, category):
    response = client.post("/api/categories", json={"name": "Electronics"})
    assert response.status_code == 409


def test_category_product_count(client, category, product):
    listing = client.get("/api/categories").json()
    assert listing[0]["product_count"] == 1
    assert client.get(f"/api/categories/{category['id']}").json()["product_count"] == 1


def test_update_category(client, category):
    response = client.put(f"/api/categories/{category['id']}", json={"name": "Gadgets"})
    assert response.status_code == 200
    assert response.json()["name"] == "Gadgets"


def test_delete_category_keeps_products(client, category, product):
    assert client.delete(f"/api/categories/{category['id']}").status_code == 204
    assert client.get(f"/api/categories/{category['id']}").status_code == 404
    orphan = client.get(f"/api/products/{product['id']}").json()
    assert orphan["category_id"] is None
    assert orphan["category"] is None
