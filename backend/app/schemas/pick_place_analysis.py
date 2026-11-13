import uuid
from typing import Literal

from pydantic import BaseModel, Field


PickPlaceSide = Literal[
    "top",
    "bottom",
    "unknown",
]


class PickPlaceAnalysisLine(BaseModel):
    row_number: int
    designator: str
    value: str | None
    footprint: str | None
    part_number: str | None
    description: str | None

    x_raw: float
    y_raw: float
    x_mm: float
    y_mm: float

    rotation_degrees: float
    side: PickPlaceSide

    is_valid: bool
    warnings: list[str]

    additional_fields: dict[str, str | None] = Field(
        default_factory=dict
    )


class PickPlaceBounds(BaseModel):
    minimum_x_mm: float
    maximum_x_mm: float
    minimum_y_mm: float
    maximum_y_mm: float
    width_mm: float
    height_mm: float


class PickPlaceAnalysisResponse(BaseModel):
    quotation_file_id: uuid.UUID
    original_name: str
    source_format: str
    coordinate_unit: Literal[
        "mil",
        "mm",
        "inch",
        "unknown",
    ]
    side: Literal[
        "top",
        "bottom",
        "mixed",
        "unknown",
    ]

    placement_count: int
    valid_placement_count: int
    warning_count: int

    bounds: PickPlaceBounds
    items: list[PickPlaceAnalysisLine]


class PickPlaceSetRequest(BaseModel):
    file_ids: list[uuid.UUID] = Field(
        min_length=1,
    )


class PickPlaceFileSummary(BaseModel):
    quotation_file_id: uuid.UUID
    original_name: str
    source_format: str
    coordinate_unit: Literal[
        "mil",
        "mm",
        "inch",
        "unknown",
    ]
    side: Literal[
        "top",
        "bottom",
        "mixed",
        "unknown",
    ]
    placement_count: int
    valid_placement_count: int
    warning_count: int


class PickPlaceSetAnalysisResponse(BaseModel):
    quotation_request_id: uuid.UUID

    source_format: str
    coordinate_unit: Literal[
        "mil",
        "mm",
        "inch",
        "mixed",
        "unknown",
    ]
    side: Literal[
        "top",
        "bottom",
        "mixed",
        "unknown",
    ]

    files: list[PickPlaceFileSummary]

    placement_count: int
    valid_placement_count: int
    warning_count: int

    bounds: PickPlaceBounds
    items: list[PickPlaceAnalysisLine]