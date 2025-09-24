from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class ShuttleBusBase(BaseModel):
    name: str
    route: str
    time: str
    description: Optional[str] = None
    stops: Optional[List[str]] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    saturday_schedule: Optional[List[Dict[str, Any]]] = None
    sunday_schedule: Optional[List[Dict[str, Any]]] = None
    type: str = "shuttle"
    is_active: Optional[bool] = True

class ShuttleBusCreate(ShuttleBusBase):
    pass

class ShuttleBusUpdate(BaseModel):
    name: Optional[str] = None
    route: Optional[str] = None
    time: Optional[str] = None
    description: Optional[str] = None
    stops: Optional[List[str]] = None
    schedule: Optional[List[Dict[str, Any]]] = None
    saturday_schedule: Optional[List[Dict[str, Any]]] = None
    sunday_schedule: Optional[List[Dict[str, Any]]] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

class ShuttleBusResponse(ShuttleBusBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ShuttleBusListResponse(BaseModel):
    items: List[ShuttleBusResponse]
    total: int
    page: int
    size: int
    pages: int
