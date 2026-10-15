import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database import get_db
from backend.app.models.quotation_artifact import QuotationArtifact
from backend.app.models.quotation_request import QuotationRequest
from backend.app.schemas.quotation_artifact import (
    QuotationArtifactListResponse,
    QuotationArtifactRead,
    QuotationArtifactType,
)
from backend.app.services.artifact_generation import (
    generate_validation_report,
)

router = APIRouter(tags=["quotation artifacts"])

DatabaseSession = Annotated[Session, Depends(get_db)]


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


def get_artifact_or_404(
    artifact_id: uuid.UUID,
    database: Session,
) -> QuotationArtifact:
    artifact = database.get(QuotationArtifact, artifact_id)

    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artefacto não encontrado.",
        )

    return artifact


def get_artifact_storage_path(
    artifact: QuotationArtifact,
) -> Path:
    storage_root = Path(settings.storage_root).resolve()
    artifact_path = (
        storage_root / artifact.relative_path
    ).resolve()

    if storage_root not in artifact_path.parents:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Caminho de armazenamento inválido.",
        )

    return artifact_path


@router.get(
    "/quotation-requests/{quotation_request_id}/artifacts",
    response_model=QuotationArtifactListResponse,
)
def list_quotation_artifacts(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
    artifact_type: QuotationArtifactType | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> QuotationArtifactListResponse:
    get_quotation_or_404(quotation_request_id, database)

    filters = [
        QuotationArtifact.quotation_request_id
        == quotation_request_id
    ]

    if artifact_type is not None:
        filters.append(
            QuotationArtifact.artifact_type == artifact_type
        )

    total = database.scalar(
        select(func.count())
        .select_from(QuotationArtifact)
        .where(*filters)
    ) or 0

    artifacts = list(
        database.scalars(
            select(QuotationArtifact)
            .where(*filters)
            .order_by(QuotationArtifact.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return QuotationArtifactListResponse(
        items=artifacts,
        total=total,
    )


@router.post(
    "/quotation-requests/{quotation_request_id}/artifacts/"
    "generate-validation-report",
    response_model=QuotationArtifactRead,
)
def create_validation_report(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationArtifact:
    quotation_request = get_quotation_or_404(
        quotation_request_id,
        database,
    )

    return generate_validation_report(
        quotation_request,
        database,
    )

@router.get(
    "/quotation-artifacts/{artifact_id}/download",
    response_class=FileResponse,
)
def download_quotation_artifact(
    artifact_id: uuid.UUID,
    database: DatabaseSession,
) -> FileResponse:
    artifact = get_artifact_or_404(artifact_id, database)
    artifact_path = get_artifact_storage_path(artifact)

    if not artifact_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O ficheiro gerado não foi encontrado.",
        )

    return FileResponse(
        path=artifact_path,
        media_type=artifact.media_type,
        filename=artifact.display_name,
    )


@router.delete(
    "/quotation-artifacts/{artifact_id}",
    response_model=QuotationArtifactRead,
)
def delete_quotation_artifact(
    artifact_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationArtifact:
    artifact = get_artifact_or_404(
        artifact_id,
        database,
    )
    artifact_path = get_artifact_storage_path(artifact)

    if artifact_path.exists():
        artifact_path.unlink()

    database.delete(artifact)
    database.commit()

    return artifact