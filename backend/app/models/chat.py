from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

# 채팅방 멤버 관계 테이블 (다대다)
chat_room_members = Table(
    'chat_room_members',
    Base.metadata,
    Column('room_id', Integer, ForeignKey('chat_rooms.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('joined_at', DateTime(timezone=True), server_default=func.now()),
    Column('last_read_at', DateTime(timezone=True), nullable=True)
)

class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)  # 그룹 채팅방 이름 (1:1은 null)
    type = Column(String(20), nullable=False, default="dm")  # "dm" 또는 "group"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # 관계
    creator = relationship("User")

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
    
    # 새로운 Room 모델과의 관계
    room = relationship("Room")
