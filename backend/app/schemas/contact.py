from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 문의 생성용
class ContactCreate(BaseModel):
    subject: str
    message: str
    category: Optional[str] = "일반"

# 문의 응답용
class ContactResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    message: str
    category: str
    status: str
    priority: str
    admin_response: Optional[str] = None
    admin_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_read: bool
    is_answered: bool
    user_nickname: Optional[str] = None
    admin_nickname: Optional[str] = None

    class Config:
        from_attributes = True

# 문의 업데이트용 (관리자)
class ContactUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    admin_response: Optional[str] = None
    is_read: Optional[bool] = None
    is_answered: Optional[bool] = None

# 문의 목록 조회용
class ContactListResponse(BaseModel):
    id: int
    subject: str
    category: str
    status: str
    priority: str
    created_at: datetime
    is_read: bool
    is_answered: bool
    user_nickname: Optional[str] = None

    class Config:
        from_attributes = True 