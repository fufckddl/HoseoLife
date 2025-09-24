from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Notification(Base):
    """사용자 알림 기록 모델"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 받는 사용자
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # user = relationship("User", back_populates="notifications")  # 🔧 순환 참조 방지를 위해 주석 처리
    
    # 알림 기본 정보
    title = Column(String(255), nullable=False)  # 알림 제목
    message = Column(Text, nullable=False)  # 알림 내용
    notification_type = Column(String(50), nullable=False)  # 알림 타입 (comment, heart, chat, news, hot_post)
    
    # 관련 데이터 (JSON 형태)
    data = Column(Text, nullable=True)  # 관련 데이터 (post_id, room_id 등)
    
    # 읽음 상태
    is_read = Column(Boolean, default=False)  # 읽음 여부
    read_at = Column(DateTime(timezone=True), nullable=True)  # 읽은 시간
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type='{self.notification_type}', title='{self.title}', is_read={self.is_read})>"
