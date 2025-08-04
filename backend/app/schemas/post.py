from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# 게시글 기본 정보
class PostBase(BaseModel):
    title: str
    content: str
    category: str  # 일상, 사람, 질문, 행사
    building_name: Optional[str] = None
    building_latitude: Optional[str] = None
    building_longitude: Optional[str] = None

# 게시글 생성용
class PostCreate(PostBase):
    image_urls: Optional[List[str]] = None

# 게시글 업데이트용
class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    building_name: Optional[str] = None
    building_latitude: Optional[str] = None
    building_longitude: Optional[str] = None
    image_urls: Optional[List[str]] = None

# 게시글 응답용 (작성자 정보 포함)
class PostResponse(PostBase):
    id: int
    author_id: int
    author_nickname: str  # 작성자 닉네임
    author_profile_image_url: Optional[str] = None  # 작성자 프로필 이미지 URL
    image_urls: Optional[List[str]] = None
    is_active: bool
    view_count: int
    heart_count: int
    comment_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 게시글 목록 응답용 (간단한 정보만)
class PostListResponse(BaseModel):
    id: int
    title: str
    category: str
    building_name: Optional[str] = None
    building_latitude: Optional[str] = None
    building_longitude: Optional[str] = None
    author_nickname: str
    author_profile_image_url: Optional[str] = None  # 작성자 프로필 이미지 URL
    view_count: int
    heart_count: int
    comment_count: int
    created_at: datetime

    class Config:
        from_attributes = True 