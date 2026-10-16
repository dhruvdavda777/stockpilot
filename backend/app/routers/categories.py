from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Product
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _to_read(category: Category, product_count: int) -> CategoryRead:
    data = CategoryRead.model_validate(category)
    data.product_count = product_count
    return data


def _get_or_404(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _count_products(db: Session, category_id: int) -> int:
    return db.scalar(select(func.count(Product.id)).where(Product.category_id == category_id)) or 0


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    counts = (
        select(Product.category_id, func.count(Product.id).label("n"))
        .group_by(Product.category_id)
        .subquery()
    )
    rows = db.execute(
        select(Category, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.category_id == Category.id)
        .order_by(Category.name)
    ).all()
    return [_to_read(category, n) for category, n in rows]


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    return _to_read(category, _count_products(db, category_id))


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    category = Category(**payload.model_dump())
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists")
    db.refresh(category)
    return _to_read(category, 0)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists")
    db.refresh(category)
    return _to_read(category, _count_products(db, category_id))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = _get_or_404(db, category_id)
    # Products are kept and become uncategorised (FK is ON DELETE SET NULL).
    for product in category.products:
        product.category_id = None
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
