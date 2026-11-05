import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class QuotationBomVersion(Base):
    __tablename__ = "quotation_bom_versions"
    __table_args__ = (
        UniqueConstraint(
            "quotation_request_id",
            "version_number",
            name="uq_quotation_bom_versions_request_version",
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

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    source_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    source_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    sheet_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    header_row: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    line_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    placement_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    mounted_placement_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    dnp_placement_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    warning_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        index=True,
    )

    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    lines: Mapped[list["QuotationBomLine"]] = relationship(
        "QuotationBomLine",
        back_populates="bom_version",
        cascade="all, delete-orphan",
        order_by="QuotationBomLine.source_row_number",
    )


class QuotationBomLine(Base):
    __tablename__ = "quotation_bom_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    bom_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "quotation_bom_versions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    source_row_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reference_designator: Mapped[str | None] = mapped_column(
        String(2000),
        nullable=True,
    )

    designators: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    name: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    do_not_place: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )

    footprint: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    manufacturer_reference: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    datasheet: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_valid: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    warnings: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    bom_version: Mapped["QuotationBomVersion"] = relationship(
        "QuotationBomVersion",
        back_populates="lines",
    )