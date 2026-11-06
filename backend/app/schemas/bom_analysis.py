import uuid
from typing import Literal

from pydantic import BaseModel, Field


class BomAnalysisLine(BaseModel):
    row_number: int
    reference_designator: str | None
    designators: list[str]
    declared_quantity: int | None
    calculated_quantity: int
    name: str | None
    description: str | None
    do_not_place: bool
    footprint: str | None
    manufacturer_reference: str | None
    datasheet: str | None
    is_valid: bool
    warnings: list[str]


class BomAnalysisResponse(BaseModel):
    status: Literal["success"] = "success"
    quotation_file_id: uuid.UUID
    original_name: str
    sheet_name: str
    header_row: int
    line_count: int
    placement_count: int
    mounted_placement_count: int
    dnp_placement_count: int
    dnp_line_count: int
    valid_line_count: int
    warning_count: int
    items: list[BomAnalysisLine]

class BomColumnMapping(BaseModel):
    reference_designator: int = Field(ge=1)
    quantity: int | None = Field(default=None, ge=1)
    name: int | None = Field(default=None, ge=1)
    description: int | None = Field(default=None, ge=1)
    dnp: int | None = Field(default=None, ge=1)
    footprint: int | None = Field(default=None, ge=1)
    manufacturer_reference: int | None = Field(
        default=None,
        ge=1,
    )
    datasheet: int | None = Field(default=None, ge=1)


class BomManualMappingRequest(BaseModel):
    sheet_name: str
    header_row: int = Field(ge=1)
    mapping: BomColumnMapping


class BomColumnOption(BaseModel):
    column_index: int
    header: str
    sample_values: list[str]


class BomMappingRequiredResponse(BaseModel):
    status: Literal["mapping_required"] = "mapping_required"
    quotation_file_id: uuid.UUID
    original_name: str
    sheet_name: str
    header_row: int
    columns: list[BomColumnOption]