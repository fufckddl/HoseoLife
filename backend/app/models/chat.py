from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class UserRoomLeaveTime(Base):
    __tablename__ = "user_room_leave_time"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)  # rooms.id 참조
    leave_time = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계
    user = relationship("User", back_populates="room_leave_times")
    room = relationship("Room", back_populates="user_leave_times")
    
    # 복합 유니크 인덱스
    __table_args__ = (
        {"extend_existing": True}
    )
