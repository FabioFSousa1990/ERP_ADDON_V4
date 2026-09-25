import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, StringConstraints
from typing_extensions import Annotated


QuotationFileType = Literal[
    "bom",
    "gerbers",
    "pick_place",
    "assembly",
    "drawing",
    "other",
]

OptionalShortText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=100),
]


class QuotationFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_request_id: uuid.UUID
    file_type: QuotationFileType
    original_name: str
    media_type: str | None
    size_bytes: int
    sha256: str
    revision: str | None
    notes: str | None
    uploaded_at: datetime


class QuotationFileUpdate(BaseModel):
    file_type: QuotationFileType | None = None
    revision: OptionalShortText | None = None
    notes: str | None = None


class QuotationFileListResponse(BaseModel):
    items: list[QuotationFileRead]
    total: int