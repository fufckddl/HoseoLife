from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class BoardNoticeBase(BaseModel):
    title: str
    content: str
    is_pinned: bool = True

class BoardNoticeCreate(BoardNoticeBase):
    board_id: int

class BoardNoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None

class BoardNoticeResponse(BoardNoticeBase):
    id: int
    board_id: int
    author_id: int
    author_nickname: Optional[str] = None  # 작성자 닉네임
    author_profile_image_url: Optional[str] = None  # 🆕 작성자 프로필 이미지 URL
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
