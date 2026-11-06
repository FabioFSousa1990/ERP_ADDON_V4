import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from backend.app.core.config import settings
import warnings
from PIL import Image, ImageChops, ImageOps
from pygerber.gerberx3.api.v2 import (
    FileTypeEnum,
    GerberFile,
    Project,
)
from gerbonara import LayerStack

MAX_ARCHIVE_FILES = 2_000
MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024
SUPPORTED_ARCHIVE_SUFFIXES = {".zip", ".rar", ".7z"}
PYGERBER_LAYER_TYPES = {
    "copper": FileTypeEnum.COPPER,
    "mask": FileTypeEnum.MASK,
    "silk": FileTypeEnum.SILK,
}

PREVIEW_DPMM = 40

class GerberAnalysisError(Exception):
    pass


def get_seven_zip_path() -> Path:
    candidates: list[Path] = []

    if settings.seven_zip_path:
        candidates.append(Path(settings.seven_zip_path))

    discovered_path = shutil.which("7z") or shutil.which("7zz")

    if discovered_path:
        candidates.append(Path(discovered_path))

    candidates.extend(
        [
            Path(r"C:\Program Files\7-Zip\7z.exe"),
            Path(r"C:\Program Files (x86)\7-Zip\7z.exe"),
        ]
    )

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()

    raise GerberAnalysisError(
        "O 7-Zip não está instalado ou configurado."
    )


def validate_archive_path(archive_path: Path) -> None:
    if not archive_path.is_file():
        raise GerberAnalysisError(
            "O pacote Gerber não foi encontrado."
        )

    if archive_path.suffix.lower() not in SUPPORTED_ARCHIVE_SUFFIXES:
        raise GerberAnalysisError(
            "O pacote Gerber deve estar em formato ZIP, RAR ou 7z."
        )


def extract_archive(
    archive_path: Path,
    target_directory: Path,
) -> None:
    seven_zip_path = get_seven_zip_path()

    command = [
        str(seven_zip_path),
        "x",
        str(archive_path.resolve()),
        f"-o{target_directory.resolve()}",
        "-y",
        "-p__ERP_ADDON_NO_PASSWORD__",
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise GerberAnalysisError(
            "A extração do pacote excedeu 120 segundos."
        ) from error

    if result.returncode != 0:
        diagnostic = (
            result.stderr.strip()
            or result.stdout.strip()
        )

        if len(diagnostic) > 1000:
            diagnostic = diagnostic[:1000] + "…"

        raise GerberAnalysisError(
            diagnostic
            or "Não foi possível extrair o pacote Gerber."
        )


def validate_extracted_directory(directory: Path) -> None:
    files = [
        path
        for path in directory.rglob("*")
        if path.is_file()
    ]

    if not files:
        raise GerberAnalysisError(
            "O pacote Gerber está vazio."
        )

    if len(files) > MAX_ARCHIVE_FILES:
        raise GerberAnalysisError(
            "O pacote Gerber contém demasiados ficheiros."
        )

    directory_root = directory.resolve()
    total_size = 0

    for file_path in files:
        if file_path.is_symlink():
            raise GerberAnalysisError(
                "O pacote contém ligações simbólicas não permitidas."
            )

        resolved_path = file_path.resolve()

        if directory_root not in resolved_path.parents:
            raise GerberAnalysisError(
                "O pacote contém caminhos inválidos."
            )

        total_size += file_path.stat().st_size

        if total_size > MAX_UNCOMPRESSED_SIZE:
            raise GerberAnalysisError(
                "O conteúdo descompactado excede 1 GB."
            )

def get_layer_name(layer: object) -> str:
    source_path = (
        getattr(layer, "original_path", None)
        or getattr(layer, "filename", None)
    )

    if source_path is not None:
        return Path(str(source_path)).name

    return str(layer)


def inspect_extracted_gerbers(directory: Path) -> dict:
    try:
        with warnings.catch_warnings(record=True) as caught_warnings:
            warnings.simplefilter("always")
            stack = LayerStack.open(directory)

            bounds = stack.board_bounds()
    except Exception as error:
        raise GerberAnalysisError(
            f"Não foi possível interpretar os Gerbers: {error}"
        ) from error

    graphic_layers = [
        {
            "side": side,
            "function": function,
            "name": get_layer_name(layer),
            "object_count": len(
                getattr(layer, "objects", [])
            ),
        }
        for (side, function), layer
        in stack.graphic_layers.items()
    ]

    drill_layers = [
        {
            "name": get_layer_name(layer),
            "object_count": len(
                getattr(layer, "objects", [])
            ),
        }
        for layer in stack.drill_layers
    ]

    board = None

    if bounds is not None:
        (minimum_x, minimum_y), (
            maximum_x,
            maximum_y,
        ) = bounds

        board = {
            "minimum_x_mm": round(minimum_x, 4),
            "minimum_y_mm": round(minimum_y, 4),
            "maximum_x_mm": round(maximum_x, 4),
            "maximum_y_mm": round(maximum_y, 4),
            "width_mm": round(maximum_x - minimum_x, 4),
            "height_mm": round(maximum_y - minimum_y, 4),
        }

    required_layers = {
        ("top", "copper"),
        ("bottom", "copper"),
        ("top", "mask"),
        ("bottom", "mask"),
        ("top", "silk"),
        ("bottom", "silk"),
    }

    available_layers = set(stack.graphic_layers)
    missing_layers = [
        f"{side} {function}"
        for side, function in sorted(
            required_layers - available_layers
        )
    ]

    if stack.outline is None:
        missing_layers.append("mechanical outline")

    parser_warnings = list(
        dict.fromkeys(
            str(item.message)
            for item in caught_warnings
        )
    )

    return {
        "board": board,
        "graphic_layers": graphic_layers,
        "drill_layers": drill_layers,
        "has_outline": stack.outline is not None,
        "missing_layers": missing_layers,
        "warnings": parser_warnings,
    }


def inspect_gerber_archive(archive_path: Path) -> dict:
    validate_archive_path(archive_path)

    with TemporaryDirectory(
        prefix="erp_addon_gerbers_"
    ) as temporary_directory:
        extracted_directory = Path(temporary_directory)

        extract_archive(
            archive_path,
            extracted_directory,
        )
        validate_extracted_directory(extracted_directory)

        return inspect_extracted_gerbers(
            extracted_directory
        )

def get_extracted_layer_path(
    layer: object,
    extracted_directory: Path,
) -> Path:
    source_path = (
        getattr(layer, "original_path", None)
        or getattr(layer, "filename", None)
    )

    if source_path is None:
        raise GerberAnalysisError(
            "Não foi possível localizar uma camada Gerber."
        )

    candidate = Path(str(source_path))

    if not candidate.is_absolute():
        candidate = extracted_directory / candidate

    if candidate.is_file():
        return candidate.resolve()

    matching_files = [
        path
        for path in extracted_directory.rglob(candidate.name)
        if path.is_file()
    ]

    if len(matching_files) == 1:
        return matching_files[0].resolve()

    raise GerberAnalysisError(
        f"Não foi possível localizar a camada {candidate.name}."
    )

def create_pygerber_project(
    stack: LayerStack,
    extracted_directory: Path,
    side: str,
) -> Project:
    project_files: list[GerberFile] = []

    for layer_function in ("copper", "mask", "silk"):
        layer = stack.graphic_layers.get(
            (side, layer_function)
        )

        if layer is None:
            continue

        layer_path = get_extracted_layer_path(
            layer,
            extracted_directory,
        )

        project_files.append(
            GerberFile.from_file(
                layer_path,
                file_type=PYGERBER_LAYER_TYPES[
                    layer_function
                ],
            )
        )

    if not project_files:
        raise GerberAnalysisError(
            f"Não foram encontradas camadas para a face {side}."
        )

    return Project(project_files)

def crop_preview_to_board(
    image: Image.Image,
) -> Image.Image:
    rgb_image = image.convert("RGB")

    background_color = rgb_image.getpixel((0, 0))
    background = Image.new(
        "RGB",
        rgb_image.size,
        background_color,
    )

    difference = ImageChops.difference(
        rgb_image,
        background,
    )

    red, green, blue = difference.split()

    content_mask = ImageChops.lighter(
        ImageChops.lighter(red, green),
        blue,
    ).point(
        lambda value: 255 if value >= 8 else 0
    )

    content_bounds = content_mask.getbbox()

    if content_bounds is None:
        return image.copy()

    left, top, right, bottom = content_bounds

    margin = max(
        20,
        round(
            max(
                right - left,
                bottom - top,
            )
            * 0.02
        ),
    )

    crop_bounds = (
        max(0, left - margin),
        max(0, top - margin),
        min(image.width, right + margin),
        min(image.height, bottom + margin),
    )

    return image.crop(crop_bounds)

def render_gerber_previews(
    archive_path: Path,
) -> dict[str, bytes]:
    validate_archive_path(archive_path)

    with TemporaryDirectory(
        prefix="erp_addon_gerber_render_"
    ) as temporary_directory:
        extracted_directory = Path(temporary_directory)

        extract_archive(
            archive_path,
            extracted_directory,
        )
        validate_extracted_directory(extracted_directory)

        top_path = extracted_directory / "_preview_top.png"
        bottom_path = extracted_directory / "_preview_bottom.png"
        readable_bottom_path = (
            extracted_directory
            / "_preview_bottom_readable.png"
        )

        try:
            with warnings.catch_warnings():
                warnings.simplefilter(
                    "ignore",
                    SyntaxWarning,
                )

                stack = LayerStack.open(extracted_directory)

                top_project = create_pygerber_project(
                    stack,
                    extracted_directory,
                    "top",
                )
                bottom_project = create_pygerber_project(
                    stack,
                    extracted_directory,
                    "bottom",
                )

                top_project.parse().render_raster(
                    top_path,
                    dpmm=PREVIEW_DPMM,
                )

                bottom_project.parse().render_raster(
                    bottom_path,
                    dpmm=PREVIEW_DPMM,
                )

                with Image.open(top_path) as top_image:
                    cropped_top = crop_preview_to_board(
                        top_image
                    )
                    cropped_top.save(
                        top_path,
                        format="PNG",
                    )

                with Image.open(bottom_path) as bottom_image:
                    cropped_bottom = crop_preview_to_board(
                        bottom_image
                    )
                    readable_bottom = ImageOps.mirror(
                        cropped_bottom
                    )
                    readable_bottom.save(
                        readable_bottom_path,
                        format="PNG",
                    )
        except GerberAnalysisError:
            raise
        except Exception as error:
            raise GerberAnalysisError(
                "Não foi possível gerar as vistas da PCB: "
                f"{error}"
            ) from error

        top_content = top_path.read_bytes()
        bottom_content = readable_bottom_path.read_bytes()

        if len(top_content) <= 1000:
            raise GerberAnalysisError(
                "A vista superior gerada parece estar vazia."
            )

        if len(bottom_content) <= 1000:
            raise GerberAnalysisError(
                "A vista inferior gerada parece estar vazia."
            )

        return {
            "pcb_top_preview": top_content,
            "pcb_bottom_preview": bottom_content,
        }


