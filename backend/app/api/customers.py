import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.customer import Customer
from backend.app.schemas.customer import (
    CustomerCreate,
    CustomerListResponse,
    CustomerRead,
    CustomerUpdate,
)


router = APIRouter(prefix="/customers", tags=["customers"])

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_customer_or_404(
    customer_id: uuid.UUID,
    database: Session,
) -> Customer:
    customer = database.get(Customer, customer_id)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado.",
        )

    return customer


@router.get("", response_model=CustomerListResponse)
def list_customers(
    database: DatabaseSession,
    search: str | None = None,
    include_inactive: bool = False,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> CustomerListResponse:
    search_filters = []

    if search and search.strip():
        pattern = f"%{search.strip()}%"

        search_filters.append(
            or_(
                Customer.name.ilike(pattern),
                Customer.erp_code.ilike(pattern),
                Customer.vat_number.ilike(pattern),
            )
        )

    list_filters = list(search_filters)

    if not include_inactive:
        list_filters.append(Customer.is_active.is_(True))

    total = database.scalar(
        select(func.count())
        .select_from(Customer)
        .where(*list_filters)
    ) or 0

    associated = database.scalar(
        select(func.count())
        .select_from(Customer)
        .where(
            *search_filters,
            Customer.is_active.is_(True),
            Customer.erp_code.is_not(None),
            Customer.erp_code != "",
        )
    ) or 0

    pending_association = database.scalar(
        select(func.count())
        .select_from(Customer)
        .where(
            *search_filters,
            Customer.is_active.is_(True),
            or_(
                Customer.erp_code.is_(None),
                Customer.erp_code == "",
            ),
        )
    ) or 0

    inactive = database.scalar(
        select(func.count())
        .select_from(Customer)
        .where(
            *search_filters,
            Customer.is_active.is_(False),
        )
    ) or 0

    customers = list(
        database.scalars(
            select(Customer)
            .where(*list_filters)
            .order_by(Customer.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return CustomerListResponse(
        items=customers,
        total=total,
        associated=associated,
        pending_association=pending_association,
        inactive=inactive,
        offset=offset,
        limit=limit,
    )

@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: uuid.UUID,
    database: DatabaseSession,
) -> Customer:
    return get_customer_or_404(customer_id, database)


@router.post(
    "",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    payload: CustomerCreate,
    database: DatabaseSession,
) -> Customer:
    customer = Customer(**payload.model_dump())

    database.add(customer)
    database.commit()
    database.refresh(customer)

    return customer


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    database: DatabaseSession,
) -> Customer:
    customer = get_customer_or_404(customer_id, database)
    changes = payload.model_dump(exclude_unset=True)

    optional_text_fields = {
        "erp_code",
        "vat_number",
        "email",
        "phone",
        "notes",
    }

    for field, value in changes.items():
        if field in optional_text_fields and isinstance(value, str):
            value = value.strip() or None

        setattr(customer, field, value)

    database.commit()
    database.refresh(customer)

    return customer


@router.delete("/{customer_id}", response_model=CustomerRead)
def deactivate_customer(
    customer_id: uuid.UUID,
    database: DatabaseSession,
) -> Customer:
    customer = get_customer_or_404(customer_id, database)
    customer.is_active = False

    database.commit()
    database.refresh(customer)

    return customer