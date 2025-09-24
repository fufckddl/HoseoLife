from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class UserSchedule(Base):
    __tablename__ = "user_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="시간표 이름")
    description = Column(Text, nullable=True, comment="시간표 설명")
    semester = Column(String(20), nullable=True, comment="학기 (예: 2024-1, 2024-2)")
    year = Column(Integer, nullable=True, comment="학년도")
    is_active = Column(Boolean, default=True, comment="활성 시간표 여부")
    is_default = Column(Boolean, default=False, comment="기본 시간표 여부")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="사용자 ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="수정일시")

    # 관계 설정 (순환 참조 방지를 위해 back_populates 제거)
    # user = relationship("User", lazy="select")  # 임시 비활성화
    # courses = relationship("Course", back_populates="user_schedule", cascade="all, delete-orphan", lazy="select")  # 임시 비활성화

    def __repr__(self):
        return f"<UserSchedule(id={self.id}, name='{self.name}', user_id={self.user_id}, is_active={self.is_active})>"
