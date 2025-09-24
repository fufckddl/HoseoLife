from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None  # 대댓글인 경우 부모 댓글 ID

class CommentResponse(BaseModel):
    id: int
    content: str
    author_nickname: str
    author_id: int
    author_profile_image_url: Optional[str] = None  # 작성자 프로필 이미지 URL
    parent_id: Optional[int] = None  # 부모 댓글 ID
    depth: int = 0  # 댓글 깊이
    replies: List['CommentResponse'] = []  # 대댓글 목록
    created_at: datetime

    class Config:
        from_attributes = True

# 순환 참조 해결을 위한 forward reference
CommentResponse.model_rebuild() 