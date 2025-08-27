# 그룹 채팅 관련 Pydantic 스키마
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# 그룹 생성 요청 스키마
class GroupRequestCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    description: Optional[str] = Field(None, max_length=200)
    
    class Config:
        extra = "ignore"

class GroupRequestOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
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
    last_message: Optional[str] = Field(None, alias="lastMessage")
    unread: int = 0
    
    class Config:
        validate_by_name = True

class MyRoomsOut(BaseModel):
    dms: List[RoomSummary]
    groups: List[RoomSummary]
    
    class Config:
        validate_by_name = True

class JoinResponse(BaseModel):
    joined: bool
