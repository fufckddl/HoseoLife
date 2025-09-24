from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime
from enum import Enum

class CampusType(str, Enum):
    asan = "asan"
    cheonan = "cheonan"

class BuildingType(str, Enum):
    rectangle = "rectangle"
    polygon = "polygon"

class Coordinate(BaseModel):
    latitude: float = Field(..., description="위도")
    longitude: float = Field(..., description="경도")

class BuildingBase(BaseModel):
    name: str = Field(..., description="건물명")
    campus: CampusType = Field(..., description="캠퍼스")
    latitude: float = Field(..., description="중심 위도")
    longitude: float = Field(..., description="중심 경도")
    radius: int = Field(..., description="반지름 (미터)")
    building_type: BuildingType = Field(..., description="건물 형태")
    coordinates: List[Coordinate] = Field(..., description="좌표 배열")
    description: Optional[str] = Field(None, description="건물 설명")

class BuildingCreate(BuildingBase):
    id: str = Field(..., description="건물 ID")

class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    campus: Optional[CampusType] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[int] = None
    building_type: Optional[BuildingType] = None
    coordinates: Optional[List[Coordinate]] = None
    description: Optional[str] = None

class BuildingResponse(BuildingBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
