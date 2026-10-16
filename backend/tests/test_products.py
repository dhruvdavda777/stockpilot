def test_create_product(client, category):
    response = client.post(
        "/api/products",
        json={"sku": "OS-1", "name": "Paper", "category_id": category["id"], "quantity": 5, "reorder_level": 10},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sku"] == "OS-1"
    assert body["category"] == {"id": category["id"], "name": "Electronics"}
    assert body["stock_status"] == "low_stock"


def test_create_product_validates_input(client):
    assert client.post("/api/products", json={"sku": "", "name": "x"}).status_code == 422
    assert client.post("/api/products", json={"sku": "A1", "name": "x", "quantity": -1}).status_code == 422
    assert client.post("/api/products", json={"sku": "bad sku!", "name": "x"}).status_code == 422


def test_create_product_with_unknown_category(client):
    response = client.post("/api/products", json={"sku": "X1", "name": "x", "category_id": 999})
    assert response.status_code == 422


def test_duplicate_sku_conflicts(client, product):
    response = client.post("/api/products", json={"sku": product["sku"], "name": "Clone"})
    assert response.status_code == 409


def test_get_product_and_404(client, product):
    assert client.get(f"/api/products/{product['id']}").json()["name"] == "Wireless Mouse"
    assert client.get("/api/products/9999").status_code == 404


def test_update_product(client, product):
    response = client.put(f"/api/products/{product['id']}", json={"unit_price": 19.5, "location": "A1-01"})
    assert response.status_code == 200
    body = response.json()
    assert body["unit_price"] == 19.5
    assert body["location"] == "A1-01"
    assert body["quantity"] == 50  # untouched


def test_delete_product(client, product):
    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get(f"/api/products/{product['id']}").status_code == 404
    assert client.delete(f"/api/products/{product['id']}").status_code == 404


def test_list_filters(client, category):
    for sku, qty in [("IN-1", 100), ("LOW-1", 3), ("OUT-1", 0)]:
        client.post("/api/products", json={"sku": sku, "name": sku, "quantity": qty, "reorder_level": 10})

    def skus(**params):
        return {p["sku"] for p in client.get("/api/products", params=params).json()}

    assert skus() == {"IN-1", "LOW-1", "OUT-1"}
    assert skus(stock_status="in_stock") == {"IN-1"}
    assert skus(stock_status="low_stock") == {"LOW-1"}
    assert skus(stock_status="out_of_stock") == {"OUT-1"}
    assert skus(q="low") == {"LOW-1"}


def test_adjust_stock_records_movement(client, product):
    response = client.post(
        f"/api/products/{product['id']}/adjust", json={"change": -45, "reason": "sale", "note": "Order #42"}
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 5
    assert response.json()["stock_status"] == "low_stock"

    movements = client.get("/api/movements", params={"product_id": product["id"]}).json()
    assert [m["reason"] for m in movements] == ["sale", "initial"]
    assert movements[0]["quantity_after"] == 5
    assert movements[0]["product_sku"] == "EL-1001"


def test_adjust_cannot_go_negative(client, product):
    response = client.post(f"/api/products/{product['id']}/adjust", json={"change": -51, "reason": "sale"})
    assert response.status_code == 409
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == 50


def test_adjust_rejects_zero_and_bad_reason(client, product):
    url = f"/api/products/{product['id']}/adjust"
    assert client.post(url, json={"change": 0, "reason": "sale"}).status_code == 422
    assert client.post(url, json={"change": 5, "reason": "magic"}).status_code == 422
