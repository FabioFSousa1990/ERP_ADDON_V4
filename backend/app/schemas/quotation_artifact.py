import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


QuotationArtifactType = Literal[
    "pcb_top_preview",
    "pcb_bottom_preview",
    "assembly_top_preview",
    "assembly_bottom_preview",
    "normalized_bom",
    "validation_report",
]


class QuotationArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_request_id: uuid.UUID
    source_file_id: uuid.UUID | None
    artifact_type: QuotationArtifactType
    display_name: str
    media_type: str | None
    size_bytes: int
    sha256: str
    generator: str
    generation_version: str
    created_at: datetime


class QuotationArtifactListResponse(BaseModel):
    items: list[QuotationArtifactRead]
    total: int