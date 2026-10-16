import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import database
from app.config import get_settings
from app.routers import categories, products, stats
from app.seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("stockpilot")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.seed_demo_data:
        try:
            with database.SessionLocal() as db:
                seed_demo_data(db)
        except IntegrityError:
            log.info("Demo data already seeded by another replica")
        except SQLAlchemyError:
            log.exception("Seeding demo data failed; continuing without it")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Inventory management API — products, categories, stock movements and KPIs.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(categories.router)
app.include_router(stats.router)

# /metrics for Prometheus. Probe and scrape endpoints are excluded so they
# don't drown out real traffic in the dashboards.
Instrumentator(excluded_handlers=["/metrics", "/health", "/ready"]).instrument(app).expose(
    app, include_in_schema=False
)


@app.get("/", tags=["meta"])
def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    """Liveness: the process is up and serving HTTP. Deliberately does not touch
    the database, so a DB outage doesn't make Kubernetes restart healthy pods."""
    return {"status": "UP"}


@app.get("/ready", tags=["meta"])
def ready():
    """Readiness: can this pod serve traffic right now? Checks the database."""
    try:
        with database.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        log.warning("Readiness check failed: %s", exc.__class__.__name__)
        return JSONResponse(status_code=503, content={"status": "NOT_READY", "database": "unreachable"})
    return {"status": "READY", "database": "ok"}
