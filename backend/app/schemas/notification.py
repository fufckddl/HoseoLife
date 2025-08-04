from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationCreate(BaseModel):
    title: str
    content: str
    category: str
    image_url: Optional[str] = None

class NotificationResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    image_url: Optional[str] = None
    created_at: datetime
    user_id: Optional[int]
    view_count: int

    class Config:
        from_attributes = True 