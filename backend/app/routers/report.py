from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.schemas.report import (
    ReportCreate, ReportResponse, ReportListResponse, 
    ReportReview, UserPenaltyResponse, ReportStats
)
from app.models.report import Report, UserPenalty, ReportType, ReportStatus, PenaltyType
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.db.database import get_db
from app.routers.user import get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/reports", tags=["reports"])

# 중복 신고 확인
@router.get("/check-duplicate")
def check_duplicate_report(
    target_type: str,
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 특정 대상을 이미 신고했는지 확인합니다."""
    
    existing_report = db.query(Report).filter(
        Report.reporter_id == current_user.id,
        Report.target_type == target_type,
        Report.target_id == target_id
    ).first()
    
    return {
        "is_duplicate": existing_report is not None,
        "existing_report_id": existing_report.id if existing_report else None
    }

# 내 신고 목록 조회
@router.get("/my", response_model=List[ReportResponse])
def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 신고 목록을 조회합니다."""
    
    reports = db.query(Report).filter(
        Report.reporter_id == current_user.id
    ).order_by(Report.created_at.desc()).all()
    
    return [
        ReportResponse(
            id=report.id,
            reporter_id=report.reporter_id,
            target_type=report.target_type,
            target_id=report.target_id,
            report_type=report.report_type,
            reason=report.reason,
            evidence=report.evidence,
            status=report.status,
            admin_response=report.admin_response,
            admin_id=report.admin_id,
            created_at=report.created_at,
            reviewed_at=report.reviewed_at
        )
        for report in reports
    ]

# 사용자 신고 생성
@router.post("/", response_model=ReportResponse)
def create_report(
    report: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 게시글, 댓글, 사용자를 신고합니다."""
    # 신고 대상 존재 확인
    if report.target_type == "post":
        target = db.query(Post).filter(Post.id == report.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    elif report.target_type == "comment":
        target = db.query(Comment).filter(Comment.id == report.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    elif report.target_type == "user":
        target = db.query(User).filter(User.id == report.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    else:
        raise HTTPException(status_code=400, detail="잘못된 신고 대상입니다.")
    
    # 자기 자신 신고 방지
    if report.target_type == "user" and report.target_id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신을 신고할 수 없습니다.")
    
    # 중복 신고 확인 (같은 사용자가 같은 대상을 신고한 경우)
    existing_report = db.query(Report).filter(
        Report.reporter_id == current_user.id,
        Report.target_type == report.target_type,
        Report.target_id == report.target_id
    ).first()
    
    if existing_report:
        raise HTTPException(status_code=400, detail="이미 신고한 대상입니다.")
    
    # 신고 생성
    db_report = Report(
        reporter_id=current_user.id,
        target_type=report.target_type,
        target_id=report.target_id,
        report_type=report.report_type,
        reason=report.reason,
        evidence=report.evidence
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # ReportResponse 객체 직접 생성
    response_data = ReportResponse(
        id=db_report.id,
        reporter_id=db_report.reporter_id,
        target_type=db_report.target_type,
        target_id=db_report.target_id,
        report_type=db_report.report_type,
        reason=db_report.reason,
        evidence=db_report.evidence,
        status=db_report.status,
        admin_response=db_report.admin_response,
        admin_id=db_report.admin_id,
        created_at=db_report.created_at,
        reviewed_at=db_report.reviewed_at,
        reporter_nickname=current_user.nickname,
        admin_nickname=None
    )
    
    return response_data

# 관리자용 신고 목록 조회
@router.get("/admin", response_model=List[ReportListResponse])
def get_all_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    type_filter: Optional[str] = Query(None)
):
    """관리자가 모든 신고 목록을 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    query = db.query(Report).join(User, Report.reporter_id == User.id)
    
    # 필터 적용
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if type_filter:
        query = query.filter(Report.report_type == type_filter)
    
    reports = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for report in reports:
        # 신고된 대상의 내용 가져오기
        target_content = None
        if report.target_type == "post":
            post = db.query(Post).filter(Post.id == report.target_id).first()
            if post:
                target_content = post.title[:50] + "..." if len(post.title) > 50 else post.title
        elif report.target_type == "comment":
            comment = db.query(Comment).filter(Comment.id == report.target_id).first()
            if comment:
                target_content = comment.content[:50] + "..." if len(comment.content) > 50 else comment.content
        
        # ReportListResponse 객체 직접 생성
        response_data = ReportListResponse(
            id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            report_type=report.report_type,
            reason=report.reason,
            status=report.status,
            created_at=report.created_at,
            reporter_nickname=report.reporter.nickname,
            target_content=target_content
        )
        
        result.append(response_data)
    
    return result

# 관리자용 신고 통계
@router.get("/admin/stats", response_model=ReportStats)
def get_report_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 신고 통계를 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    try:
        total_reports = db.query(Report).count()
        pending_reports = db.query(Report).filter(Report.status == ReportStatus.PENDING).count()
        reviewed_reports = db.query(Report).filter(Report.status == ReportStatus.REVIEWED).count()
        resolved_reports = db.query(Report).filter(Report.status == ReportStatus.RESOLVED).count()
        
        # 신고 유형별 통계 - 기본값 설정
        reports_by_type = {
            "스팸/광고": 0,
            "욕설/폭력": 0,
            "음란물": 0,
            "불법행위": 0,
            "개인정보": 0,
            "저작권 침해": 0,
            "허위정보": 0,
            "기타": 0
        }
        
        reports_by_type_raw = db.query(Report.report_type, func.count(Report.id)).group_by(Report.report_type).all()
        for item in reports_by_type_raw:
            try:
                type_str = str(item[0])
                count = int(item[1])
                reports_by_type[type_str] = count
            except (ValueError, TypeError):
                continue
        
        # 신고 상태별 통계 - 기본값 설정
        reports_by_status = {
            "대기중": 0,
            "검토완료": 0,
            "처리완료": 0
        }
        
        reports_by_status_raw = db.query(Report.status, func.count(Report.id)).group_by(Report.status).all()
        for item in reports_by_status_raw:
            try:
                status_str = str(item[0])
                count = int(item[1])
                reports_by_status[status_str] = count
            except (ValueError, TypeError):
                continue
        
        # ReportStats 객체 직접 생성
        stats = ReportStats(
            total_reports=total_reports,
            pending_reports=pending_reports,
            reviewed_reports=reviewed_reports,
            resolved_reports=resolved_reports,
            reports_by_type=reports_by_type,
            reports_by_status=reports_by_status
        )
        
        return stats
        
    except Exception as e:
        print(f"신고 통계 조회 중 오류 발생: {e}")
        # 기본 통계 반환
        return ReportStats(
            total_reports=0,
            pending_reports=0,
            reviewed_reports=0,
            resolved_reports=0,
            reports_by_type={},
            reports_by_status={}
        )

# 관리자용 신고 상세 조회
@router.get("/admin/{report_id}", response_model=ReportResponse)
def get_report_detail(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 특정 신고를 상세 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    
    # ReportResponse 객체 직접 생성
    response_data = ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        target_type=report.target_type,
        target_id=report.target_id,
        report_type=report.report_type,
        reason=report.reason,
        evidence=report.evidence,
        status=report.status,
        admin_response=report.admin_response,
        admin_id=report.admin_id,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
        reporter_nickname=report.reporter.nickname,
        admin_nickname=None
    )
    
    if report.admin_id:
        admin = db.query(User).filter(User.id == report.admin_id).first()
        response_data.admin_nickname = admin.nickname if admin else None
    
    return response_data

# 관리자용 신고 검토 및 처벌
@router.put("/admin/{report_id}", response_model=ReportResponse)
def review_report(
    report_id: int,
    review: ReportReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 신고를 검토하고 처벌을 결정합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다.")
    
    # 신고 상태 업데이트
    report.status = review.status
    report.admin_response = review.admin_response
    report.admin_id = current_user.id
    report.reviewed_at = datetime.utcnow()
    
    # 처벌이 있는 경우 사용자 처벌 생성
    if review.penalty_type:
        # 신고 대상의 사용자 ID 찾기
        target_user_id = None
        if report.target_type == "post":
            post = db.query(Post).filter(Post.id == report.target_id).first()
            target_user_id = post.author_id if post else None
        elif report.target_type == "comment":
            comment = db.query(Comment).filter(Comment.id == report.target_id).first()
            target_user_id = comment.author_id if comment else None
        elif report.target_type == "user":
            target_user_id = report.target_id
        
        if target_user_id:
            # 기존 활성 처벌이 있다면 비활성화
            existing_penalties = db.query(UserPenalty).filter(
                UserPenalty.user_id == target_user_id,
                UserPenalty.is_active == True
            ).all()
            
            for penalty in existing_penalties:
                penalty.is_active = False
            
            # 새로운 처벌 생성
            end_date = None
            if review.penalty_type == PenaltyType.TEMPORARY_BAN and review.duration_days:
                end_date = datetime.utcnow() + timedelta(days=review.duration_days)
            
            penalty = UserPenalty(
                user_id=target_user_id,
                penalty_type=review.penalty_type,
                reason=review.penalty_reason or f"신고 처리: {report.report_type.value}",
                duration_days=review.duration_days,
                end_date=end_date,
                admin_id=current_user.id
            )
            db.add(penalty)
    
    db.commit()
    db.refresh(report)
    
    # ReportResponse 객체 직접 생성
    response_data = ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        target_type=report.target_type,
        target_id=report.target_id,
        report_type=report.report_type,
        reason=report.reason,
        evidence=report.evidence,
        status=report.status,
        admin_response=report.admin_response,
        admin_id=report.admin_id,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
        reporter_nickname=report.reporter.nickname,
        admin_nickname=current_user.nickname
    )
    
    return response_data

# 관리자용 사용자 처벌 목록 조회
@router.get("/admin/penalties", response_model=List[UserPenaltyResponse])
def get_user_penalties(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
):
    """관리자가 사용자 처벌 목록을 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    penalties = db.query(UserPenalty).join(User, UserPenalty.user_id == User.id).order_by(
        UserPenalty.start_date.desc()
    ).offset(skip).limit(limit).all()
    
    result = []
    for penalty in penalties:
        # UserPenaltyResponse 객체 직접 생성
        response_data = UserPenaltyResponse(
            id=penalty.id,
            user_id=penalty.user_id,
            penalty_type=penalty.penalty_type,
            reason=penalty.reason,
            duration_days=penalty.duration_days,
            start_date=penalty.start_date,
            end_date=penalty.end_date,
            report_count=penalty.report_count,
            admin_id=penalty.admin_id,
            is_active=penalty.is_active,
            user_nickname=penalty.user.nickname,
            admin_nickname=penalty.admin.nickname
        )
        result.append(response_data)
    
    return result

# 사용자 본인의 신고 내역 조회
@router.get("/user/reports", response_model=List[ReportListResponse])
def get_user_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
):
    """사용자가 본인이 신고한 내역을 조회합니다."""
    
    reports = db.query(Report).filter(
        Report.reporter_id == current_user.id
    ).order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for report in reports:
        # 신고된 대상의 내용 가져오기
        target_content = None
        if report.target_type == "post":
            post = db.query(Post).filter(Post.id == report.target_id).first()
            if post:
                target_content = post.title[:50] + "..." if len(post.title) > 50 else post.title
        elif report.target_type == "comment":
            comment = db.query(Comment).filter(Comment.id == report.target_id).first()
            if comment:
                target_content = comment.content[:50] + "..." if len(comment.content) > 50 else comment.content
        
        # ReportListResponse 객체 직접 생성
        response_data = ReportListResponse(
            id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            report_type=report.report_type,
            reason=report.reason,
            status=report.status,
            created_at=report.created_at,
            reporter_nickname=current_user.nickname,
            target_content=target_content
        )
        
        result.append(response_data)
    
    return result

# 사용자 본인의 활성 처벌 조회
@router.get("/user/penalties", response_model=List[UserPenaltyResponse])
def get_user_active_penalties(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 본인의 활성 처벌을 조회합니다."""
    
    # 임시정지 기간이 만료된 처벌들을 자동으로 비활성화
    expired_penalties = db.query(UserPenalty).filter(
        UserPenalty.user_id == current_user.id,
        UserPenalty.is_active == True,
        UserPenalty.penalty_type == PenaltyType.TEMPORARY_BAN,
        UserPenalty.end_date.isnot(None),
        UserPenalty.end_date < datetime.utcnow()
    ).all()
    
    for penalty in expired_penalties:
        penalty.is_active = False
        print(f"임시정지 만료 처리: 사용자 {current_user.nickname}, 처벌 ID {penalty.id}")
    
    if expired_penalties:
        db.commit()
    
    # 활성 처벌 조회 (만료된 것은 제외됨)
    penalties = db.query(UserPenalty).filter(
        UserPenalty.user_id == current_user.id,
        UserPenalty.is_active == True
    ).order_by(UserPenalty.start_date.desc()).all()
    
    result = []
    for penalty in penalties:
        # UserPenaltyResponse 객체 직접 생성
        response_data = UserPenaltyResponse(
            id=penalty.id,
            user_id=penalty.user_id,
            penalty_type=penalty.penalty_type,
            reason=penalty.reason,
            duration_days=penalty.duration_days,
            start_date=penalty.start_date,
            end_date=penalty.end_date,
            report_count=penalty.report_count,
            admin_id=penalty.admin_id,
            is_active=penalty.is_active,
            user_nickname=current_user.nickname,
            admin_nickname=penalty.admin.nickname
        )
        result.append(response_data)
    
    return result