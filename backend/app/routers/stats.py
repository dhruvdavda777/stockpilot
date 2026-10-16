from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Product, StockMovement
from app.schemas import CategoryBreakdown, InventoryStats

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=InventoryStats)
def inventory_stats(db: Session = Depends(get_db)):
    value = Product.quantity * Product.unit_price
    totals = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum(Product.quantity), 0),
            func.coalesce(func.sum(value), 0),
            func.coalesce(func.sum(case((Product.quantity > Product.reorder_level, 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(((Product.quantity > 0) & (Product.quantity <= Product.reorder_level), 1), else_=0)
                ),
                0,
            ),
            func.coalesce(func.sum(case((Product.quantity <= 0, 1), else_=0)), 0),
        )
    ).one()

    category_name = func.coalesce(Category.name, "Uncategorised")
    breakdown = db.execute(
        select(
            category_name,
            func.count(Product.id),
            func.coalesce(func.sum(Product.quantity), 0),
            func.coalesce(func.sum(value), 0),
        )
        .select_from(Product)
        .outerjoin(Category, Category.id == Product.category_id)
        .group_by(category_name)
        .order_by(func.coalesce(func.sum(value), 0).desc())
    ).all()

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = db.scalar(select(func.count(StockMovement.id)).where(StockMovement.created_at >= since)) or 0

    return InventoryStats(
        total_products=totals[0],
        total_units=int(totals[1]),
        inventory_value=round(float(totals[2]), 2),
        in_stock=int(totals[3]),
        low_stock=int(totals[4]),
        out_of_stock=int(totals[5]),
        categories=db.scalar(select(func.count(Category.id))) or 0,
        movements_last_24h=recent,
        by_category=[
            CategoryBreakdown(category=name, products=n, units=int(units), value=round(float(v), 2))
            for name, n, units, v in breakdown
        ],
    )
