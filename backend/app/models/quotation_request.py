import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    Date,
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
    from backend.app.models.quotation_quantity import QuotationQuantity
    from backend.app.models.quotation_file import QuotationFile

class QuotationRequest(Base):
    __tablename__ = "quotation_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    received_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
        server_default=func.current_date(),
    )

    requested_deadline: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="received",
        server_default="received",
        index=True,
    )

    customer_contact: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    quantities: Mapped[list["QuotationQuantity"]] = relationship(
        "QuotationQuantity",
        back_populates="quotation_request",
        cascade="all, delete-orphan",
        order_by="QuotationQuantity.quantity",
    )

    files: Mapped[list["QuotationFile"]] = relationship(
    "QuotationFile",
    back_populates="quotation_request",
    cascade="all, delete-orphan",
    order_by="QuotationFile.uploaded_at",
    )