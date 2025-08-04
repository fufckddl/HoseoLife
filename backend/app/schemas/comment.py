from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    id: int
    content: str
    author_nickname: str
    author_id: int
    author_profile_image_url: Optional[str] = None  # 작성자 프로필 이미지 URL
    created_at: datetime

    class Config:
        from_attributes = True 