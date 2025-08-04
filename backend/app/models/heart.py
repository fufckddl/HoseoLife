from sqlalchemy import Column, Integer, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

# 좋아요 모델
class Heart(Base):
    __tablename__ = "hearts"

    id = Column(Integer, primary_key=True, index=True)
    
    # 사용자 정보 (외래키)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("User", back_populates="hearts")
    
    # 게시글 정보 (외래키)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    post = relationship("Post", back_populates="hearts")
    
    # 좋아요 상태
    is_active = Column(Boolean, default=True)  # 활성/비활성 상태
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 