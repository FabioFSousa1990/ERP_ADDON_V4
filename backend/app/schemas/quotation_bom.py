import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class QuotationBomLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bom_version_id: uuid.UUID
    source_row_number: int
    reference_designator: str | None
    designators: list[str]
    quantity: int
    name: str | None
    description: str | None
    do_not_place: bool
    footprint: str | None
    manufacturer_reference: str | None
    datasheet: str | None
    is_valid: bool
    warnings: list[str]
    created_at: datetime


class QuotationBomVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_request_id: uuid.UUID
    source_file_id: uuid.UUID | None
    version_number: int
    source_name: str
    source_sha256: str
    sheet_name: str
    header_row: int
    line_count: int
    placement_count: int
    mounted_placement_count: int
    dnp_placement_count: int
    warning_count: int
    is_current: bool
    confirmed_at: datetime


class QuotationBomVersionRead(
    QuotationBomVersionSummary
):
    lines: list[QuotationBomLineRead]


class QuotationBomVersionListResponse(BaseModel):
    items: list[QuotationBomVersionSummary]
    total: int