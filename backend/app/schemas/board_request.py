from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BoardRequestCreate(BaseModel):
    name: str
    description: str

class BoardRequestResponse(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    status: str
    creator_id: int
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True

class BoardRequestUpdate(BaseModel):
    status: str  # approved, rejected
