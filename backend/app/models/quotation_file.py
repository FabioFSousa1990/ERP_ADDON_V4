import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base

if TYPE_CHECKING:
    from backend.app.models.quotation_request import QuotationRequest


class QuotationFile(Base):
    __tablename__ = "quotation_files"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    quotation_request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("quotation_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    original_name: Mapped[str] = mapped_column(
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

    revision: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    quotation_request: Mapped["QuotationRequest"] = relationship(
        "QuotationRequest",
        back_populates="files",
    )