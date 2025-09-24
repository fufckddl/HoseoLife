from sqlalchemy import Column, String, Float, Integer, Text, DateTime, Enum, JSON
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class CampusType(str, enum.Enum):
    asan = "asan"
    cheonan = "cheonan"

class BuildingType(str, enum.Enum):
    rectangle = "rectangle"
    polygon = "polygon"

class Building(Base):
    __tablename__ = "buildings"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    campus = Column(Enum(CampusType), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius = Column(Integer, nullable=False)
    building_type = Column(Enum(BuildingType), nullable=False)
    coordinates = Column(JSON, nullable=False)  # 좌표 배열을 JSON으로 저장
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
