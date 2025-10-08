# 그룹 채팅 관련 Pydantic 스키마
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# 그룹 생성 요청 스키마
class GroupRequestCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    description: Optional[str] = Field(None, max_length=200)
    image_url: Optional[str] = Field(None, max_length=500)  # 🆕 그룹 대표 이미지 URL
    
    class Config:
        extra = "ignore"

class GroupRequestOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_url: Optional[str] = Field(None, alias="imageUrl")  # 🆕 그룹 대표 이미지 URL
    requester_id: int = Field(alias="requesterId")
    status: str
    created_at: datetime = Field(alias="createdAt")
    
    class Config:
        from_attributes = True
        validate_by_name = True

class GroupApproveOut(BaseModel):
    room_id: int = Field(alias="roomId")
    status: str
    
    class Config:
        validate_by_name = True

class AvailableGroupOut(BaseModel):
    room_id: int = Field(alias="roomId")
    name: str
    description: Optional[str]
    member_count: int = Field(alias="memberCount")
    
    class Config:
        validate_by_name = True

class RoomSummary(BaseModel):
    room_id: int = Field(alias="roomId")
    name: str
    type: str
    image_url: Optional[str] = Field(None, alias="imageUrl")  # 🆕 채팅방 이미지 URL 추가
    last_message: Optional[str] = Field(None, alias="lastMessage")
    last_message_sender: Optional[str] = Field(None, alias="lastMessageSender")  # 🆕 발신자 정보 추가
    last_message_time: Optional[datetime] = Field(None, alias="lastMessageTime")  # 🆕 마지막 메시지 시간 추가
    unread: int = 0
    
    class Config:
        from_attributes = True
        populate_by_name = True

class MyRoomsOut(BaseModel):
    dms: List[RoomSummary]
    groups: List[RoomSummary]
    
    class Config:
        validate_by_name = True

class JoinResponse(BaseModel):
    joined: bool
