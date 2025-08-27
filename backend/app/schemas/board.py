from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class BoardCreate(BaseModel):
    name: str
    description: str

class BoardResponse(BaseModel):
    id: int
    name: str
    description: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class BoardListResponse(BaseModel):
    boards: List[BoardResponse]
