import csv
import shlex
from collections import Counter
from pathlib import Path

from backend.app.models.quotation_file import QuotationFile
from backend.app.schemas.pick_place_analysis import (
    PickPlaceAnalysisLine,
    PickPlaceAnalysisResponse,
    PickPlaceBounds,
    PickPlaceFileSummary,
    PickPlaceSetAnalysisResponse,
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

def analyze_kicad_position_file(
    quotation_file: QuotationFile,
    source_path: Path,
) -> PickPlaceAnalysisResponse:
    if not source_path.is_file():
        raise PickPlaceAnalysisError(
            "O ficheiro físico do Pick&Place "
            "não foi encontrado."
        )

    text = decode_text_file(source_path)
    parsed_rows: list[dict] = []

    side_aliases = {
        "top": "top",
        "front": "top",
        "bottom": "bottom",
        "back": "bottom",
    }

    for row_number, raw_line in enumerate(
        text.splitlines(),
        start=1,
    ):
        line = raw_line.strip()

        if not line or line.startswith("#"):
            continue

        try:
            row = shlex.split(line)
        except ValueError as error:
            raise PickPlaceAnalysisError(
                f"Não foi possível interpretar a linha "
                f"{row_number}: {error}"
            ) from error

        if len(row) < 7:
            raise PickPlaceAnalysisError(
                f"A linha {row_number} tem apenas "
                f"{len(row)} campos; eram esperados "
                "Ref, Val, Package, PosX, PosY, Rot e Side."
            )

        designator = row[0].strip()
        value = row[1].strip() or None
        footprint = row[2].strip() or None

        x_raw = parse_number(
            row[3],
            "a coordenada X",
            row_number,
        )
        y_raw = parse_number(
            row[4],
            "a coordenada Y",
            row_number,
        )
        rotation = normalize_rotation(
            parse_number(
                row[5],
                "a rotação",
                row_number,
            )
        )

        original_side = row[6].strip().lower()
        side = side_aliases.get(
            original_side,
            "unknown",
        )

        warnings: list[str] = []

        if not designator:
            warnings.append(
                "A posição não tem designador."
            )

        if side == "unknown":
            warnings.append(
                f"A face {row[6]!r} não foi reconhecida."
            )

        additional_fields = {
            f"column_{column_number}": field or None
            for column_number, field in enumerate(
                row[7:],
                start=8,
            )
        }

        parsed_rows.append(
            {
                "row_number": row_number,
                "designator": designator,
                "value": value,
                "footprint": footprint,
                "part_number": None,
                "description": None,
                "x_raw": x_raw,
                "y_raw": y_raw,
                "x_mm": round(x_raw, 4),
                "y_mm": round(y_raw, 4),
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

    detected_sides = {
        item.side
        for item in items
        if item.side != "unknown"
    }

    if len(detected_sides) == 1:
        file_side = next(iter(detected_sides))
    elif len(detected_sides) > 1:
        file_side = "mixed"
    else:
        file_side = "unknown"

    return PickPlaceAnalysisResponse(
        quotation_file_id=quotation_file.id,
        original_name=quotation_file.original_name,
        source_format="kicad_position",
        coordinate_unit="mm",
        side=file_side,
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

    if extension == ".pos":
        return analyze_kicad_position_file(
            quotation_file,
            source_path,
        )

    raise PickPlaceAnalysisError(
        f"O formato {extension or 'sem extensão'} "
        "ainda não é suportado para análise Pick&Place."
    )

def analyze_pick_place_set(
    quotation_files: list[QuotationFile],
    source_paths: list[Path],
) -> PickPlaceSetAnalysisResponse:
    if not quotation_files:
        raise PickPlaceAnalysisError(
            "Não foram indicados ficheiros Pick&Place."
        )

    if len(quotation_files) != len(source_paths):
        raise PickPlaceAnalysisError(
            "A lista de ficheiros não coincide com "
            "a lista de caminhos físicos."
        )

    quotation_request_ids = {
        quotation_file.quotation_request_id
        for quotation_file in quotation_files
    }

    if len(quotation_request_ids) != 1:
        raise PickPlaceAnalysisError(
            "Os ficheiros Pick&Place não pertencem "
            "à mesma cotação."
        )

    analyses = [
        analyze_pick_place_file(
            quotation_file,
            source_path,
        )
        for quotation_file, source_path in zip(
            quotation_files,
            source_paths,
            strict=True,
        )
    ]

    designator_counts = Counter(
        item.designator.strip().upper()
        for analysis in analyses
        for item in analysis.items
        if item.designator.strip()
    )

    items: list[PickPlaceAnalysisLine] = []

    duplicate_warning = (
        "O designador aparece em mais do que um "
        "ficheiro Pick&Place."
    )

    for analysis in analyses:
        for item in analysis.items:
            warnings = list(item.warnings)
            normalized_designator = (
                item.designator.strip().upper()
            )

            if (
                normalized_designator
                and designator_counts[
                    normalized_designator
                ] > 1
                and duplicate_warning not in warnings
            ):
                warnings.append(duplicate_warning)

            items.append(
                item.model_copy(
                    update={
                        "warnings": warnings,
                        "is_valid": not warnings,
                    }
                )
            )

    if not items:
        raise PickPlaceAnalysisError(
            "Os ficheiros Pick&Place não contêm posições."
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

    detected_formats = {
        analysis.source_format
        for analysis in analyses
    }

    source_format = (
        next(iter(detected_formats))
        if len(detected_formats) == 1
        else "mixed"
    )

    detected_units = {
        analysis.coordinate_unit
        for analysis in analyses
    }

    coordinate_unit = (
        next(iter(detected_units))
        if len(detected_units) == 1
        else "mixed"
    )

    detected_sides = {
        item.side
        for item in items
        if item.side != "unknown"
    }

    if len(detected_sides) == 1:
        side = next(iter(detected_sides))
    elif len(detected_sides) > 1:
        side = "mixed"
    else:
        side = "unknown"

    file_summaries = [
        PickPlaceFileSummary(
            quotation_file_id=quotation_file.id,
            original_name=quotation_file.original_name,
            source_format=analysis.source_format,
            coordinate_unit=analysis.coordinate_unit,
            side=analysis.side,
            placement_count=analysis.placement_count,
            valid_placement_count=(
                analysis.valid_placement_count
            ),
            warning_count=analysis.warning_count,
        )
        for quotation_file, analysis in zip(
            quotation_files,
            analyses,
            strict=True,
        )
    ]

    return PickPlaceSetAnalysisResponse(
        quotation_request_id=next(
            iter(quotation_request_ids)
        ),
        source_format=source_format,
        coordinate_unit=coordinate_unit,
        side=side,
        files=file_summaries,
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
