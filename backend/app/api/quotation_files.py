import hashlib
import uuid
from pathlib import Path
from typing import Annotated
import mimetypes
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from datetime import datetime
from backend.app.core.config import settings
from backend.app.database import get_db
from backend.app.models.quotation_file import QuotationFile
from backend.app.models.quotation_request import QuotationRequest
from backend.app.schemas.quotation_file import (
    QuotationFileListResponse,
    QuotationFileRead,
    QuotationFileType,
    QuotationFileUpdate,
)
from backend.app.schemas.source_folder import (
    SourceDirectoryEntry,
    SourceFileCandidate,
    SourceFileImportItem,
    SourceFolderBrowseResponse,
    SourceFolderImportRequest,
    SourceFolderImportResponse,
    SourceFolderScanResponse,
    SourceRootOption,
)

from backend.app.schemas.gerber_analysis import (
    GerberAnalysisResponse,
)
from backend.app.services.gerber_analysis import (
    GerberAnalysisError,
    inspect_gerber_archive,
)


router = APIRouter(tags=["quotation files"])

DatabaseSession = Annotated[Session, Depends(get_db)]

MAX_FILE_SIZE = 100 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024
MAX_SOURCE_FILES = 500
MAX_SOURCE_DIRECTORIES = 500

GERBER_EXTENSIONS = {
    ".gbr",
    ".ger",
    ".gtl",
    ".gbl",
    ".gts",
    ".gbs",
    ".gto",
    ".gbo",
    ".gm1",
    ".gko",
    ".drl",
    ".xln",
}

IGNORED_SUFFIXES = {
    ".tmp",
    ".bak",
    ".uploading",
}


def get_allowed_source_roots() -> list[Path]:
    return [
        Path(value.strip()).resolve()
        for value in settings.source_roots.split(";")
        if value.strip()
    ]

def get_source_folder(quotation: QuotationRequest) -> Path:
    if not quotation.source_folder_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cotação não tem uma pasta de origem definida.",
        )

    source_folder = Path(quotation.source_folder_path).resolve()

    allowed = any(
        source_folder == root or source_folder.is_relative_to(root)
        for root in get_allowed_source_roots()
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "A pasta indicada está fora das localizações "
                "autorizadas."
            ),
        )

    if not source_folder.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A pasta de origem não foi encontrada.",
        )

    if not source_folder.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O caminho indicado não corresponde a uma pasta.",
        )

    return source_folder

def classify_source_file(file_path: Path) -> QuotationFileType:
    name = file_path.name.lower()
    path_text = file_path.as_posix().lower()
    suffix = file_path.suffix.lower()

    if suffix in GERBER_EXTENSIONS:
        return "gerbers"

    if "gerber" in path_text:
        return "gerbers"

    if any(
        keyword in path_text
        for keyword in {
            "bom",
            "bill of material",
            "bill_of_material",
            "bill-of-material",
        }
    ):
        return "bom"

    if any(
        keyword in path_text
        for keyword in {
            "pickplace",
            "pick_place",
            "pick-place",
            "pick and place",
            "centroid",
            "pnp",
            "coordinate",
            "coordinates",
        }
    ):
        return "pick_place"

    if any(
        keyword in path_text
        for keyword in {
            "assembly",
            "assy",
            "placement",
            "implantation",
        }
    ):
        return "assembly"

    if any(
        keyword in path_text
        for keyword in {
            "drawing",
            "desenho",
            "mechanical",
            "mecânico",
            "mecanico",
        }
    ):
        return "drawing"

    return "other"

def get_quotation_or_404(
    quotation_request_id: uuid.UUID,
    database: Session,
) -> QuotationRequest:
    quotation = database.get(
        QuotationRequest,
        quotation_request_id,
    )

    if quotation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de cotação não encontrado.",
        )

    return quotation

def get_file_or_404(
    file_id: uuid.UUID,
    database: Session,
) -> QuotationFile:
    quotation_file = database.get(QuotationFile, file_id)

    if quotation_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ficheiro não encontrado.",
        )

    return quotation_file

def normalize_original_name(filename: str | None) -> str:
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    original_name = Path(filename).name.strip()

    if not original_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro não tem um nome válido.",
        )

    return original_name[:500]

def get_storage_path(quotation_file: QuotationFile) -> Path:
    storage_root = Path(settings.storage_root).resolve()
    file_path = (
        storage_root / quotation_file.relative_path
    ).resolve()

    if storage_root not in file_path.parents:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Caminho de armazenamento inválido.",
        )

    return file_path

@router.get(
    "/source-folders/browse",
    response_model=SourceFolderBrowseResponse,
)
def browse_source_folders(
    root_index: Annotated[int, Query(ge=0)] = 0,
    relative_path: str = "",
) -> SourceFolderBrowseResponse:
    roots = get_allowed_source_roots()

    if not roots:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não existem pastas de origem configuradas.",
        )

    if root_index >= len(roots):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A raiz indicada não é válida.",
        )

    root = roots[root_index]

    if not root.exists() or not root.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A raiz configurada não está disponível.",
        )

    current_path = (root / relative_path).resolve()

    if not (
        current_path == root
        or current_path.is_relative_to(root)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não é permitido navegar fora da raiz autorizada.",
        )

    if not current_path.exists() or not current_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A pasta indicada não foi encontrada.",
        )

    directories: list[SourceDirectoryEntry] = []

    try:
        children = sorted(
            (
                child
                for child in current_path.iterdir()
                if (
                    child.is_dir()
                    and not child.is_symlink()
                    and not child.name.startswith(".")
                )
            ),
            key=lambda child: child.name.lower(),
        )

        for child in children[:MAX_SOURCE_DIRECTORIES]:
            directories.append(
                SourceDirectoryEntry(
                    name=child.name,
                    relative_path=(
                        child.relative_to(root).as_posix()
                    ),
                )
            )
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não foi possível aceder a esta pasta.",
        ) from error

    current_relative_path = (
        current_path.relative_to(root).as_posix()
    )

    if current_relative_path == ".":
        current_relative_path = ""

    parent_relative_path: str | None = None

    if current_path != root:
        parent_relative_path = (
            current_path.parent.relative_to(root).as_posix()
        )

        if parent_relative_path == ".":
            parent_relative_path = ""

    root_options = [
        SourceRootOption(
            index=index,
            name=source_root.name or str(source_root),
            path=str(source_root),
        )
        for index, source_root in enumerate(roots)
    ]

    return SourceFolderBrowseResponse(
        roots=root_options,
        root_index=root_index,
        root_path=str(root),
        current_path=str(current_path),
        current_relative_path=current_relative_path,
        parent_relative_path=parent_relative_path,
        directories=directories,
    )

@router.post(
    "/quotation-requests/{quotation_request_id}/source-folder/scan",
    response_model=SourceFolderScanResponse,
)
def scan_quotation_source_folder(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
) -> SourceFolderScanResponse:
    quotation = get_quotation_or_404(
        quotation_request_id,
        database,
    )
    source_folder = get_source_folder(quotation)
    imported_signatures = {
        (original_name.lower(), size_bytes)
        for original_name, size_bytes in database.execute(
            select(
                QuotationFile.original_name,
                QuotationFile.size_bytes,
            ).where(
                QuotationFile.quotation_request_id
                == quotation_request_id
            )
        ).all()
    }

    items: list[SourceFileCandidate] = []
    truncated = False

    for candidate in source_folder.rglob("*"):
        if len(items) >= MAX_SOURCE_FILES:
            truncated = True
            break

        try:
            if not candidate.is_file() or candidate.is_symlink():
                continue

            relative_path = candidate.relative_to(source_folder)

            if any(part.startswith(".") for part in relative_path.parts):
                continue

            if candidate.name.startswith("~$"):
                continue

            if candidate.suffix.lower() in IGNORED_SUFFIXES:
                continue

            file_stat = candidate.stat()

            items.append(
                SourceFileCandidate(
                    relative_path=relative_path.as_posix(),
                    name=candidate.name,
                    size_bytes=file_stat.st_size,
                    modified_at=datetime.fromtimestamp(
                        file_stat.st_mtime
                    ).astimezone(),
                    suggested_type=classify_source_file(candidate),
                    already_imported=(
                        candidate.name.lower(),
                        file_stat.st_size,
                    ) in imported_signatures,
                )
            )
        except (OSError, ValueError):
            continue

    items.sort(
        key=lambda item: (
            item.suggested_type,
            item.relative_path.lower(),
        )
    )

    return SourceFolderScanResponse(
        source_folder_path=str(source_folder),
        items=items,
        total=len(items),
        truncated=truncated,
    )

@router.post(
    "/quotation-requests/{quotation_request_id}/source-folder/import",
    response_model=SourceFolderImportResponse,
)
def import_quotation_source_files(
    quotation_request_id: uuid.UUID,
    payload: SourceFolderImportRequest,
    database: DatabaseSession,
) -> SourceFolderImportResponse:
    quotation = get_quotation_or_404(
        quotation_request_id,
        database,
    )
    source_folder = get_source_folder(quotation)

    relative_directory = (
        Path("quotation_requests")
        / str(quotation_request_id)
    )

    storage_root = Path(settings.storage_root).resolve()
    target_directory = storage_root / relative_directory
    target_directory.mkdir(parents=True, exist_ok=True)

    imported_files: list[QuotationFile] = []
    created_paths: list[Path] = []
    temporary_paths: list[Path] = []
    skipped_duplicates = 0

    try:
        for item in payload.items:
            source_path = (
                source_folder / item.relative_path
            ).resolve()

            if not source_path.is_relative_to(source_folder):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Foi indicado um caminho fora da pasta "
                        "de origem."
                    ),
                )

            if (
                not source_path.is_file()
                or source_path.is_symlink()
            ):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        f"O ficheiro {item.relative_path} "
                        "não foi encontrado."
                    ),
                )

            original_name = source_path.name[:500]
            suffix = source_path.suffix.lower()[:20]
            stored_name = f"{uuid.uuid4().hex}{suffix}"

            relative_path = (
                relative_directory / stored_name
            )
            target_path = target_directory / stored_name
            temporary_path = (
                target_directory / f"{stored_name}.importing"
            )
            temporary_paths.append(temporary_path)

            file_size = 0
            digest = hashlib.sha256()

            with source_path.open("rb") as source:
                with temporary_path.open("wb") as destination:
                    while chunk := source.read(CHUNK_SIZE):
                        file_size += len(chunk)

                        if file_size > MAX_FILE_SIZE:
                            raise HTTPException(
                                status_code=(
                                    status.HTTP_413_CONTENT_TOO_LARGE
                                ),
                                detail=(
                                    f"O ficheiro {original_name} "
                                    "excede o limite de 100 MB."
                                ),
                            )

                        digest.update(chunk)
                        destination.write(chunk)

            file_hash = digest.hexdigest()

            duplicate = database.scalar(
                select(QuotationFile).where(
                    QuotationFile.quotation_request_id
                    == quotation_request_id,
                    QuotationFile.sha256 == file_hash,
                )
            )

            if duplicate is not None:
                temporary_path.unlink(missing_ok=True)
                temporary_paths.remove(temporary_path)
                skipped_duplicates += 1
                continue

            temporary_path.replace(target_path)
            temporary_paths.remove(temporary_path)
            created_paths.append(target_path)

            media_type, _ = mimetypes.guess_type(original_name)

            quotation_file = QuotationFile(
                quotation_request_id=quotation_request_id,
                file_type=item.file_type,
                original_name=original_name,
                stored_name=stored_name,
                relative_path=relative_path.as_posix(),
                media_type=media_type,
                size_bytes=file_size,
                sha256=file_hash,
                revision=(
                    item.revision.strip()
                    if item.revision
                    else None
                ),
                notes=(
                    item.notes.strip()
                    if item.notes
                    else None
                ),
            )

            database.add(quotation_file)
            database.flush()
            imported_files.append(quotation_file)

        database.commit()

        for quotation_file in imported_files:
            database.refresh(quotation_file)

        return SourceFolderImportResponse(
            items=imported_files,
            imported=len(imported_files),
            skipped_duplicates=skipped_duplicates,
        )
    except Exception:
        database.rollback()

        for temporary_path in temporary_paths:
            temporary_path.unlink(missing_ok=True)

        for created_path in created_paths:
            created_path.unlink(missing_ok=True)

        raise

@router.get(
    "/quotation-requests/{quotation_request_id}/files",
    response_model=QuotationFileListResponse,
)
def list_quotation_files(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
    file_type: QuotationFileType | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> QuotationFileListResponse:
    get_quotation_or_404(quotation_request_id, database)

    filters = [
        QuotationFile.quotation_request_id
        == quotation_request_id
    ]

    if file_type is not None:
        filters.append(QuotationFile.file_type == file_type)

    total = database.scalar(
        select(func.count())
        .select_from(QuotationFile)
        .where(*filters)
    ) or 0

    files = list(
        database.scalars(
            select(QuotationFile)
            .where(*filters)
            .order_by(QuotationFile.uploaded_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    return QuotationFileListResponse(
        items=files,
        total=total,
    )

@router.post(
    "/quotation-files/{file_id}/analyze-gerbers",
    response_model=GerberAnalysisResponse,
)
def analyze_gerber_file(
    file_id: uuid.UUID,
    database: DatabaseSession,
) -> GerberAnalysisResponse:
    quotation_file = get_file_or_404(file_id, database)

    if quotation_file.file_type != "gerbers":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A análise Gerber só pode ser executada "
                "em ficheiros do tipo Gerbers."
            ),
        )

    file_path = get_storage_path(quotation_file)

    try:
        metadata = inspect_gerber_archive(file_path)
    except GerberAnalysisError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    return GerberAnalysisResponse(
        quotation_file_id=quotation_file.id,
        original_name=quotation_file.original_name,
        metadata=metadata,
    )

@router.post(
    "/quotation-requests/{quotation_request_id}/files",
    response_model=QuotationFileRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_quotation_file(
    quotation_request_id: uuid.UUID,
    database: DatabaseSession,
    file_type: Annotated[QuotationFileType, Form()],
    file: Annotated[UploadFile, File()],
    revision: Annotated[str | None, Form()] = None,
    notes: Annotated[str | None, Form()] = None,
) -> QuotationFile:
    get_quotation_or_404(quotation_request_id, database)

    original_name = normalize_original_name(file.filename)
    suffix = Path(original_name).suffix.lower()[:20]
    stored_name = f"{uuid.uuid4().hex}{suffix}"

    relative_directory = (
        Path("quotation_requests")
        / str(quotation_request_id)
    )
    relative_path = relative_directory / stored_name

    storage_root = Path(settings.storage_root).resolve()
    target_directory = storage_root / relative_directory
    target_directory.mkdir(parents=True, exist_ok=True)

    target_path = target_directory / stored_name
    temporary_path = target_directory / f"{stored_name}.uploading"

    file_size = 0
    digest = hashlib.sha256()

    try:
        with temporary_path.open("wb") as destination:
            while chunk := file.file.read(CHUNK_SIZE):
                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail="O ficheiro excede o limite de 100 MB.",
                    )

                digest.update(chunk)
                destination.write(chunk)

        file_hash = digest.hexdigest()

        duplicate = database.scalar(
            select(QuotationFile).where(
                QuotationFile.quotation_request_id
                == quotation_request_id,
                QuotationFile.sha256 == file_hash,
            )
        )

        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Este ficheiro já está associado "
                    "ao pedido de cotação."
                ),
            )

        temporary_path.replace(target_path)

        quotation_file = QuotationFile(
            quotation_request_id=quotation_request_id,
            file_type=file_type,
            original_name=original_name,
            stored_name=stored_name,
            relative_path=relative_path.as_posix(),
            media_type=file.content_type,
            size_bytes=file_size,
            sha256=file_hash,
            revision=revision.strip() if revision else None,
            notes=notes.strip() if notes else None,
        )

        database.add(quotation_file)
        database.commit()
        database.refresh(quotation_file)

        return quotation_file
    except Exception:
        database.rollback()

        if temporary_path.exists():
            temporary_path.unlink()

        if target_path.exists():
            target_path.unlink()

        raise

@router.get(
    "/quotation-files/{file_id}/download",
    response_class=FileResponse,
)
def download_quotation_file(
    file_id: uuid.UUID,
    database: DatabaseSession,
) -> FileResponse:
    quotation_file = get_file_or_404(file_id, database)
    file_path = get_storage_path(quotation_file)

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O ficheiro físico não foi encontrado.",
        )

    return FileResponse(
        path=file_path,
        media_type=quotation_file.media_type,
        filename=quotation_file.original_name,
    )

@router.patch(
    "/quotation-files/{file_id}",
    response_model=QuotationFileRead,
)
def update_quotation_file(
    file_id: uuid.UUID,
    payload: QuotationFileUpdate,
    database: DatabaseSession,
) -> QuotationFile:
    quotation_file = get_file_or_404(file_id, database)
    changes = payload.model_dump(exclude_unset=True)

    if "file_type" in changes and changes["file_type"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O tipo do ficheiro não pode ficar vazio.",
        )

    for field in {"revision", "notes"}:
        value = changes.get(field)

        if isinstance(value, str):
            changes[field] = value.strip() or None

    for field, value in changes.items():
        setattr(quotation_file, field, value)

    database.commit()
    database.refresh(quotation_file)

    return quotation_file

@router.delete(
    "/quotation-files/{file_id}",
    response_model=QuotationFileRead,
)
def delete_quotation_file(
    file_id: uuid.UUID,
    database: DatabaseSession,
) -> QuotationFile:
    quotation_file = get_file_or_404(file_id, database)
    file_path = get_storage_path(quotation_file)

    if file_path.exists():
        file_path.unlink()

    database.delete(quotation_file)
    database.commit()

    return quotation_file