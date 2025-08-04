from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class ReportType(str, enum.Enum):
    SPAM = "스팸/광고"
    HARASSMENT = "욕설/폭력"
    SEXUAL = "음란물"
    ILLEGAL = "불법행위"
    PERSONAL_INFO = "개인정보"
    COPYRIGHT = "저작권 침해"
    MISLEADING = "허위정보"
    OTHER = "기타"

class ReportStatus(str, enum.Enum):
    PENDING = "대기중"
    REVIEWED = "검토완료"
    RESOLVED = "처리완료"

class PenaltyType(str, enum.Enum):
    WARNING = "경고"
    TEMPORARY_BAN = "임시정지"
    PERMANENT_BAN = "영구정지"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 신고자
    target_type = Column(String(20), nullable=False)  # "post", "comment", "user"
    target_id = Column(Integer, nullable=False)  # 신고 대상 ID
    report_type = Column(Enum(ReportType), nullable=False)
    reason = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)  # 증거 자료 (스크린샷 URL 등)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    admin_response = Column(Text, nullable=True)  # 관리자 답변
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 처리한 관리자
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 관계 설정
    reporter = relationship("User", foreign_keys=[reporter_id])
    admin = relationship("User", foreign_keys=[admin_id])

class UserPenalty(Base):
    __tablename__ = "user_penalties"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    penalty_type = Column(Enum(PenaltyType), nullable=False)
    reason = Column(Text, nullable=False)
    duration_days = Column(Integer, nullable=True)  # 임시 정지 기간 (일)
    start_date = Column(DateTime(timezone=True), server_default=func.now())
    end_date = Column(DateTime(timezone=True), nullable=True)
    report_count = Column(Integer, default=1)  # 관련 신고 수
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 처벌한 관리자
    is_active = Column(Boolean, default=True)  # 현재 활성 상태인지
    
    # 관계 설정
    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[admin_id]) 