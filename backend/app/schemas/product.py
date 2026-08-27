import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


ProductName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]


class ProductCreate(BaseModel):
    customer_id: uuid.UUID
    name: ProductName
    customer_reference: str | None = None
    revision: str | None = None
    erp_code: str | None = None
    folder_path: str | None = None
    notes: str | None = None


class ProductUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    name: ProductName | None = None
    customer_reference: str | None = None
    revision: str | None = None
    erp_code: str | None = None
    folder_path: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    name: str
    customer_reference: str | None
    revision: str | None
    erp_code: str | None
    folder_path: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    items: list[ProductRead]
    total: int
    associated: int
    pending_association: int
    inactive: int
    offset: int
    limit: int