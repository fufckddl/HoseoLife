from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ReportType(str, Enum):
    SPAM = "스팸/광고"
    HARASSMENT = "욕설/폭력"
    SEXUAL = "음란물"
    ILLEGAL = "불법행위"
    PERSONAL_INFO = "개인정보"
    COPYRIGHT = "저작권 침해"
    MISLEADING = "허위정보"
    OTHER = "기타"

class ReportStatus(str, Enum):
    PENDING = "대기중"
    REVIEWED = "검토완료"
    RESOLVED = "처리완료"

class PenaltyType(str, Enum):
    WARNING = "경고"
    TEMPORARY_BAN = "임시정지"
    PERMANENT_BAN = "영구정지"

# 신고 생성용
class ReportCreate(BaseModel):
    target_type: str  # "post", "comment", "user"
    target_id: int
    report_type: ReportType
    reason: str
    evidence: Optional[str] = None

# 신고 응답용
class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    target_type: str
    target_id: int
    report_type: ReportType
    reason: str
    evidence: Optional[str] = None
    status: ReportStatus
    admin_response: Optional[str] = None
    admin_id: Optional[int] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reporter_nickname: Optional[str] = None
    admin_nickname: Optional[str] = None

    class Config:
        from_attributes = True

# 신고 목록용
class ReportListResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    report_type: ReportType
    reason: str
    status: ReportStatus
    created_at: datetime
    reporter_nickname: str
    target_content: Optional[str] = None  # 신고된 게시글/댓글 내용

    class Config:
        from_attributes = True

# 신고 검토용
class ReportReview(BaseModel):
    status: ReportStatus
    admin_response: Optional[str] = None
    penalty_type: Optional[PenaltyType] = None
    penalty_reason: Optional[str] = None
    duration_days: Optional[int] = None

# 사용자 처벌 응답용
class UserPenaltyResponse(BaseModel):
    id: int
    user_id: int
    penalty_type: PenaltyType
    reason: str
    duration_days: Optional[int] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    report_count: int
    admin_id: int
    is_active: bool
    user_nickname: Optional[str] = None
    admin_nickname: Optional[str] = None

    class Config:
        from_attributes = True

# 신고 통계용
class ReportStats(BaseModel):
    total_reports: int
    pending_reports: int
    reviewed_reports: int
    resolved_reports: int
    reports_by_type: dict[str, int]
    reports_by_status: dict[str, int] 