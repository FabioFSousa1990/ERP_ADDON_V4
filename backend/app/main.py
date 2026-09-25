from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.customers import router as customers_router
from backend.app.core.config import settings
from backend.app.database import check_database
from backend.app.api.products import router as products_router
from backend.app.api.quotation_requests import (
    router as quotation_requests_router,
)
from backend.app.api.quotation_files import (
    router as quotation_files_router,
)
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customers_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(
    quotation_requests_router,
    prefix="/api/v1",
)
app.include_router(
    quotation_files_router,
    prefix="/api/v1",
)

@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    check_database()

    return {
        "status": "healthy",
        "database": "sqlite",
    }