import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.api.quotation_files import (
    get_file_or_404,
    get_storage_path,
)
from backend.app.database import get_db
from backend.app.models.quotation_bom import (
    QuotationBomVersion,
)
from backend.app.models.quotation_request import (
    QuotationRequest,
)
from backend.app.schemas.quotation_bom import (
    QuotationBomComparisonResponse,
    QuotationBomVersionListResponse,
    QuotationBomVersionRead,
)
from backend.app.services.bom_analysis import (
    BomAnalysisError,
)
from backend.app.services.bom_versioning import (
    BomVersioningError,
    confirm_bom_version,
    get_bom_version,
)
from backend.app.schemas.quotation_artifact import (
    QuotationArtifactRead,
)
from backend.app.services.bom_export import (
    generate_normalized_bom_artifact,
)
from backend.app.services.bom_comparison import (
    BomComparisonError,
    compare_bom_versions,
)
from backend.app.schemas.bom_analysis import (
    BomManualMappingRequest,
)

router = APIRouter(tags=["quotation BOMs"])

DatabaseSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/quotation-files/{file_id}/confirm-bom",
    response_model=QuotationBomVersionRead,
    status_code=status.HTTP_201_CREATED,
)
def confirm_quotation_bom(
    file_id: uuid.UUID,
    database: DatabaseSession,
    payload: BomManualMappingRequest | None = None,
) -> QuotationBomVersion:
    quotation_file = get_file_or_404(
        file_id,
        database,
    )

    if quotation_file.file_type != "bom":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "O ficheiro indicado não está classificado "
                "como BOM."
            ),
        )

    file_path = get_storage_path(quotation_file)

    try:
        return confirm_bom_version(
            quotation_file,
            file_path,
            database,
            manual_mapping=payload,
        )
    except (BomAnalysisError, BomVersioningError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error


@router.get(
    "/quotation-requests/{quotation_request_id}/bom-versions",
    response_model=QuotationBomVersionListResponse,
)
def list_quotation_bom_versions(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationBomVersionListResponse:
    quotation_request = database.get(
        QuotationRequest,
        quotation_request_id,
    )

    if quotation_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de cotação não encontrado.",
        )

    filters = [
        QuotationBomVersion.quotation_request_id
        == quotation_request_id
    ]

    total = database.scalar(
        select(func.count())
        .select_from(QuotationBomVersion)
        .where(*filters)
    ) or 0

    versions = list(
        database.scalars(
            select(QuotationBomVersion)
            .where(*filters)
            .order_by(
                QuotationBomVersion.version_number.desc()
            )
        ).all()
    )

    return QuotationBomVersionListResponse(
        items=versions,
        total=total,
    )


@router.get(
    "/quotation-bom-versions/{bom_version_id}",
    response_model=QuotationBomVersionRead,
)
def get_quotation_bom_version(
    bom_version_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationBomVersion:
    bom_version = get_bom_version(
        bom_version_id,
        database,
    )

    if bom_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versão da BOM não encontrada.",
        )

    return bom_version

@router.post(
    "/quotation-bom-versions/{bom_version_id}/generate-normalized-excel",
    response_model=QuotationArtifactRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_normalized_bom_excel(
    bom_version_id: uuid.UUID,
    database: DatabaseSession,
):
    bom_version = get_bom_version(
        bom_version_id,
        database,
    )

    if bom_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versão da BOM não encontrada.",
        )

    return generate_normalized_bom_artifact(
        bom_version,
        database,
    )

@router.get(
    (
        "/quotation-bom-versions/"
        "{current_version_id}/compare/"
        "{previous_version_id}"
    ),
    response_model=QuotationBomComparisonResponse,
)
def compare_quotation_bom_versions(
    current_version_id: uuid.UUID,
    previous_version_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationBomComparisonResponse:
    current_version = get_bom_version(
        current_version_id,
        database,
    )
    previous_version = get_bom_version(
        previous_version_id,
        database,
    )

    if current_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versão atual da BOM não encontrada.",
        )

    if previous_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versão anterior da BOM não encontrada.",
        )

    try:
        return compare_bom_versions(
            previous_version,
            current_version,
        )
    except BomComparisonError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error