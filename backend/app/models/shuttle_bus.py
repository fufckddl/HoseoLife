from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class ShuttleBus(Base):
    __tablename__ = "shuttle_buses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="셔틀버스 노선명")
    route = Column(String(200), nullable=False, comment="노선 경로")
    time = Column(String(200), nullable=False, comment="운행 시간 정보")
    description = Column(Text, comment="노선 설명")
    stops = Column(JSON, comment="경유 정류소 목록")
    schedule = Column(JSON, comment="평일 시간표")
    saturday_schedule = Column(JSON, comment="토요일 시간표")
    sunday_schedule = Column(JSON, comment="일요일 시간표")
    type = Column(String(20), nullable=False, default="shuttle", comment="버스 타입 (shuttle/city)")
    is_active = Column(Boolean, default=True, comment="운행 여부")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
