from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.metrics import record_movement
from app.models import Category, Product, StockMovement
from app.schemas import (
    MovementRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    StockAdjust,
    StockStatus,
)

router = APIRouter(prefix="/api", tags=["products"])


def _get_or_404(db: Session, product_id: int, *, lock: bool = False) -> Product:
    stmt = select(Product).options(selectinload(Product.category)).where(Product.id == product_id)
    if lock:
        stmt = stmt.with_for_update()
    product = db.scalars(stmt).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _check_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status_code=422, detail=f"Category {category_id} does not exist")


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A product with this SKU already exists")


def _movement_read(movement: StockMovement) -> MovementRead:
    return MovementRead(
        id=movement.id,
        product_id=movement.product_id,
        product_name=movement.product.name,
        product_sku=movement.product.sku,
        change=movement.change,
        quantity_after=movement.quantity_after,
        reason=movement.reason,
        note=movement.note,
        created_at=movement.created_at,
    )


@router.get("/products", response_model=list[ProductRead])
def list_products(
    db: Session = Depends(get_db),
    q: Annotated[str | None, Query(description="Search name, SKU or supplier")] = None,
    category_id: int | None = None,
    stock_status: StockStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    stmt = select(Product).options(selectinload(Product.category))
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Product.name.ilike(pattern), Product.sku.ilike(pattern), Product.supplier.ilike(pattern))
        )
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if stock_status == "out_of_stock":
        stmt = stmt.where(Product.quantity <= 0)
    elif stock_status == "low_stock":
        stmt = stmt.where(Product.quantity > 0, Product.quantity <= Product.reorder_level)
    elif stock_status == "in_stock":
        stmt = stmt.where(Product.quantity > Product.reorder_level)
    stmt = stmt.order_by(Product.updated_at.desc(), Product.id.desc()).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, product_id)


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    _check_category(db, payload.category_id)
    product = Product(**payload.model_dump())
    db.add(product)
    if product.quantity > 0:
        product.movements.append(
            StockMovement(change=product.quantity, quantity_after=product.quantity, reason="initial")
        )
    _commit_or_conflict(db)
    if product.quantity > 0:
        record_movement("initial", product.quantity)
    return _get_or_404(db, product.id)


@router.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    changes = payload.model_dump(exclude_unset=True)
    if "category_id" in changes:
        _check_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(product, field, value)
    _commit_or_conflict(db)
    db.expire(product)
    return _get_or_404(db, product_id)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/products/{product_id}/adjust", response_model=ProductRead)
def adjust_stock(product_id: int, payload: StockAdjust, db: Session = Depends(get_db)):
    """Add or remove stock. Every change is written to the movement log."""
    if payload.change == 0:
        raise HTTPException(status_code=422, detail="change must not be zero")
    product = _get_or_404(db, product_id, lock=True)  # row lock avoids lost updates
    new_quantity = product.quantity + payload.change
    if new_quantity < 0:
        raise HTTPException(
            status_code=409,
            detail=f"Insufficient stock: {product.quantity} on hand, tried to remove {-payload.change}",
        )
    product.quantity = new_quantity
    db.add(
        StockMovement(
            product_id=product.id,
            change=payload.change,
            quantity_after=new_quantity,
            reason=payload.reason,
            note=payload.note,
        )
    )
    db.commit()
    record_movement(payload.reason, payload.change)
    db.expire(product)
    return _get_or_404(db, product_id)


@router.get("/movements", response_model=list[MovementRead], tags=["movements"])
def list_movements(
    db: Session = Depends(get_db),
    product_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
):
    stmt = select(StockMovement).options(selectinload(StockMovement.product))
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    stmt = stmt.order_by(StockMovement.created_at.desc(), StockMovement.id.desc()).limit(limit)
    return [_movement_read(m) for m in db.scalars(stmt).all()]
