from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# 채팅방 스키마
class ChatRoomBase(BaseModel):
    name: Optional[str] = None
    type: str = "dm"  # "dm" 또는 "group"
    members: List[int] = []

class ChatRoomCreate(ChatRoomBase):
    pass

class ChatRoomResponse(ChatRoomBase):
    id: int
    created_by: int
    created_at: datetime
    is_active: bool
    last_message: Optional[dict] = None
    other_user: Optional[dict] = None
    
    class Config:
        from_attributes = True

# 메시지 스키마
class ChatMessageBase(BaseModel):
    text: str
    client_msg_id: Optional[str] = Field(None, alias="clientMsgId")

class ChatMessageCreate(ChatMessageBase):
    # room_id는 URL 경로에서 가져오므로 요청 본문에서는 제외
    pass

class ChatMessageResponse(BaseModel):
    id: int
    room_id: int
    content: str  # DB 필드명 유지
    client_msg_id: Optional[str] = None  # DB 필드명 유지
    sender_id: int
    sent_at: datetime
    is_deleted: bool
    
    class Config:
        from_attributes = True
        allow_population_by_field_name = True
        extra = "ignore"

# WebSocket 메시지 스키마
class WSMessage(BaseModel):
    type: str  # "join", "leave", "message", "typing", "read_receipt", "pong"
    room_id: Optional[int] = None
    user_id: Optional[int] = None
    content: Optional[str] = None
    client_msg_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    is_typing: Optional[bool] = None
    message_id: Optional[int] = None

# 푸시 알림 등록 스키마
class PushTokenRegister(BaseModel):
    expo_push_token: str
