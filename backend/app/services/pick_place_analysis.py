import csv
from collections import Counter
from pathlib import Path

from backend.app.models.quotation_file import QuotationFile
from backend.app.schemas.pick_place_analysis import (
    PickPlaceAnalysisLine,
    PickPlaceAnalysisResponse,
    PickPlaceBounds,
)


MIL_TO_MM = 0.0254


class PickPlaceAnalysisError(Exception):
    pass


def decode_text_file(source_path: Path) -> str:
    raw_content = source_path.read_bytes()

    for encoding in (
        "utf-8-sig",
        "utf-8",
        "cp1252",
        "latin-1",
    ):
        try:
            return raw_content.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise PickPlaceAnalysisError(
        "Não foi possível identificar a codificação "
        "do ficheiro Pick&Place."
    )


def parse_number(
    value: str,
    field_name: str,
    row_number: int,
) -> float:
    normalized_value = value.strip().replace(",", ".")

    if not normalized_value:
        raise PickPlaceAnalysisError(
            f"A linha {row_number} não tem {field_name}."
        )

    try:
        return float(normalized_value)
    except ValueError as error:
        raise PickPlaceAnalysisError(
            f"O valor de {field_name} na linha "
            f"{row_number} não é numérico: {value!r}."
        ) from error


def normalize_rotation(value: float) -> float:
    normalized_value = value % 360

    if normalized_value == -0.0:
        return 0.0

    return normalized_value


def determine_mount_side(
    source_path: Path,
) -> str:
    extension = source_path.suffix.lower()

    if extension == ".mnt":
        return "top"

    if extension == ".mnb":
        return "bottom"

    return "unknown"


def analyze_eagle_mount_file(
    quotation_file: QuotationFile,
    source_path: Path,
) -> PickPlaceAnalysisResponse:
    if not source_path.is_file():
        raise PickPlaceAnalysisError(
            "O ficheiro físico do Pick&Place "
            "não foi encontrado."
        )

    extension = source_path.suffix.lower()

    if extension not in {".mnt", ".mnb"}:
        raise PickPlaceAnalysisError(
            "Este analisador suporta ficheiros "
            "Pick&Place MNT e MNB."
        )

    side = determine_mount_side(source_path)
    text = decode_text_file(source_path)

    parsed_rows: list[dict] = []

    reader = csv.reader(
        text.splitlines(),
        delimiter=";",
    )

    for row_number, row in enumerate(
        reader,
        start=1,
    ):
        if not row or not any(value.strip() for value in row):
            continue

        if len(row) < 5:
            raise PickPlaceAnalysisError(
                f"A linha {row_number} tem apenas "
                f"{len(row)} campos; eram esperados pelo "
                "menos 5."
            )

        value = row[0].strip() or None
        x_raw = parse_number(
            row[1],
            "a coordenada X",
            row_number,
        )
        y_raw = parse_number(
            row[2],
            "a coordenada Y",
            row_number,
        )
        rotation = normalize_rotation(
            parse_number(
                row[3],
                "a rotação",
                row_number,
            )
        )
        designator = row[4].strip()

        warnings: list[str] = []

        if not designator:
            warnings.append(
                "A posição não tem designador."
            )

        additional_fields = {
            f"column_{column_number}": field.strip() or None
            for column_number, field in enumerate(
                row[5:],
                start=6,
            )
        }

        parsed_rows.append(
            {
                "row_number": row_number,
                "designator": designator,
                "value": value,
                "footprint": None,
                "part_number": None,
                "description": None,
                "x_raw": x_raw,
                "y_raw": y_raw,
                "x_mm": round(x_raw * MIL_TO_MM, 4),
                "y_mm": round(y_raw * MIL_TO_MM, 4),
                "rotation_degrees": rotation,
                "side": side,
                "warnings": warnings,
                "additional_fields": additional_fields,
            }
        )

    if not parsed_rows:
        raise PickPlaceAnalysisError(
            "O ficheiro Pick&Place não contém posições."
        )

    designator_counts = Counter(
        row["designator"].upper()
        for row in parsed_rows
        if row["designator"]
    )

    items: list[PickPlaceAnalysisLine] = []

    for parsed_row in parsed_rows:
        designator = parsed_row["designator"]

        if (
            designator
            and designator_counts[designator.upper()] > 1
        ):
            parsed_row["warnings"].append(
                "O designador aparece mais do que uma vez."
            )

        items.append(
            PickPlaceAnalysisLine(
                **parsed_row,
                is_valid=not parsed_row["warnings"],
            )
        )

    x_values = [item.x_mm for item in items]
    y_values = [item.y_mm for item in items]

    minimum_x = min(x_values)
    maximum_x = max(x_values)
    minimum_y = min(y_values)
    maximum_y = max(y_values)

    bounds = PickPlaceBounds(
        minimum_x_mm=round(minimum_x, 4),
        maximum_x_mm=round(maximum_x, 4),
        minimum_y_mm=round(minimum_y, 4),
        maximum_y_mm=round(maximum_y, 4),
        width_mm=round(maximum_x - minimum_x, 4),
        height_mm=round(maximum_y - minimum_y, 4),
    )

    return PickPlaceAnalysisResponse(
        quotation_file_id=quotation_file.id,
        original_name=quotation_file.original_name,
        source_format="eagle_mount",
        coordinate_unit="mil",
        side=side,
        placement_count=len(items),
        valid_placement_count=sum(
            1 for item in items if item.is_valid
        ),
        warning_count=sum(
            len(item.warnings)
            for item in items
        ),
        bounds=bounds,
        items=items,
    )


def analyze_pick_place_file(
    quotation_file: QuotationFile,
    source_path: Path,
) -> PickPlaceAnalysisResponse:
    extension = source_path.suffix.lower()

    if extension in {".mnt", ".mnb"}:
        return analyze_eagle_mount_file(
            quotation_file,
            source_path,
        )

    raise PickPlaceAnalysisError(
        f"O formato {extension or 'sem extensão'} "
        "ainda não é suportado para análise Pick&Place."
    )