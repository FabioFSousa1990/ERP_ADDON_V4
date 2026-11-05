import hashlib
import uuid
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import (
    Alignment,
    Font,
    PatternFill,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.quotation_artifact import (
    QuotationArtifact,
)
from backend.app.models.quotation_bom import (
    QuotationBomVersion,
)


NORMALIZED_BOM_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "spreadsheetml.sheet"
)


def build_normalized_bom_content(
    bom_version: QuotationBomVersion,
) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "BOM Normalizada"

    worksheet["A1"] = "BOM normalizada"
    worksheet["A1"].font = Font(
        bold=True,
        size=16,
        color="FFFFFF",
    )
    worksheet["A1"].fill = PatternFill(
        fill_type="solid",
        fgColor="1D4ED8",
    )

    worksheet["A2"] = "Versão"
    worksheet["B2"] = bom_version.version_number

    worksheet["A3"] = "Ficheiro de origem"
    worksheet["B3"] = bom_version.source_name

    worksheet["A4"] = "Folha de origem"
    worksheet["B4"] = bom_version.sheet_name

    headers = [
        "Linha original",
        "Designadores originais",
        "Designadores expandidos",
        "Quantidade",
        "Estado",
        "Valor / componente",
        "Referência fabricante",
        "Footprint",
        "Descrição",
        "Datasheet",
        "Validação",
        "Avisos",
    ]

    header_row = 6

    for column_number, header in enumerate(
        headers,
        start=1,
    ):
        cell = worksheet.cell(
            row=header_row,
            column=column_number,
            value=header,
        )
        cell.font = Font(
            bold=True,
            color="FFFFFF",
        )
        cell.fill = PatternFill(
            fill_type="solid",
            fgColor="334155",
        )
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    for row_number, line in enumerate(
        bom_version.lines,
        start=header_row + 1,
    ):
        worksheet.cell(
            row=row_number,
            column=1,
            value=line.source_row_number,
        )
        worksheet.cell(
            row=row_number,
            column=2,
            value=line.reference_designator,
        )
        worksheet.cell(
            row=row_number,
            column=3,
            value=", ".join(line.designators),
        )
        worksheet.cell(
            row=row_number,
            column=4,
            value=line.quantity,
        )
        worksheet.cell(
            row=row_number,
            column=5,
            value=(
                "DNP"
                if line.do_not_place
                else "Montar"
            ),
        )
        worksheet.cell(
            row=row_number,
            column=6,
            value=line.name,
        )
        worksheet.cell(
            row=row_number,
            column=7,
            value=line.manufacturer_reference,
        )
        worksheet.cell(
            row=row_number,
            column=8,
            value=line.footprint,
        )
        worksheet.cell(
            row=row_number,
            column=9,
            value=line.description,
        )
        worksheet.cell(
            row=row_number,
            column=10,
            value=line.datasheet,
        )
        worksheet.cell(
            row=row_number,
            column=11,
            value=(
                "Válido"
                if line.is_valid
                else "Verificar"
            ),
        )
        worksheet.cell(
            row=row_number,
            column=12,
            value="; ".join(line.warnings),
        )

        if line.do_not_place:
            for column_number in range(1, 13):
                worksheet.cell(
                    row=row_number,
                    column=column_number,
                ).fill = PatternFill(
                    fill_type="solid",
                    fgColor="FEF3C7",
                )

    worksheet.freeze_panes = "A7"
    worksheet.auto_filter.ref = (
        f"A{header_row}:L{header_row + len(bom_version.lines)}"
    )

    column_widths = {
        "A": 15,
        "B": 28,
        "C": 38,
        "D": 12,
        "E": 12,
        "F": 28,
        "G": 38,
        "H": 38,
        "I": 48,
        "J": 48,
        "K": 14,
        "L": 45,
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    for row in worksheet.iter_rows(
        min_row=header_row + 1,
    ):
        for cell in row:
            cell.alignment = Alignment(
                vertical="top",
                wrap_text=True,
            )

    output = BytesIO()
    workbook.save(output)
    workbook.close()

    return output.getvalue()


def generate_normalized_bom_artifact(
    bom_version: QuotationBomVersion,
    database: Session,
) -> QuotationArtifact:
    display_name = (
        "BOM normalizada — "
        f"versão {bom_version.version_number}.xlsx"
    )

    existing_artifact = database.scalar(
        select(QuotationArtifact).where(
            QuotationArtifact.quotation_request_id
            == bom_version.quotation_request_id,
            QuotationArtifact.artifact_type
            == "normalized_bom",
            QuotationArtifact.display_name
            == display_name,
            QuotationArtifact.generator
            == "bom-normalizer",
            QuotationArtifact.generation_version
            == "1",
        )
    )

    if existing_artifact is not None:
        return existing_artifact

    content = build_normalized_bom_content(
        bom_version
    )
    artifact_hash = hashlib.sha256(content).hexdigest()

    stored_name = f"{uuid.uuid4().hex}.xlsx"

    relative_directory = (
        Path("quotation_requests")
        / str(bom_version.quotation_request_id)
        / "artifacts"
    )
    relative_path = relative_directory / stored_name

    storage_root = Path(settings.storage_root).resolve()
    target_directory = storage_root / relative_directory
    target_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    target_path = target_directory / stored_name
    temporary_path = (
        target_directory
        / f"{stored_name}.generating"
    )

    try:
        temporary_path.write_bytes(content)
        temporary_path.replace(target_path)

        artifact = QuotationArtifact(
            quotation_request_id=(
                bom_version.quotation_request_id
            ),
            source_file_id=bom_version.source_file_id,
            artifact_type="normalized_bom",
            display_name=display_name,
            stored_name=stored_name,
            relative_path=relative_path.as_posix(),
            media_type=NORMALIZED_BOM_MEDIA_TYPE,
            size_bytes=len(content),
            sha256=artifact_hash,
            generator="bom-normalizer",
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