from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class NewsCreate(BaseModel):
    title: str
    content: str
    category: str

class NewsResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    image_urls: Optional[List[str]] = None
    created_at: datetime
    user_id: Optional[int]
    view_count: int

    class Config:
        from_attributes = True 