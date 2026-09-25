import hashlib
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database import get_db
from backend.app.models.quotation_file import QuotationFile
from backend.app.models.quotation_request import QuotationRequest
from backend.app.schemas.quotation_file import (
    QuotationFileListResponse,
    QuotationFileRead,
    QuotationFileType,
    QuotationFileUpdate,
)


router = APIRouter(tags=["quotation files"])

DatabaseSession = Annotated[Session, Depends(get_db)]

MAX_FILE_SIZE = 100 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024


def get_quotation_or_404(
    quotation_request_id: uuid.UUID,
    database: Session,
) -> QuotationRequest:
    quotation = database.get(
        QuotationRequest,
        quotation_request_id,
    )

    if quotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de cotação não encontrado.",
        )

    return quotation


def get_file_or_404(
    file_id: uuid.UUID,
    database: Session,
) -> QuotationFile:
    quotation_file = database.get(QuotationFile, file_id)

    if quotation_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    return quotation_file


def normalize_original_name(filename: str | None) -> str:
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    original_name = Path(filename).name.strip()

    if not original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    return original_name[:500]


def get_storage_path(quotation_file: QuotationFile) -> Path:
    storage_root = Path(settings.storage_root).resolve()
    file_path = (
        storage_root / quotation_file.relative_path
    ).resolve()

    if storage_root not in file_path.parents:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Caminho de armazenamento inválido.",
        )

    return file_path


@router.get(
    "/quotation-requests/{quotation_request_id}/files",
    response_model=QuotationFileListResponse,
)
def list_quotation_files(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
    file_type: QuotationFileType | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> QuotationFileListResponse:
    get_quotation_or_404(quotation_request_id, database)

    filters = [
        QuotationFile.quotation_request_id
        == quotation_request_id
    ]

    if file_type is not None:
        filters.append(QuotationFile.file_type == file_type)

    total = database.scalar(
        select(func.count())
        .select_from(QuotationFile)
        .where(*filters)
    ) or 0

    files = list(
        database.scalars(
            select(QuotationFile)
            .where(*filters)
            .order_by(QuotationFile.uploaded_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return QuotationFileListResponse(
        items=files,
        total=total,
    )


@router.post(
    "/quotation-requests/{quotation_request_id}/files",
    response_model=QuotationFileRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_quotation_file(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
    file_type: Annotated[QuotationFileType, Form()],
    file: Annotated[UploadFile, File()],
    revision: Annotated[str | None, Form()] = None,
    notes: Annotated[str | None, Form()] = None,
) -> QuotationFile:
    get_quotation_or_404(quotation_request_id, database)

    original_name = normalize_original_name(file.filename)
    suffix = Path(original_name).suffix.lower()[:20]
    stored_name = f"{uuid.uuid4().hex}{suffix}"

    relative_directory = (
        Path("quotation_requests")
        / str(quotation_request_id)
    )
    relative_path = relative_directory / stored_name

    storage_root = Path(settings.storage_root).resolve()
    target_directory = storage_root / relative_directory
    target_directory.mkdir(parents=True, exist_ok=True)

    target_path = target_directory / stored_name
    temporary_path = target_directory / f"{stored_name}.uploading"

    file_size = 0
    digest = hashlib.sha256()

    try:
        with temporary_path.open("wb") as destination:
            while chunk := file.file.read(CHUNK_SIZE):
                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail="O ficheiro excede o limite de 100 MB.",
                    )

                digest.update(chunk)
                destination.write(chunk)

        file_hash = digest.hexdigest()

        duplicate = database.scalar(
            select(QuotationFile).where(
                QuotationFile.quotation_request_id
                == quotation_request_id,
                QuotationFile.sha256 == file_hash,
            )
        )

        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Este ficheiro já está associado "
                    "ao pedido de cotação."
                ),
            )

        temporary_path.replace(target_path)

        quotation_file = QuotationFile(
            quotation_request_id=quotation_request_id,
            file_type=file_type,
            original_name=original_name,
            stored_name=stored_name,
            relative_path=relative_path.as_posix(),
            media_type=file.content_type,
            size_bytes=file_size,
            sha256=file_hash,
            revision=revision.strip() if revision else None,
            notes=notes.strip() if notes else None,
        )

        database.add(quotation_file)
        database.commit()
        database.refresh(quotation_file)

        return quotation_file
    except Exception:
        database.rollback()

        if temporary_path.exists():
            temporary_path.unlink()

        if target_path.exists():
            target_path.unlink()

        raise


@router.get(
    "/quotation-files/{file_id}/download",
    response_class=FileResponse,
)
def download_quotation_file(
    file_id: uuid.UUID,
    database: DatabaseSession,
) -> FileResponse:
    quotation_file = get_file_or_404(file_id, database)
    file_path = get_storage_path(quotation_file)

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O ficheiro físico não foi encontrado.",
        )

    return FileResponse(
        path=file_path,
        media_type=quotation_file.media_type,
        filename=quotation_file.original_name,
    )


@router.patch(
    "/quotation-files/{file_id}",
    response_model=QuotationFileRead,
)
def update_quotation_file(
    file_id: uuid.UUID,
    payload: QuotationFileUpdate,
    database: DatabaseSession,
) -> QuotationFile:
    quotation_file = get_file_or_404(file_id, database)
    changes = payload.model_dump(exclude_unset=True)

    if "file_type" in changes and changes["file_type"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O tipo do ficheiro não pode ficar vazio.",
        )

    for field in {"revision", "notes"}:
        value = changes.get(field)

        if isinstance(value, str):
            changes[field] = value.strip() or None

    for field, value in changes.items():
        setattr(quotation_file, field, value)

    database.commit()
    database.refresh(quotation_file)

    return quotation_file


@router.delete(
    "/quotation-files/{file_id}",
    response_model=QuotationFileRead,
)
def delete_quotation_file(
    file_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationFile:
    quotation_file = get_file_or_404(file_id, database)
    file_path = get_storage_path(quotation_file)

    if file_path.exists():
        file_path.unlink()

    database.delete(quotation_file)
    database.commit()

    return quotation_file