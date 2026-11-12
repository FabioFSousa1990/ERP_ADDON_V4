import uuid
from typing import Literal

from pydantic import BaseModel


PickPlaceComparisonStatus = Literal[
    "exact_match",
    "probable_match",
    "value_mismatch",
    "only_in_bom",
    "only_in_pick_place",
    "dnp_in_pick_place",
]


class PickPlaceComparisonItem(BaseModel):
    status: PickPlaceComparisonStatus

    bom_designator: str | None
    pick_place_designator: str | None

    bom_value: str | None
    pick_place_value: str | None

    bom_footprint: str | None
    pick_place_footprint: str | None

    do_not_place: bool

    x_mm: float | None
    y_mm: float | None
    rotation_degrees: float | None
    side: Literal[
        "top",
        "bottom",
        "unknown",
    ] | None

    reason: str


class PickPlaceComparisonResponse(BaseModel):
    quotation_request_id: uuid.UUID
    bom_version_id: uuid.UUID
    pick_place_file_id: uuid.UUID

    bom_placement_count: int
    pick_place_placement_count: int

    exact_match_count: int
    probable_match_count: int
    value_mismatch_count: int
    only_in_bom_count: int
    only_in_pick_place_count: int
    dnp_in_pick_place_count: int

    items: list[PickPlaceComparisonItem]