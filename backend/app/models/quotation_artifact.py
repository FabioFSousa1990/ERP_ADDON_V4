import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


if TYPE_CHECKING:
    from backend.app.models.quotation_file import QuotationFile
    from backend.app.models.quotation_request import QuotationRequest


class QuotationArtifact(Base):
    __tablename__ = "quotation_artifacts"
    __table_args__ = (
        UniqueConstraint(
            "quotation_request_id",
            "artifact_type",
            "sha256",
            name="uq_quotation_artifacts_request_type_hash",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    quotation_request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "quotation_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    source_file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "quotation_files.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    artifact_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    display_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    stored_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    relative_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
        unique=True,
    )

    media_type: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    generator: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    generation_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="1",
        server_default="1",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    quotation_request: Mapped["QuotationRequest"] = relationship(
        "QuotationRequest",
        back_populates="artifacts",
    )

    source_file: Mapped["QuotationFile | None"] = relationship(
        "QuotationFile",
        back_populates="artifacts",
    )