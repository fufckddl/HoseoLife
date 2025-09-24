# 그룹 채팅 관련 데이터베이스 모델
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class GroupStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class RoomStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

class UserRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class GroupCreationRequest(Base):
    __tablename__ = "group_creation_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(40), nullable=False)
    description = Column(Text(200), nullable=True)
    image_url = Column(String(500), nullable=True)  # 🆕 그룹 대표 이미지 URL
    status = Column(Enum(GroupStatus), default=GroupStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    
    # 관계 (순환 임포트 방지를 위해 주석 처리)
    # requester = relationship("User", back_populates="group_requests")

class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), nullable=False)  # "dm" 또는 "group"
    name = Column(String(40), nullable=True)
    description = Column(Text(200), nullable=True)
    image_url = Column(String(500), nullable=True)  # 🆕 그룹 대표 이미지 URL
    status = Column(Enum(RoomStatus), default=RoomStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # 관계
    memberships = relationship("Membership", back_populates="room", cascade="all, delete-orphan")
    user_leave_times = relationship("UserRoomLeaveTime", back_populates="room", cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = "memberships"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.MEMBER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # 멤버십 활성화 여부
    # 방 별 알림 설정 (true: 알림 받음, false: 알림 끔)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # 관계
    room = relationship("Room", back_populates="memberships")
    user = relationship("User", back_populates="memberships")
    
    # 복합 유니크 인덱스
    __table_args__ = (
        {"extend_existing": True}
    )

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    # 시스템 메시지 지원: sender_id를 NULL 허용
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    # 이미지 메시지 지원: 이미지 URL 배열(JSON 문자열로 저장)
    image_urls = Column(Text, nullable=True)
    client_msg_id = Column(String(100), nullable=True)  # 클라이언트 메시지 ID
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False)
    
    # 관계
    sender = relationship("User", foreign_keys=[sender_id])
    room = relationship("Room")
