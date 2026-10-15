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
from backend.app.services.gerber_analysis import (
    render_gerber_previews,
)

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

def generate_gerber_preview_artifacts(
    quotation_request: QuotationRequest,
    source_file: QuotationFile,
    database: Session,
) -> list[QuotationArtifact]:
    if (
        source_file.quotation_request_id
        != quotation_request.id
    ):
        raise ValueError(
            "O ficheiro Gerber não pertence à cotação."
        )

    storage_root = Path(settings.storage_root).resolve()
    source_path = (
        storage_root / source_file.relative_path
    ).resolve()

    if storage_root not in source_path.parents:
        raise ValueError(
            "O caminho do ficheiro Gerber é inválido."
        )

    if not source_path.is_file():
        raise FileNotFoundError(
            "O pacote Gerber não foi encontrado."
        )

    previews = render_gerber_previews(source_path)

    artifact_definitions = {
        "pcb_top_preview": {
            "display_name": "PCB - vista superior.png",
            "suffix": ".png",
        },
        "pcb_bottom_preview": {
            "display_name": "PCB - vista inferior.png",
            "suffix": ".png",
        },
    }

    preview_types = set(artifact_definitions)

    previous_artifacts = list(
        database.scalars(
            select(QuotationArtifact).where(
                QuotationArtifact.quotation_request_id
                == quotation_request.id,
                QuotationArtifact.artifact_type.in_(
                    preview_types
                ),
            )
        ).all()
    )

    artifacts: list[QuotationArtifact] = []
    created_paths: list[Path] = []
    obsolete_paths: list[Path] = []

    relative_directory = (
        Path("quotation_requests")
        / str(quotation_request.id)
        / "artifacts"
    )
    target_directory = storage_root / relative_directory
    target_directory.mkdir(parents=True, exist_ok=True)

    try:
        for artifact_type, content in previews.items():
            artifact_hash = hashlib.sha256(
                content
            ).hexdigest()

            existing_artifact = database.scalar(
                select(QuotationArtifact).where(
                    QuotationArtifact.quotation_request_id
                    == quotation_request.id,
                    QuotationArtifact.source_file_id
                    == source_file.id,
                    QuotationArtifact.artifact_type
                    == artifact_type,
                    QuotationArtifact.sha256
                    == artifact_hash,
                    QuotationArtifact.generator
                    == "pygerber",
                    QuotationArtifact.generation_version
                    == "2",
                )
            )

            if existing_artifact is not None:
                artifacts.append(existing_artifact)
                continue

            definition = artifact_definitions[
                artifact_type
            ]
            stored_name = (
                f"{uuid.uuid4().hex}"
                f"{definition['suffix']}"
            )
            relative_path = (
                relative_directory / stored_name
            )
            target_path = target_directory / stored_name
            temporary_path = (
                target_directory
                / f"{stored_name}.generating"
            )

            temporary_path.write_bytes(content)
            temporary_path.replace(target_path)
            created_paths.append(target_path)

            artifact = QuotationArtifact(
                quotation_request_id=quotation_request.id,
                source_file_id=source_file.id,
                artifact_type=artifact_type,
                display_name=definition["display_name"],
                stored_name=stored_name,
                relative_path=relative_path.as_posix(),
                media_type="image/png",
                size_bytes=len(content),
                sha256=artifact_hash,
                generator="pygerber",
                generation_version="2",
            )

            database.add(artifact)
            artifacts.append(artifact)

        for previous_artifact in previous_artifacts:
            if previous_artifact in artifacts:
                continue

            previous_path = (
                storage_root
                / previous_artifact.relative_path
            ).resolve()

            if storage_root in previous_path.parents:
                obsolete_paths.append(previous_path)

            database.delete(previous_artifact)

        database.commit()

        for artifact in artifacts:
            database.refresh(artifact)

        for obsolete_path in obsolete_paths:
            try:
                if obsolete_path.is_file():
                    obsolete_path.unlink()
            except OSError:
                pass

        return artifacts
    except Exception:
        database.rollback()

        for created_path in created_paths:
            if created_path.exists():
                created_path.unlink()

        raise