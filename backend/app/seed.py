"""Demo data so a fresh environment has something to show.

Runs only when SEED_DEMO_DATA=true and the products table is empty, so it is
safe to call on every start-up and from every replica.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Product, StockMovement

log = logging.getLogger(__name__)

CATEGORIES = {
    "Electronics": "Devices, peripherals and accessories",
    "Office Supplies": "Stationery and consumables",
    "Furniture": "Desks, chairs and storage",
    "Networking": "Switches, cables and wireless gear",
}

# sku, name, category, qty, reorder, price, supplier, location
PRODUCTS = [
    ("EL-1001", "Wireless Mouse", "Electronics", 142, 30, 24.99, "Logitech", "A1-03"),
    ("EL-1002", "Mechanical Keyboard", "Electronics", 18, 20, 89.00, "Keychron", "A1-04"),
    ("EL-1003", "27\" 4K Monitor", "Electronics", 9, 10, 329.00, "Dell", "A2-01"),
    ("EL-1004", "USB-C Docking Station", "Electronics", 0, 8, 149.50, "Anker", "A2-02"),
    ("OS-2001", "A4 Copy Paper (500 sheets)", "Office Supplies", 420, 100, 6.49, "Navigator", "B1-01"),
    ("OS-2002", "Gel Pens (Pack of 12)", "Office Supplies", 64, 40, 8.99, "Pilot", "B1-02"),
    ("OS-2003", "Sticky Notes 3x3", "Office Supplies", 35, 50, 4.25, "3M", "B1-03"),
    ("FU-3001", "Ergonomic Office Chair", "Furniture", 12, 5, 279.00, "Herman Miller", "C1-01"),
    ("FU-3002", "Standing Desk Frame", "Furniture", 4, 6, 399.00, "Flexispot", "C1-02"),
    ("NW-4001", "24-Port Gigabit Switch", "Networking", 7, 3, 189.00, "TP-Link", "D1-01"),
    ("NW-4002", "Cat6 Patch Cable 2m", "Networking", 310, 80, 3.20, "Cable Matters", "D1-02"),
    ("NW-4003", "Wi-Fi 6 Access Point", "Networking", 0, 4, 159.00, "Ubiquiti", "D1-03"),
]


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(func.count(Product.id))):
        return
    categories = {name: Category(name=name, description=desc) for name, desc in CATEGORIES.items()}
    db.add_all(categories.values())
    for sku, name, cat, qty, reorder, price, supplier, location in PRODUCTS:
        product = Product(
            sku=sku,
            name=name,
            category=categories[cat],
            quantity=qty,
            reorder_level=reorder,
            unit_price=price,
            supplier=supplier,
            location=location,
        )
        if qty:
            product.movements.append(StockMovement(change=qty, quantity_after=qty, reason="initial"))
        db.add(product)
    db.commit()
    log.info("Seeded %d demo products", len(PRODUCTS))
