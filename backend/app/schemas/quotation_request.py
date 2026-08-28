import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


QuotationStatus = Literal[
    "received",
    "in_analysis",
    "waiting_customer",
    "waiting_supplier",
    "ready",
    "sent",
    "accepted",
    "rejected",
    "cancelled",
]

PositiveQuantity = Annotated[int, Field(gt=0)]


class QuotationRequestCreate(BaseModel):
    product_id: uuid.UUID
    received_date: date = Field(default_factory=date.today)
    requested_deadline: date | None = None
    status: QuotationStatus = "received"
    customer_contact: str | None = None
    notes: str | None = None
    quantities: list[PositiveQuantity] = Field(min_length=1)

    @field_validator("quantities")
    @classmethod
    def validate_quantities(cls, quantities: list[int]) -> list[int]:
        if len(quantities) != len(set(quantities)):
            raise ValueError("As quantidades não podem estar repetidas.")

        return sorted(quantities)


class QuotationRequestUpdate(BaseModel):
    product_id: uuid.UUID | None = None
    received_date: date | None = None
    requested_deadline: date | None = None
    status: QuotationStatus | None = None
    customer_contact: str | None = None
    notes: str | None = None
    quantities: list[PositiveQuantity] | None = Field(
        default=None,
        min_length=1,
    )

    @field_validator("quantities")
    @classmethod
    def validate_quantities(
        cls,
        quantities: list[int] | None,
    ) -> list[int] | None:
        if quantities is None:
            return None

        if len(quantities) != len(set(quantities)):
            raise ValueError("As quantidades não podem estar repetidas.")

        return sorted(quantities)


class QuotationQuantityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quantity: int
    created_at: datetime


class QuotationRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    received_date: date
    requested_deadline: date | None
    status: QuotationStatus
    customer_contact: str | None
    notes: str | None
    quantities: list[QuotationQuantityRead]
    created_at: datetime
    updated_at: datetime


class QuotationRequestListResponse(BaseModel):
    items: list[QuotationRequestRead]
    total: int
    received: int
    in_progress: int
    sent: int
    closed: int
    offset: int
    limit: int