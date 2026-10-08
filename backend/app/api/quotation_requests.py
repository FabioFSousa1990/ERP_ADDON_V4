import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from backend.app.database import get_db
from backend.app.models.customer import Customer
from backend.app.models.product import Product
from backend.app.models.quotation_quantity import QuotationQuantity
from backend.app.models.quotation_request import QuotationRequest
from backend.app.schemas.quotation_request import (
    QuotationRequestCreate,
    QuotationRequestListResponse,
    QuotationRequestRead,
    QuotationRequestUpdate,
)


router = APIRouter(
    prefix="/quotation-requests",
    tags=["quotation requests"],
)

DatabaseSession = Annotated[Session, Depends(get_db)]

IN_PROGRESS_STATUSES = {
    "in_analysis",
    "waiting_customer",
    "waiting_supplier",
    "ready",
}

CLOSED_STATUSES = {
    "accepted",
    "rejected",
    "cancelled",
}


def get_quotation_request_or_404(
    quotation_request_id: uuid.UUID,
    database: Session,
) -> QuotationRequest:
    quotation_request = database.scalar(
        select(QuotationRequest)
        .options(selectinload(QuotationRequest.quantities))
        .where(QuotationRequest.id == quotation_request_id)
    )

    if quotation_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de cotação não encontrado.",
        )

    return quotation_request


def validate_product(
    product_id: uuid.UUID,
    database: Session,
) -> Product:
    product = database.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O produto indicado não existe.",
        )

    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Não é possível criar ou associar um pedido "
                "a um produto inativo."
            ),
        )

    return product


def normalize_optional_fields(changes: dict) -> dict:
    for field in {
        "customer_contact",
        "notes",
        "source_folder_path",
    }:
        value = changes.get(field)

        if isinstance(value, str):
            changes[field] = value.strip() or None

    return changes


@router.get("", response_model=QuotationRequestListResponse)
def list_quotation_requests(
    database: DatabaseSession,
    search: str | None = None,
    product_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    request_status: str | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> QuotationRequestListResponse:
    search_filters = []

    if search and search.strip():
        pattern = f"%{search.strip()}%"

        search_filters.append(
            or_(
                Product.name.ilike(pattern),
                Product.customer_reference.ilike(pattern),
                Product.erp_code.ilike(pattern),
                Customer.name.ilike(pattern),
                QuotationRequest.customer_contact.ilike(pattern),
                QuotationRequest.notes.ilike(pattern),
            )
        )

    if product_id is not None:
        search_filters.append(
            QuotationRequest.product_id == product_id
        )

    if customer_id is not None:
        search_filters.append(
            Product.customer_id == customer_id
        )

    list_filters = list(search_filters)

    if request_status:
        list_filters.append(
            QuotationRequest.status == request_status.strip()
        )

    base_count = (
        select(func.count())
        .select_from(QuotationRequest)
        .join(Product)
        .join(Customer)
    )

    total = database.scalar(
        base_count.where(*list_filters)
    ) or 0

    received = database.scalar(
        base_count.where(
            *search_filters,
            QuotationRequest.status == "received",
        )
    ) or 0

    in_progress = database.scalar(
        base_count.where(
            *search_filters,
            QuotationRequest.status.in_(IN_PROGRESS_STATUSES),
        )
    ) or 0

    sent = database.scalar(
        base_count.where(
            *search_filters,
            QuotationRequest.status == "sent",
        )
    ) or 0

    closed = database.scalar(
        base_count.where(
            *search_filters,
            QuotationRequest.status.in_(CLOSED_STATUSES),
        )
    ) or 0

    quotation_requests = list(
        database.scalars(
            select(QuotationRequest)
            .join(Product)
            .join(Customer)
            .options(selectinload(QuotationRequest.quantities))
            .where(*list_filters)
            .order_by(
                QuotationRequest.received_date.desc(),
                QuotationRequest.created_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return QuotationRequestListResponse(
        items=quotation_requests,
        total=total,
        received=received,
        in_progress=in_progress,
        sent=sent,
        closed=closed,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{quotation_request_id}",
    response_model=QuotationRequestRead,
)
def get_quotation_request(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationRequest:
    return get_quotation_request_or_404(
        quotation_request_id,
        database,
    )


@router.post(
    "",
    response_model=QuotationRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_quotation_request(
    payload: QuotationRequestCreate,
    database: DatabaseSession,
) -> QuotationRequest:
    validate_product(payload.product_id, database)

    values = normalize_optional_fields(
        payload.model_dump(exclude={"quantities"})
    )

    quotation_request = QuotationRequest(**values)

    quotation_request.quantities = [
        QuotationQuantity(quantity=quantity)
        for quantity in payload.quantities
    ]

    database.add(quotation_request)
    database.commit()

    return get_quotation_request_or_404(
        quotation_request.id,
        database,
    )


@router.patch(
    "/{quotation_request_id}",
    response_model=QuotationRequestRead,
)
def update_quotation_request(
    quotation_request_id: uuid.UUID,
    payload: QuotationRequestUpdate,
    database: DatabaseSession,
) -> QuotationRequest:
    quotation_request = get_quotation_request_or_404(
        quotation_request_id,
        database,
    )

    changes = normalize_optional_fields(
        payload.model_dump(exclude_unset=True)
    )

    quantities = changes.pop("quantities", None)

    required_fields = {
        "product_id",
        "received_date",
        "status",
    }

    for field in required_fields:
        if field in changes and changes[field] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O campo {field} não pode ficar vazio.",
            )

    if "product_id" in changes:
        validate_product(changes["product_id"], database)

    for field, value in changes.items():
        setattr(quotation_request, field, value)

    if quantities is not None:
        quotation_request.quantities.clear()
        database.flush()

        quotation_request.quantities.extend(
            QuotationQuantity(quantity=quantity)
            for quantity in quantities
        )

    database.commit()

    return get_quotation_request_or_404(
        quotation_request.id,
        database,
    )