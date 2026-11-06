import re

from backend.app.models.quotation_bom import (
    QuotationBomLine,
    QuotationBomVersion,
)
from backend.app.schemas.quotation_bom import (
    QuotationBomComparisonResponse,
    QuotationBomComponentChange,
    QuotationBomComponentSnapshot,
)


COMPARISON_FIELDS = (
    "name",
    "description",
    "do_not_place",
    "footprint",
    "manufacturer_reference",
    "datasheet",
)


class BomComparisonError(ValueError):
    pass


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = " ".join(value.split()).casefold()
    return normalized or None


def natural_designator_key(
    designator: str,
) -> tuple[str, int, str]:
    match = re.fullmatch(
        r"([A-Za-z]+)(\d+)(.*)",
        designator,
    )

    if match is None:
        return designator.casefold(), 0, ""

    prefix, number, suffix = match.groups()

    return (
        prefix.casefold(),
        int(number),
        suffix.casefold(),
    )


def create_component_snapshot(
    designator: str,
    line: QuotationBomLine,
) -> QuotationBomComponentSnapshot:
    return QuotationBomComponentSnapshot(
        designator=designator.strip().upper(),
        name=line.name,
        description=line.description,
        do_not_place=line.do_not_place,
        footprint=line.footprint,
        manufacturer_reference=line.manufacturer_reference,
        datasheet=line.datasheet,
    )


def build_component_map(
    bom_version: QuotationBomVersion,
) -> dict[str, QuotationBomComponentSnapshot]:
    components: dict[
        str,
        QuotationBomComponentSnapshot,
    ] = {}

    for line in bom_version.lines:
        for raw_designator in line.designators:
            designator = raw_designator.strip().upper()

            if not designator:
                continue

            if designator in components:
                raise BomComparisonError(
                    "O designador "
                    f"{designator} aparece mais do que uma vez "
                    f"na versão {bom_version.version_number}."
                )

            components[designator] = (
                create_component_snapshot(
                    designator,
                    line,
                )
            )

    return components


def field_values_are_equal(
    field: str,
    previous_value: object,
    current_value: object,
) -> bool:
    if field == "do_not_place":
        return previous_value == current_value

    previous_text = (
        previous_value
        if isinstance(previous_value, str)
        else None
    )
    current_text = (
        current_value
        if isinstance(current_value, str)
        else None
    )

    return (
        normalize_text(previous_text)
        == normalize_text(current_text)
    )


def compare_bom_versions(
    previous_version: QuotationBomVersion,
    current_version: QuotationBomVersion,
) -> QuotationBomComparisonResponse:
    if (
        previous_version.quotation_request_id
        != current_version.quotation_request_id
    ):
        raise BomComparisonError(
            "As versões pertencem a cotações diferentes."
        )

    if previous_version.id == current_version.id:
        raise BomComparisonError(
            "Seleciona duas versões diferentes da BOM."
        )

    previous_components = build_component_map(
        previous_version
    )
    current_components = build_component_map(
        current_version
    )

    previous_designators = set(previous_components)
    current_designators = set(current_components)

    added_designators = sorted(
        current_designators - previous_designators,
        key=natural_designator_key,
    )
    removed_designators = sorted(
        previous_designators - current_designators,
        key=natural_designator_key,
    )
    common_designators = sorted(
        previous_designators & current_designators,
        key=natural_designator_key,
    )

    added = [
        current_components[designator]
        for designator in added_designators
    ]
    removed = [
        previous_components[designator]
        for designator in removed_designators
    ]

    changed: list[QuotationBomComponentChange] = []
    unchanged_count = 0

    for designator in common_designators:
        previous_component = previous_components[
            designator
        ]
        current_component = current_components[
            designator
        ]

        changed_fields = [
            field
            for field in COMPARISON_FIELDS
            if not field_values_are_equal(
                field,
                getattr(previous_component, field),
                getattr(current_component, field),
            )
        ]

        if not changed_fields:
            unchanged_count += 1
            continue

        changed.append(
            QuotationBomComponentChange(
                designator=designator,
                changed_fields=changed_fields,
                previous=previous_component,
                current=current_component,
            )
        )

    return QuotationBomComparisonResponse(
        previous_version=previous_version,
        current_version=current_version,
        added=added,
        removed=removed,
        changed=changed,
        added_count=len(added),
        removed_count=len(removed),
        changed_count=len(changed),
        unchanged_count=unchanged_count,
    )