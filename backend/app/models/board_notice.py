from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class BoardNotice(Base):
    __tablename__ = "board_notices"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_pinned = Column(Boolean, default=True, nullable=False)  # 상단 고정 여부
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    # 🔧 board 관계 제거 (순환 참조 문제 해결, 직접 SQL 사용)
    author = relationship("User")

    def __repr__(self):
        return f"<BoardNotice(id={self.id}, board_id={self.board_id}, title='{self.title}', is_pinned={self.is_pinned})>"
