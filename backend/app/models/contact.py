from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), default="일반")  # 일반, 버그, 기능요청, 기타
    status = Column(String(20), default="대기중")  # 대기중, 처리중, 완료, 답변완료
    priority = Column(String(20), default="보통")  # 낮음, 보통, 높음, 긴급
    admin_response = Column(Text, nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 답변한 관리자
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_read = Column(Boolean, default=False)  # 관리자가 읽었는지 여부
    is_answered = Column(Boolean, default=False)  # 답변이 완료되었는지 여부

    # 관계 설정 (양방향 관계, lazy loading 사용)
    user = relationship("User", foreign_keys=[user_id], back_populates="contacts", lazy="select")
    admin = relationship("User", foreign_keys=[admin_id], lazy="select") 