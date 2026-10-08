from datetime import datetime

from pydantic import BaseModel, Field

from backend.app.schemas.quotation_file import (
    QuotationFileRead,
    QuotationFileType,
)

class SourceFileCandidate(BaseModel):
    relative_path: str
    name: str
    size_bytes: int
    modified_at: datetime
    suggested_type: QuotationFileType
    already_imported: bool = False


class SourceFolderScanResponse(BaseModel):
    source_folder_path: str
    items: list[SourceFileCandidate]
    total: int
    truncated: bool = False

class SourceFileImportItem(BaseModel):
    relative_path: str
    file_type: QuotationFileType
    revision: str | None = None
    notes: str | None = None


class SourceFolderImportRequest(BaseModel):
    items: list[SourceFileImportItem] = Field(
        min_length=1,
        max_length=100,
    )


class SourceFolderImportResponse(BaseModel):
    items: list[QuotationFileRead]
    imported: int
    skipped_duplicates: int