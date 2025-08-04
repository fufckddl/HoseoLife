from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class ChatRoomCreate(BaseModel):
    title: str
    purpose: str

class ChatRoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    purpose: str
    created_by: int
    created_at: datetime
    is_active: bool
    is_approved: Optional[bool] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    creator_nickname: str
    creator_profile_image_url: Optional[str] = None
    member_count: int
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None

class ChatRoomDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    purpose: str
    created_by: int
    created_at: datetime
    is_active: bool
    is_approved: Optional[bool] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    creator_nickname: str
    creator_profile_image_url: Optional[str] = None
    members: List[dict]

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    chat_id: int
    sender_id: int
    content: str
    created_at: datetime
    sender_nickname: str
    sender_profile_image_url: Optional[str] = None

# 1:1 채팅 스키마 추가
class DirectMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sender_id: int
    receiver_id: int
    content: str
    created_at: datetime
    is_read: bool
    sender_nickname: str
    sender_profile_image_url: Optional[str] = None
    receiver_nickname: str
    receiver_profile_image_url: Optional[str] = None

class DirectMessageCreate(BaseModel):
    content: str

class DirectChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    other_user_id: int
    other_user_nickname: str
    other_user_profile_image_url: Optional[str] = None
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int

class ChatRoomApprovalRequest(BaseModel):
    is_approved: bool
    admin_response: Optional[str] = None

class ChatRoomListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    pending_rooms: List[ChatRoomResponse]
    approved_rooms: List[ChatRoomResponse]
    total_pending: int
    total_approved: int 