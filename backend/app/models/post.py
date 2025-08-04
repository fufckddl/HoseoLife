from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

# 게시글 모델
class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)  # 제목
    content = Column(Text, nullable=False)  # 내용
    category = Column(String(20), nullable=False)  # 카테고리 (일상, 사람, 질문, 행사)
    building_name = Column(String(100), nullable=True)  # 건물명
    building_latitude = Column(String(20), nullable=True)  # 건물 위도
    building_longitude = Column(String(20), nullable=True)  # 건물 경도
    
    # 작성자 정보 (외래키)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author = relationship("User", back_populates="posts")
    
    # 댓글 관계
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    
    # 좋아요 관계
    hearts = relationship("Heart", back_populates="post", cascade="all, delete-orphan")
    
    # 조회 기록 관계
    view_logs = relationship("ViewLog", back_populates="post", cascade="all, delete-orphan")
    
    # 이미지 관련 (나중에 확장 가능)
    image_urls = Column(Text, nullable=True)  # JSON 형태로 여러 이미지 URL 저장
    
    # 게시글 상태
    is_active = Column(Boolean, default=True)  # 활성/비활성 상태
    
    # 조회수, 좋아요, 댓글 수
    view_count = Column(Integer, default=0)  # 조회수
    heart_count = Column(Integer, default=0)  # 좋아요 수
    comment_count = Column(Integer, default=0)  # 댓글 수
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 