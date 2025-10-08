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
    is_active = Column(Boolean, default=True)  # 사용자 활성화 여부
    
    # 게시글 관계 (🔧 탈퇴 시 데이터 유지)
    posts = relationship("Post", back_populates="author")
    
    # 댓글 관계 (🔧 탈퇴 시 데이터 유지)
    comments = relationship("Comment", back_populates="author")
    
    # 좋아요 관계 (🔧 탈퇴 시 데이터 유지)
    hearts = relationship("Heart", back_populates="user")
    
    # 스크랩 관계 (🔧 탈퇴 시 데이터 유지)
    scraps = relationship("Scrap", back_populates="user")
    
    # 조회 기록 관계 (🔧 탈퇴 시 데이터 유지)
    view_logs = relationship("ViewLog", back_populates="user")
    
    # 문의 관계 (🔧 탈퇴 시 데이터 유지)
    contacts = relationship("Contact", foreign_keys="Contact.user_id", back_populates="user", lazy="select")
    
    # 알람 관계 (🔧 탈퇴 시 데이터 유지)
    alarms = relationship("Alarm", back_populates="user")
    
    # 🆕 알림 기록 관계 (순환 참조 방지를 위해 주석 처리)
    # notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    # 채팅 관계 (새로운 Room 모델 사용)
    sent_messages = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id")
    
    # 채팅방 멤버십 관계
    memberships = relationship("Membership", back_populates="user")
    
    # 채팅방 나간 시간 관계 (🔧 탈퇴 시 데이터 유지)
    room_leave_times = relationship("UserRoomLeaveTime", back_populates="user")
    
    # 강의 시간표 관계는 나중에 추가 (순환 참조 방지)
    # courses = relationship("Course", back_populates="user", cascade="all, delete-orphan", lazy="select")
    
    # 사용자 시간표 관계는 나중에 추가 (순환 참조 방지)
    # user_schedules = relationship("UserSchedule", back_populates="user", cascade="all, delete-orphan", lazy="select")
    
    # 🆕 차단 관계
    blocking = relationship("Block", foreign_keys="Block.blocker_id", back_populates="blocker", cascade="all, delete-orphan")
    blocked_by = relationship("Block", foreign_keys="Block.blocked_id", back_populates="blocked", cascade="all, delete-orphan")
    
