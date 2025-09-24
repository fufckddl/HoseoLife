from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

# 댓글 모델
class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)  # 댓글 내용
    
    # 작성자 정보 (외래키)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author = relationship("User", back_populates="comments")
    
    # 게시글 정보 (외래키)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    post = relationship("Post", back_populates="comments")
    
    # 대댓글 기능
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)  # 부모 댓글 ID
    depth = Column(Integer, default=0)  # 댓글 깊이 (0: 일반댓글, 1: 대댓글, 2: 대대댓글...)
    
    # 댓글 상태
    is_active = Column(Boolean, default=True)  # 활성/비활성 상태
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계 설정 - 대댓글 기능 (자기참조)
    # replies: 이 댓글에 달린 대댓글들
    replies = relationship(
        "Comment",
        backref="parent",
        remote_side=[id]
    ) 