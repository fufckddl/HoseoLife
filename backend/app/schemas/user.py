from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

#회원 정보 공통
class UserBase(BaseModel):
    email: EmailStr
    nickname: str
    university: str
    profile_image_url: Optional[str] = None
    fcm_token: Optional[str] = None

#회원 생성 용
class UserCreate(UserBase):
    password: str

#로그인 용
class UserLogin(BaseModel):
    email: EmailStr
    password: str

#프로필 업데이트 용
class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    university: Optional[str] = None
    profile_image_url: Optional[str] = None
    fcm_token: Optional[str] = None

#FCM 토큰 업데이트 용
class FCMTokenUpdate(BaseModel):
    fcm_token: str

#알림 설정 조회 용
class NotificationSettingsResponse(BaseModel):
    notifications_enabled: bool

#알림 설정 업데이트 용
class NotificationSettingsUpdate(BaseModel):
    notifications_enabled: bool

#비밀번호 변경 용
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

#회원 정보 응답
class UserResponse(UserBase):
    id: int
    is_premium: bool
    created_at: datetime
    is_admin: bool

    class Config:
        from_attributes = True 