import re
from collections import Counter

from backend.app.models.quotation_bom import (
    QuotationBomVersion,
)
from backend.app.models.quotation_file import QuotationFile
from backend.app.schemas.pick_place_analysis import (
    PickPlaceAnalysisResponse,
    PickPlaceSetAnalysisResponse,
)
from backend.app.schemas.pick_place_comparison import (
    PickPlaceComparisonItem,
    PickPlaceComparisonResponse,
    PickPlaceSetComparisonResponse,
)


class PickPlaceComparisonError(Exception):
    pass


def normalize_designator(value: str) -> str:
    return value.strip().upper()

def normalize_component_value(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    normalized = re.sub(
        r"[^a-z0-9]+",
        "",
        value.lower(),
    )

    return normalized or None

def natural_designator_key(
    value: str | None,
) -> tuple:
    if not value:
        return ("", 0)

    match = re.fullmatch(
        r"([A-Za-z_$]+)(\d+)",
        value.strip(),
    )

    if match is None:
        return (value.upper(), 0)

    return (
        match.group(1).upper(),
        int(match.group(2)),
    )

def is_technical_position(component: object) -> bool:
    value = (
        normalize_component_value(
            component.value
        )
        or ""
    )
    footprint = (
        normalize_component_value(
            component.footprint
        )
        or ""
    )
    designator = normalize_designator(
        component.designator
    )

    technical_markers = {
        "testpoint",
        "testpad",
        "pintst",
    }

    if any(
        marker in footprint
        for marker in technical_markers
    ):
        return True

    if value in {
        "conn1",
        "testpoint",
        "testpad",
    }:
        return True

    return (
        designator.startswith("TP")
        and (
            not value
            or "test" in value
            or "tpspad" in value
        )
    )

def compare_bom_with_pick_place(
    bom_version: QuotationBomVersion,
    pick_place_file: QuotationFile,
    pick_place_analysis: PickPlaceAnalysisResponse,
) -> PickPlaceComparisonResponse:
    if (
        bom_version.quotation_request_id
        != pick_place_file.quotation_request_id
    ):
        raise PickPlaceComparisonError(
            "A BOM e o Pick&Place não pertencem "
            "à mesma cotação."
        )

    bom_components: dict[str, dict] = {}

    for line in bom_version.lines:
        for designator in line.designators:
            normalized_designator = normalize_designator(
                designator
            )

            if normalized_designator in bom_components:
                raise PickPlaceComparisonError(
                    f"O designador {designator} aparece "
                    "mais do que uma vez na BOM."
                )

            bom_components[normalized_designator] = {
                "designator": designator,
                "value": line.name,
                "footprint": line.footprint,
                "do_not_place": line.do_not_place,
            }

    pick_place_components: dict[str, object] = {}

    for item in pick_place_analysis.items:
        normalized_designator = normalize_designator(
            item.designator
        )

        if normalized_designator in pick_place_components:
            raise PickPlaceComparisonError(
                f"O designador {item.designator} aparece "
                "mais do que uma vez no Pick&Place."
            )

        pick_place_components[normalized_designator] = item

    items: list[PickPlaceComparisonItem] = []

    unmatched_bom = dict(bom_components)
    unmatched_pick_place = dict(
        pick_place_components
    )

    exact_designators = sorted(
        set(unmatched_bom)
        & set(unmatched_pick_place),
        key=natural_designator_key,
    )

    for normalized_designator in exact_designators:
        bom_component = unmatched_bom.pop(
            normalized_designator
        )
        pick_place_component = unmatched_pick_place.pop(
            normalized_designator
        )

        bom_value = normalize_component_value(
            bom_component["value"]
        )
        pick_place_value = normalize_component_value(
            pick_place_component.value
        )

        if bom_component["do_not_place"]:
            comparison_status = "dnp_in_pick_place"
            reason = (
                "O componente está marcado como DNP na BOM, "
                "mas aparece no Pick&Place."
            )
        elif (
            bom_value
            and pick_place_value
            and bom_value != pick_place_value
        ):
            comparison_status = "value_mismatch"
            reason = (
                "O designador coincide, mas o valor "
                "do componente é diferente."
            )
        else:
            comparison_status = "exact_match"
            reason = (
                "Correspondência exata pelo designador."
            )

        items.append(
            PickPlaceComparisonItem(
                status=comparison_status,
                bom_designator=bom_component[
                    "designator"
                ],
                pick_place_designator=(
                    pick_place_component.designator
                ),
                bom_value=bom_component["value"],
                pick_place_value=(
                    pick_place_component.value
                ),
                bom_footprint=bom_component[
                    "footprint"
                ],
                pick_place_footprint=(
                    pick_place_component.footprint
                ),
                do_not_place=bom_component[
                    "do_not_place"
                ],
                x_mm=pick_place_component.x_mm,
                y_mm=pick_place_component.y_mm,
                rotation_degrees=(
                    pick_place_component.rotation_degrees
                ),
                side=pick_place_component.side,
                reason=reason,
            )
        )

    bom_value_counts = Counter(
        normalize_component_value(
            component["value"]
        )
        for component in unmatched_bom.values()
        if normalize_component_value(
            component["value"]
        )
    )

    pick_place_value_counts = Counter(
        normalize_component_value(
            component.value
        )
        for component in unmatched_pick_place.values()
        if normalize_component_value(
            component.value
        )
    )

    probable_pairs: list[tuple[str, str]] = []

    for bom_key, bom_component in unmatched_bom.items():
        normalized_value = normalize_component_value(
            bom_component["value"]
        )

        if not normalized_value:
            continue

        if bom_value_counts[normalized_value] != 1:
            continue

        if pick_place_value_counts[normalized_value] != 1:
            continue

        matching_pick_place_key = next(
            (
                pick_place_key
                for (
                    pick_place_key,
                    pick_place_component,
                ) in unmatched_pick_place.items()
                if normalize_component_value(
                    pick_place_component.value
                )
                == normalized_value
            ),
            None,
        )

        if matching_pick_place_key is not None:
            probable_pairs.append(
                (
                    bom_key,
                    matching_pick_place_key,
                )
            )

    for bom_key, pick_place_key in probable_pairs:
        bom_component = unmatched_bom.pop(
            bom_key
        )
        pick_place_component = unmatched_pick_place.pop(
            pick_place_key
        )

        if bom_component["do_not_place"]:
            comparison_status = "dnp_in_pick_place"
            reason = (
                "Possível correspondência por valor, mas "
                "o componente está marcado como DNP."
            )
        else:
            comparison_status = "probable_match"
            reason = (
                "Os designadores são diferentes, mas o valor "
                "é único e coincide nos dois ficheiros."
            )

        items.append(
            PickPlaceComparisonItem(
                status=comparison_status,
                bom_designator=bom_component[
                    "designator"
                ],
                pick_place_designator=(
                    pick_place_component.designator
                ),
                bom_value=bom_component["value"],
                pick_place_value=(
                    pick_place_component.value
                ),
                bom_footprint=bom_component[
                    "footprint"
                ],
                pick_place_footprint=(
                    pick_place_component.footprint
                ),
                do_not_place=bom_component[
                    "do_not_place"
                ],
                x_mm=pick_place_component.x_mm,
                y_mm=pick_place_component.y_mm,
                rotation_degrees=(
                    pick_place_component.rotation_degrees
                ),
                side=pick_place_component.side,
                reason=reason,
            )
        )

    for bom_component in unmatched_bom.values():
        items.append(
            PickPlaceComparisonItem(
                status="only_in_bom",
                bom_designator=bom_component[
                    "designator"
                ],
                pick_place_designator=None,
                bom_value=bom_component["value"],
                pick_place_value=None,
                bom_footprint=bom_component[
                    "footprint"
                ],
                pick_place_footprint=None,
                do_not_place=bom_component[
                    "do_not_place"
                ],
                x_mm=None,
                y_mm=None,
                rotation_degrees=None,
                side=None,
                reason=(
                    "O componente existe na BOM, mas não foi "
                    "encontrado no Pick&Place."
                ),
            )
        )

    for pick_place_component in (
        unmatched_pick_place.values()
    ):
        if is_technical_position(
            pick_place_component
        ):
            comparison_status = "technical_position"
            reason = (
                "Posição técnica ou ponto de teste presente "
                "no ficheiro de posições e ausente da BOM."
            )
        else:
            comparison_status = "only_in_pick_place"
            reason = (
                "A posição existe no Pick&Place, mas não "
                "foi encontrada na BOM."
            )

        items.append(
            PickPlaceComparisonItem(
                status=comparison_status,
                bom_designator=None,
                pick_place_designator=(
                    pick_place_component.designator
                ),
                bom_value=None,
                pick_place_value=(
                    pick_place_component.value
                ),
                bom_footprint=None,
                pick_place_footprint=(
                    pick_place_component.footprint
                ),
                do_not_place=False,
                x_mm=pick_place_component.x_mm,
                y_mm=pick_place_component.y_mm,
                rotation_degrees=(
                    pick_place_component.rotation_degrees
                ),
                side=pick_place_component.side,
                reason=reason,
            )
        )

    status_counts = Counter(
        item.status for item in items
    )

    items.sort(
        key=lambda item: natural_designator_key(
            item.bom_designator
            or item.pick_place_designator
        )
    )

    return PickPlaceComparisonResponse(
        quotation_request_id=(
            bom_version.quotation_request_id
        ),
        bom_version_id=bom_version.id,
        pick_place_file_id=pick_place_file.id,
        bom_placement_count=len(bom_components),
        pick_place_placement_count=(
            pick_place_analysis.placement_count
        ),
        exact_match_count=status_counts[
            "exact_match"
        ],
        probable_match_count=status_counts[
            "probable_match"
        ],
        value_mismatch_count=status_counts[
            "value_mismatch"
        ],
        only_in_bom_count=status_counts[
            "only_in_bom"
        ],
        only_in_pick_place_count=status_counts[
            "only_in_pick_place"
        ],
        technical_position_count=status_counts[
            "technical_position"
        ],
        dnp_in_pick_place_count=status_counts[
            "dnp_in_pick_place"
        ],
        items=items,
    )

def compare_bom_with_pick_place_set(
    bom_version: QuotationBomVersion,
    pick_place_files: list[QuotationFile],
    pick_place_analysis: PickPlaceSetAnalysisResponse,
) -> PickPlaceSetComparisonResponse:
    if not pick_place_files:
        raise PickPlaceComparisonError(
            "Não foram indicados ficheiros Pick&Place."
        )

    for pick_place_file in pick_place_files:
        if (
            bom_version.quotation_request_id
            != pick_place_file.quotation_request_id
        ):
            raise PickPlaceComparisonError(
                "A BOM e os ficheiros Pick&Place não "
                "pertencem à mesma cotação."
            )

    first_file = pick_place_files[0]

    comparison = compare_bom_with_pick_place(
        bom_version,
        first_file,
        pick_place_analysis,
    )

    return PickPlaceSetComparisonResponse(
        quotation_request_id=(
            comparison.quotation_request_id
        ),
        bom_version_id=comparison.bom_version_id,
        pick_place_file_ids=[
            pick_place_file.id
            for pick_place_file in pick_place_files
        ],
        bom_placement_count=(
            comparison.bom_placement_count
        ),
        pick_place_placement_count=(
            comparison.pick_place_placement_count
        ),
        exact_match_count=(
            comparison.exact_match_count
        ),
        probable_match_count=(
            comparison.probable_match_count
        ),
        value_mismatch_count=(
            comparison.value_mismatch_count
        ),
        only_in_bom_count=(
            comparison.only_in_bom_count
        ),
        only_in_pick_place_count=(
            comparison.only_in_pick_place_count
        ),
        technical_position_count=(
            comparison.technical_position_count
        ),
        dnp_in_pick_place_count=(
            comparison.dnp_in_pick_place_count
        ),
        items=comparison.items,
    )
