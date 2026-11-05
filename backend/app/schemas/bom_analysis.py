import uuid

from pydantic import BaseModel


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