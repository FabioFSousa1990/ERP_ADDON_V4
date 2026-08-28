import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base

if TYPE_CHECKING:
    from backend.app.models.quotation_request import QuotationRequest

class QuotationQuantity(Base):
    __tablename__ = "quotation_quantities"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_quotation_quantities_quantity_positive",
        ),
        UniqueConstraint(
            "quotation_request_id",
            "quantity",
            name="uq_quotation_quantities_request_quantity",
        ),
    )

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

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    quotation_request: Mapped["QuotationRequest"] = relationship(
        "QuotationRequest",
        back_populates="quantities",
    )