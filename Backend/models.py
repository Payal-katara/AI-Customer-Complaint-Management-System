from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ComplaintRecord(Base):
    __tablename__ = 'complaint_records'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intake_text: Mapped[str] = mapped_column(Text, nullable=False)
    updates: Mapped[dict] = mapped_column(JSON, nullable=False)
    analysis: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
