import re
import unicodedata
from pathlib import Path
from dataclasses import dataclass
from typing import Any
from odf import teletype
from odf.opendocument import load as load_ods
from odf.table import (
    CoveredTableCell,
    Table,
    TableCell,
    TableRow,
)
from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from backend.app.models.quotation_file import QuotationFile
from backend.app.schemas.bom_analysis import (
    BomAnalysisLine,
    BomAnalysisResponse,
)

DESIGNATOR_RANGE_PATTERN = re.compile(
    r"^([A-Za-z]+)(\d+)-(?:([A-Za-z]+))?(\d+)$"
)


def normalize_header(value: object) -> str:
    if value is None:
        return ""

    text = str(value).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(
        character
        for character in text
        if not unicodedata.combining(character)
    )

    return re.sub(r"[^a-z0-9]+", "", text)


def expand_designators(value: object) -> list[str]:
    if value is None:
        return []

    text = str(value).strip()

    if not text:
        return []

    text = re.sub(r"\s*-\s*", "-", text)

    tokens = [
        token.strip()
        for token in re.split(r"[,;\s]+", text)
        if token.strip()
    ]

    designators: list[str] = []

    for token in tokens:
        range_match = DESIGNATOR_RANGE_PATTERN.fullmatch(token)

        if range_match is None:
            designators.append(token.upper())
            continue

        start_prefix = range_match.group(1).upper()
        start_number_text = range_match.group(2)
        end_prefix = (
            range_match.group(3) or start_prefix
        ).upper()
        end_number_text = range_match.group(4)

        if start_prefix != end_prefix:
            designators.append(token.upper())
            continue

        start_number = int(start_number_text)
        end_number = int(end_number_text)

        if end_number < start_number:
            designators.append(token.upper())
            continue

        number_width = max(
            len(start_number_text),
            len(end_number_text),
        )

        designators.extend(
            f"{start_prefix}{number:0{number_width}d}"
            for number in range(
                start_number,
                end_number + 1,
            )
        )

    return designators

class BomAnalysisError(Exception):
    pass


HEADER_ALIASES = {
    "reference_designator": {
        "referencedesignator",
        "referencedesignators",
        "designator",
        "designators",
        "refdes",
        "reference",
        "references",
    },
    "quantity": {
        "quantity",
        "qty",
        "quantite",
        "quantidade",
    },
    "name": {
        "name",
        "partname",
        "partnumber",
        "component",
        "componentname",
        "value",
    },
    "description": {
        "description",
        "frenchdescription",
        "componentdescription",
        "designation",
    },
        "dnp": {
        "dnp",
        "dnf",
        "donotplace",
        "notfitted",
        "nomontar",
        "naomontar",
    },
    "footprint": {
        "footprint",
        "package",
        "encapsulamento",
    },
    "manufacturer_reference": {
        "mref",
        "manufacturerreference",
        "manufacturerpartnumber",
        "mpn",
    },
    "datasheet": {
        "datasheet",
        "datasheeturl",
        "documentacao",
    },
}

@dataclass
class BomCell:
    value: Any


class BomWorksheet:
    def __init__(
        self,
        title: str,
        rows: list[list[Any]],
    ) -> None:
        self.title = title
        self.rows = rows
        self.max_row = len(rows)
        self.max_column = max(
            (len(row) for row in rows),
            default=0,
        )

    def cell(
        self,
        row: int,
        column: int,
    ) -> BomCell:
        row_index = row - 1
        column_index = column - 1

        if (
            row_index < 0
            or row_index >= len(self.rows)
            or column_index < 0
            or column_index >= len(self.rows[row_index])
        ):
            return BomCell(value=None)

        return BomCell(
            value=self.rows[row_index][column_index]
        )

class BomWorkbook:
    def __init__(
        self,
        worksheets: list[BomWorksheet],
    ) -> None:
        self.worksheets = worksheets

    def close(self) -> None:
        pass

def parse_repeated_count(
    element,
    attribute: str,
) -> int:
    value = element.getAttribute(attribute)

    if not value:
        return 1

    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 1

def get_ods_cell_value(cell) -> object:
    value_type = cell.getAttribute("valuetype")

    if value_type in {
        "float",
        "currency",
        "percentage",
    }:
        raw_value = cell.getAttribute("value")

        if raw_value is not None:
            try:
                numeric_value = float(raw_value)

                if numeric_value.is_integer():
                    return int(numeric_value)

                return numeric_value
            except (TypeError, ValueError):
                pass

    if value_type == "boolean":
        return cell.getAttribute("booleanvalue") == "true"

    if value_type == "date":
        return cell.getAttribute("datevalue")

    text = teletype.extractText(cell).strip()

    return text or None

def load_ods_workbook(source_path: Path) -> BomWorkbook:
    try:
        document = load_ods(str(source_path))
    except Exception as error:
        raise BomAnalysisError(
            f"Não foi possível abrir o ficheiro ODS: {error}"
        ) from error

    worksheets: list[BomWorksheet] = []
    cell_qnames = {
        TableCell().qname,
        CoveredTableCell().qname,
    }
    for table in document.spreadsheet.getElementsByType(
        Table
    ):
        rows: list[list[Any]] = []

        for table_row in table.getElementsByType(TableRow):
            row_values: list[Any] = []

            cells = [
                child
                for child in table_row.childNodes
                if getattr(child, "qname", None)
                in cell_qnames
            ]

            for cell in cells:
                value = get_ods_cell_value(cell)
                repeated_columns = parse_repeated_count(
                    cell,
                    "numbercolumnsrepeated",
                )

                # Evita que folhas ODS com milhares de colunas
                # vazias reservadas consumam memória.
                if value is None:
                    repeated_columns = min(
                        repeated_columns,
                        200,
                    )

                row_values.extend(
                    [value] * repeated_columns
                )

            while row_values and row_values[-1] is None:
                row_values.pop()

            repeated_rows = parse_repeated_count(
                table_row,
                "numberrowsrepeated",
            )

            if not row_values:
                repeated_rows = 1
            else:
                repeated_rows = min(repeated_rows, 1000)

            for _ in range(repeated_rows):
                rows.append(list(row_values))

        while rows and not rows[-1]:
            rows.pop()

        worksheets.append(
            BomWorksheet(
                title=table.getAttribute("name")
                or "Folha sem nome",
                rows=rows,
            )
        )

    if not worksheets:
        raise BomAnalysisError(
            "O ficheiro ODS não contém folhas de cálculo."
        )

    return BomWorkbook(worksheets)

def identify_header(value: object) -> str | None:
    normalized_value = normalize_header(value)

    for field, aliases in HEADER_ALIASES.items():
        if normalized_value in aliases:
            return field

    return None

def find_bom_table(
    workbook,
) -> tuple[Worksheet, int, dict[str, int]]:
    for worksheet in workbook.worksheets:
        maximum_row = min(worksheet.max_row, 30)

        for row_number in range(1, maximum_row + 1):
            columns: dict[str, int] = {}

            for column_number in range(
                1,
                worksheet.max_column + 1,
            ):
                value = worksheet.cell(
                    row=row_number,
                    column=column_number,
                ).value

                field = identify_header(value)

                if field is not None and field not in columns:
                    columns[field] = column_number

            if {
                "reference_designator",
                "quantity",
            }.issubset(columns):
                return worksheet, row_number, columns

    raise BomAnalysisError(
        "Não foi encontrada uma tabela BOM com as colunas "
        "de designadores e quantidade."
    )

def normalize_optional_text(value: object) -> str | None:
    if value is None:
        return None

    text = str(value).strip()

    return text or None

def parse_quantity(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if value.is_integer():
            return int(value)

        return None

    text = str(value).strip().replace(",", ".")

    if not text:
        return None

    try:
        numeric_value = float(text)
    except ValueError:
        return None

    if not numeric_value.is_integer():
        return None

    return int(numeric_value)

def parse_do_not_place(value: object) -> bool:
    if value is None:
        return False

    normalized_value = normalize_header(value)

    return normalized_value in {
        "1",
        "true",
        "yes",
        "sim",
        "x",
        "dnp",
        "dnf",
        "donotplace",
        "notfitted",
        "nomontar",
        "naomontar",
    }

def get_column_value(
    worksheet: Worksheet,
    row_number: int,
    columns: dict[str, int],
    field: str,
) -> object:
    column_number = columns.get(field)

    if column_number is None:
        return None

    return worksheet.cell(
        row=row_number,
        column=column_number,
    ).value

def analyze_bom_file(
    quotation_file: QuotationFile,
    source_path: Path,
) -> BomAnalysisResponse:
    extension = source_path.suffix.lower()

    if extension not in {
        ".xlsx",
        ".xlsm",
        ".ods",
    }:
        raise BomAnalysisError(
            "A análise de BOM suporta ficheiros "
            "XLSX, XLSM e ODS."
        )

    if not source_path.is_file():
        raise BomAnalysisError(
            "O ficheiro físico da BOM não foi encontrado."
        )

    if extension == ".ods":
        workbook = load_ods_workbook(source_path)
    else:
        try:
            workbook = load_workbook(
                filename=source_path,
                read_only=True,
                data_only=True,
            )
        except Exception as error:
            raise BomAnalysisError(
                f"Não foi possível abrir o ficheiro Excel: {error}"
            ) from error

    try:
        worksheet, header_row, columns = find_bom_table(
            workbook
        )

        items: list[BomAnalysisLine] = []

        for row_number in range(
            header_row + 1,
            worksheet.max_row + 1,
        ):
            reference_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "reference_designator",
            )
            quantity_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "quantity",
            )
            name_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "name",
            )
            description_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "description",
            )
            dnp_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "dnp",
            )
            footprint_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "footprint",
            )
            manufacturer_reference_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "manufacturer_reference",
            )
            datasheet_value = get_column_value(
                worksheet,
                row_number,
                columns,
                "datasheet",
            )

            if all(
                value is None or str(value).strip() == ""
                for value in {
                    reference_value,
                    quantity_value,
                    name_value,
                    description_value,
                    dnp_value,
                    footprint_value,
                    manufacturer_reference_value,
                    datasheet_value,
                }
            ):
                continue

            reference_designator = normalize_optional_text(
                reference_value
            )
            designators = expand_designators(
                reference_designator
            )
            declared_quantity = parse_quantity(
                quantity_value
            )
            do_not_place = parse_do_not_place(
                dnp_value
            )

            warnings: list[str] = []

            if not reference_designator:
                warnings.append(
                    "A linha não tem designadores."
                )

            if not designators:
                warnings.append(
                    "Não foi possível interpretar os designadores."
                )

            if declared_quantity is None:
                warnings.append(
                    "A quantidade não é um número inteiro válido."
                )
            elif declared_quantity <= 0:
                warnings.append(
                    "A quantidade tem de ser superior a zero."
                )
            elif declared_quantity != len(designators):
                warnings.append(
                    "A quantidade declarada não coincide com "
                    "o número de designadores."
                )

            items.append(
                BomAnalysisLine(
                    row_number=row_number,
                    reference_designator=reference_designator,
                    designators=designators,
                    declared_quantity=declared_quantity,
                    calculated_quantity=len(designators),
                    name=normalize_optional_text(name_value),
                    description=normalize_optional_text(
                        description_value
                    ),
                    do_not_place=do_not_place,
                    footprint=normalize_optional_text(
                        footprint_value
                    ),
                    manufacturer_reference=(
                        normalize_optional_text(
                            manufacturer_reference_value
                        )
                    ),
                    datasheet=normalize_optional_text(
                        datasheet_value
                    ),
                    is_valid=not warnings,
                    warnings=warnings,
                )
            )

        if not items:
            raise BomAnalysisError(
                "A tabela BOM não contém linhas de material."
            )

        return BomAnalysisResponse(
            quotation_file_id=quotation_file.id,
            original_name=quotation_file.original_name,
            sheet_name=worksheet.title,
            header_row=header_row,
            line_count=len(items),
            placement_count=sum(
                item.calculated_quantity
                for item in items
            ),
            mounted_placement_count=sum(
                item.calculated_quantity
                for item in items
                if not item.do_not_place
            ),
            dnp_placement_count=sum(
                item.calculated_quantity
                for item in items
                if item.do_not_place
            ),
            dnp_line_count=sum(
                1
                for item in items
                if item.do_not_place
            ),
            valid_line_count=sum(
                1
                for item in items
                if item.is_valid
            ),
            warning_count=sum(
                len(item.warnings)
                for item in items
            ),
            items=items,
        )
    finally:
        workbook.close()