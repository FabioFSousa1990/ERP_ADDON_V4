import uuid
from pathlib import Path

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from backend.app.models.quotation_bom import (
    QuotationBomLine,
    QuotationBomVersion,
)
from backend.app.models.quotation_file import QuotationFile
from backend.app.services.bom_analysis import analyze_bom_file


class BomVersioningError(Exception):
    pass


def get_bom_version(
    bom_version_id: uuid.UUID,
    database: Session,
) -> QuotationBomVersion | None:
    return database.scalar(
        select(QuotationBomVersion)
        .options(
            selectinload(QuotationBomVersion.lines)
        )
        .where(
            QuotationBomVersion.id == bom_version_id
        )
    )


def confirm_bom_version(
    quotation_file: QuotationFile,
    source_path: Path,
    database: Session,
) -> QuotationBomVersion:
    analysis = analyze_bom_file(
        quotation_file,
        source_path,
    )

    if analysis.warning_count > 0:
        raise BomVersioningError(
            "A BOM contém avisos e não pode ser confirmada "
            "sem revisão."
        )

    existing_version = database.scalar(
        select(QuotationBomVersion).where(
            QuotationBomVersion.quotation_request_id
            == quotation_file.quotation_request_id,
            QuotationBomVersion.source_sha256
            == quotation_file.sha256,
        )
    )

    if existing_version is not None:
        stored_version = get_bom_version(
            existing_version.id,
            database,
        )

        if stored_version is None:
            raise BomVersioningError(
                "Não foi possível carregar a versão já existente."
            )

        return stored_version

    latest_version_number = database.scalar(
        select(
            func.max(
                QuotationBomVersion.version_number
            )
        ).where(
            QuotationBomVersion.quotation_request_id
            == quotation_file.quotation_request_id
        )
    ) or 0

    try:
        database.execute(
            update(QuotationBomVersion)
            .where(
                QuotationBomVersion.quotation_request_id
                == quotation_file.quotation_request_id,
                QuotationBomVersion.is_current.is_(True),
            )
            .values(is_current=False)
        )

        bom_version = QuotationBomVersion(
            quotation_request_id=(
                quotation_file.quotation_request_id
            ),
            source_file_id=quotation_file.id,
            version_number=latest_version_number + 1,
            source_name=quotation_file.original_name,
            source_sha256=quotation_file.sha256,
            sheet_name=analysis.sheet_name,
            header_row=analysis.header_row,
            line_count=analysis.line_count,
            placement_count=analysis.placement_count,
            mounted_placement_count=(
                analysis.mounted_placement_count
            ),
            dnp_placement_count=(
                analysis.dnp_placement_count
            ),
            warning_count=analysis.warning_count,
            is_current=True,
        )

        bom_version.lines = [
            QuotationBomLine(
                source_row_number=item.row_number,
                reference_designator=(
                    item.reference_designator
                ),
                designators=item.designators,
                quantity=item.calculated_quantity,
                name=item.name,
                description=item.description,
                do_not_place=item.do_not_place,
                footprint=item.footprint,
                manufacturer_reference=(
                    item.manufacturer_reference
                ),
                datasheet=item.datasheet,
                is_valid=item.is_valid,
                warnings=item.warnings,
            )
            for item in analysis.items
        ]

        database.add(bom_version)
        database.commit()

        stored_version = get_bom_version(
            bom_version.id,
            database,
        )

        if stored_version is None:
            raise BomVersioningError(
                "A versão da BOM foi guardada, mas não foi "
                "possível carregá-la."
            )

        return stored_version
    except Exception:
        database.rollback()
        raise