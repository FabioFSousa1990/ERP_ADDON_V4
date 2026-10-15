import hashlib
import json
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.quotation_artifact import QuotationArtifact
from backend.app.models.quotation_file import QuotationFile
from backend.app.models.quotation_request import QuotationRequest


def generate_validation_report(
    quotation_request: QuotationRequest,
    database: Session,
) -> QuotationArtifact:
    source_files = list(
        database.scalars(
            select(QuotationFile)
            .where(
                QuotationFile.quotation_request_id
                == quotation_request.id
            )
            .order_by(QuotationFile.original_name)
        ).all()
    )

    report = {
        "quotation_request_id": str(quotation_request.id),
        "generator": "quotation-validation-report",
        "generation_version": "1",
        "file_count": len(source_files),
        "files": [
            {
                "id": str(source_file.id),
                "type": source_file.file_type,
                "name": source_file.original_name,
                "size_bytes": source_file.size_bytes,
                "sha256": source_file.sha256,
            }
            for source_file in source_files
        ],
    }

    content = json.dumps(
        report,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ).encode("utf-8")

    artifact_hash = hashlib.sha256(content).hexdigest()

    existing_artifact = database.scalar(
        select(QuotationArtifact).where(
            QuotationArtifact.quotation_request_id
            == quotation_request.id,
            QuotationArtifact.artifact_type
            == "validation_report",
            QuotationArtifact.sha256 == artifact_hash,
        )
    )

    if existing_artifact is not None:
        return existing_artifact

    stored_name = f"{uuid.uuid4().hex}.json"
    relative_directory = (
        Path("quotation_requests")
        / str(quotation_request.id)
        / "artifacts"
    )
    relative_path = relative_directory / stored_name

    storage_root = Path(settings.storage_root).resolve()
    target_directory = storage_root / relative_directory
    target_directory.mkdir(parents=True, exist_ok=True)

    target_path = target_directory / stored_name
    temporary_path = target_directory / f"{stored_name}.generating"

    try:
        temporary_path.write_bytes(content)
        temporary_path.replace(target_path)

        artifact = QuotationArtifact(
            quotation_request_id=quotation_request.id,
            source_file_id=None,
            artifact_type="validation_report",
            display_name="Relatório de validação.json",
            stored_name=stored_name,
            relative_path=relative_path.as_posix(),
            media_type="application/json",
            size_bytes=len(content),
            sha256=artifact_hash,
            generator="quotation-validation-report",
            generation_version="1",
        )

        database.add(artifact)
        database.commit()
        database.refresh(artifact)

        return artifact
    except Exception:
        database.rollback()

        if temporary_path.exists():
            temporary_path.unlink()

        if target_path.exists():
            target_path.unlink()

        raise