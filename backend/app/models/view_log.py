from sqlalchemy import Column, Integer, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

# 조회 기록 모델
class ViewLog(Base):
    __tablename__ = "view_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # 사용자 정보 (외래키)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user = relationship("User", back_populates="view_logs")
    
    # 게시글 정보 (외래키)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    post = relationship("Post", back_populates="view_logs")
    
    # 조회 날짜 (한국 시간 기준)
    viewed_date = Column(DateTime(timezone=True), nullable=False)
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 