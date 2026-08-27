import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints


CustomerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]


class CustomerCreate(BaseModel):
    name: CustomerName
    erp_code: str | None = None
    vat_number: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: CustomerName | None = None
    erp_code: str | None = None
    vat_number: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    erp_code: str | None
    vat_number: str | None
    email: EmailStr | None
    phone: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerRead]
    total: int
    associated: int
    pending_association: int
    inactive: int
    offset: int
    limit: int