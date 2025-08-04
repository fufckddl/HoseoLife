from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.db.database import Base

#회원 정보 모델
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    nickname = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_premium = Column(Boolean, default=False)
    university = Column(String(50), nullable=False, default='')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_admin = Column(Boolean, default=False)
    fcm_token = Column(String(255), nullable=True)
    profile_image_url = Column(String(500), nullable=True)
    notifications_enabled = Column(Boolean, default=True)  # 알림 활성화 여부
    
    # 게시글 관계
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    
    # 댓글 관계
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    
    # 좋아요 관계
    hearts = relationship("Heart", back_populates="user", cascade="all, delete-orphan")
    
    # 조회 기록 관계
    view_logs = relationship("ViewLog", back_populates="user", cascade="all, delete-orphan")
    
    # 문의 관계 (양방향 관계, lazy loading 사용)
    contacts = relationship("Contact", foreign_keys="Contact.user_id", back_populates="user", cascade="all, delete-orphan", lazy="select")
    
    # 채팅 관계 (문자열로 참조하여 순환 import 방지)
    created_chats = relationship("ChatRoom", foreign_keys="ChatRoom.created_by", back_populates="creator")
    chat_rooms = relationship("ChatRoom", secondary="chat_members", back_populates="members")
    sent_messages = relationship("ChatMessage", back_populates="sender", cascade="all, delete-orphan")
    
    # 채팅 관계
    created_chats = relationship("ChatRoom", foreign_keys="ChatRoom.created_by", back_populates="creator")
    chat_rooms = relationship("ChatRoom", secondary="chat_members", back_populates="members")
    sent_messages = relationship("ChatMessage", back_populates="sender", cascade="all, delete-orphan")

