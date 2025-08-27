from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Alarm(Base):
    __tablename__ = "alarms"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    alarm_time = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    is_repeated = Column(Boolean, default=False)
    repeat_days = Column(String(50), nullable=True)  # "1,2,3,4,5,6,7" 형태로 저장 (월~일)
    sound = Column(String(100), default="default")
    vibration = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    user = relationship("User", back_populates="alarms")
    
    def __repr__(self):
        return f"<Alarm(id={self.id}, user_id={self.user_id}, title='{self.title}', alarm_time={self.alarm_time})>"
