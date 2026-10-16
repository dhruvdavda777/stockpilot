"""Business metrics exposed on /metrics next to the HTTP metrics."""

from prometheus_client import Counter

STOCK_MOVEMENTS = Counter(
    "stockpilot_stock_movements_total",
    "Stock movements recorded, by reason",
    ["reason"],
)

STOCK_UNITS_MOVED = Counter(
    "stockpilot_stock_units_moved_total",
    "Absolute number of units moved in or out of stock",
    ["direction"],
)


def record_movement(reason: str, change: int) -> None:
    STOCK_MOVEMENTS.labels(reason=reason).inc()
    STOCK_UNITS_MOVED.labels(direction="in" if change > 0 else "out").inc(abs(change))
