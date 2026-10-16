from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

StockStatus = Literal["in_stock", "low_stock", "out_of_stock"]
MovementReason = Literal["restock", "sale", "return", "adjustment", "damaged", "initial"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Categories ----------

class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None


class CategoryRead(ORMModel, CategoryBase):
    id: int
    created_at: datetime
    product_count: int = 0


class CategoryBrief(ORMModel):
    id: int
    name: str


# ---------- Products ----------

class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9\-_.]+$")
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    category_id: int | None = None
    reorder_level: int = Field(default=10, ge=0)
    unit_price: float = Field(default=0, ge=0)
    supplier: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=60)


class ProductCreate(ProductBase):
    quantity: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    """Partial update. Quantity is intentionally absent: stock changes go
    through POST /api/products/{id}/adjust so every change is audited."""

    sku: str | None = Field(default=None, min_length=1, max_length=40, pattern=r"^[A-Za-z0-9\-_.]+$")
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    category_id: int | None = None
    reorder_level: int | None = Field(default=None, ge=0)
    unit_price: float | None = Field(default=None, ge=0)
    supplier: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=60)


class ProductRead(ORMModel, ProductBase):
    id: int
    quantity: int
    stock_status: StockStatus
    category: CategoryBrief | None = None
    created_at: datetime
    updated_at: datetime


# ---------- Stock movements ----------

class StockAdjust(BaseModel):
    change: int = Field(description="Positive to add stock, negative to remove it")
    reason: MovementReason
    note: str | None = Field(default=None, max_length=255)


class MovementRead(ORMModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    change: int
    quantity_after: int
    reason: MovementReason
    note: str | None
    created_at: datetime


# ---------- Stats ----------

class CategoryBreakdown(BaseModel):
    category: str
    products: int
    units: int
    value: float


class InventoryStats(BaseModel):
    total_products: int
    total_units: int
    inventory_value: float
    in_stock: int
    low_stock: int
    out_of_stock: int
    categories: int
    movements_last_24h: int
    by_category: list[CategoryBreakdown]
