import uuid
from typing import Any

from pydantic import BaseModel


class GerberAnalysisResponse(BaseModel):
    quotation_file_id: uuid.UUID
    original_name: str
    metadata: dict[str, Any]