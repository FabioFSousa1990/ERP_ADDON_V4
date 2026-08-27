import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.customer import Customer
from backend.app.models.product import Product
from backend.app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductRead,
    ProductUpdate,
)


router = APIRouter(prefix="/products", tags=["products"])

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_product_or_404(
    product_id: uuid.UUID,
    database: Session,
) -> Product:
    product = database.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
        )

    return product


def validate_customer(
    customer_id: uuid.UUID,
    database: Session,
) -> Customer:
    customer = database.get(Customer, customer_id)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O cliente indicado não existe.",
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível associar o produto a um cliente inativo.",
        )

    return customer


def normalize_optional_fields(changes: dict) -> dict:
    optional_text_fields = {
        "customer_reference",
        "revision",
        "erp_code",
        "folder_path",
        "notes",
    }

    for field in optional_text_fields:
        value = changes.get(field)

        if isinstance(value, str):
            changes[field] = value.strip() or None

    return changes


@router.get("", response_model=ProductListResponse)
def list_products(
    database: DatabaseSession,
    search: str | None = None,
    customer_id: uuid.UUID | None = None,
    include_inactive: bool = False,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ProductListResponse:
    search_filters = []

    if search and search.strip():
        pattern = f"%{search.strip()}%"

        search_filters.append(
            or_(
                Product.name.ilike(pattern),
                Product.customer_reference.ilike(pattern),
                Product.revision.ilike(pattern),
                Product.erp_code.ilike(pattern),
                Customer.name.ilike(pattern),
            )
        )

    if customer_id is not None:
        search_filters.append(Product.customer_id == customer_id)

    list_filters = list(search_filters)

    if not include_inactive:
        list_filters.append(Product.is_active.is_(True))

    total = database.scalar(
        select(func.count())
        .select_from(Product)
        .join(Customer)
        .where(*list_filters)
    ) or 0

    associated = database.scalar(
        select(func.count())
        .select_from(Product)
        .join(Customer)
        .where(
            *search_filters,
            Product.is_active.is_(True),
            Product.erp_code.is_not(None),
            Product.erp_code != "",
        )
    ) or 0

    pending_association = database.scalar(
        select(func.count())
        .select_from(Product)
        .join(Customer)
        .where(
            *search_filters,
            Product.is_active.is_(True),
            or_(
                Product.erp_code.is_(None),
                Product.erp_code == "",
            ),
        )
    ) or 0

    inactive = database.scalar(
        select(func.count())
        .select_from(Product)
        .join(Customer)
        .where(
            *search_filters,
            Product.is_active.is_(False),
        )
    ) or 0

    products = list(
        database.scalars(
            select(Product)
            .join(Customer)
            .where(*list_filters)
            .order_by(Product.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return ProductListResponse(
        items=products,
        total=total,
        associated=associated,
        pending_association=pending_association,
        inactive=inactive,
        offset=offset,
        limit=limit,
    )


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: uuid.UUID,
    database: DatabaseSession,
) -> Product:
    return get_product_or_404(product_id, database)


@router.post(
    "",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: ProductCreate,
    database: DatabaseSession,
) -> Product:
    validate_customer(payload.customer_id, database)

    values = normalize_optional_fields(payload.model_dump())
    product = Product(**values)

    database.add(product)
    database.commit()
    database.refresh(product)

    return product


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    database: DatabaseSession,
) -> Product:
    product = get_product_or_404(product_id, database)
    changes = normalize_optional_fields(
        payload.model_dump(exclude_unset=True)
    )

    if "customer_id" in changes and changes["customer_id"] is not None:
        validate_customer(changes["customer_id"], database)

    for field, value in changes.items():
        setattr(product, field, value)

    database.commit()
    database.refresh(product)

    return product


@router.delete("/{product_id}", response_model=ProductRead)
def deactivate_product(
    product_id: uuid.UUID,
    database: DatabaseSession,
) -> Product:
    product = get_product_or_404(product_id, database)
    product.is_active = False

    database.commit()
    database.refresh(product)

    return product