from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.schemas.contact import ContactCreate, ContactResponse, ContactUpdate, ContactListResponse
from app.models.contact import Contact
from app.models.user import User
from app.db.database import get_db
from app.routers.user import get_current_user
from datetime import datetime

router = APIRouter(prefix="/contacts", tags=["contacts"])

# 사용자 문의 생성
@router.post("/", response_model=ContactResponse)
def create_contact(
    contact: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 문의를 생성합니다."""
    db_contact = Contact(
        user_id=current_user.id,
        subject=contact.subject,
        message=contact.message,
        category=contact.category
    )
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    # 응답에 사용자 정보 추가
    response_data = ContactResponse.from_orm(db_contact)
    response_data.user_nickname = current_user.nickname
    return response_data

# 사용자 본인 문의 목록 조회
@router.get("/my", response_model=List[ContactResponse])
def get_my_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100)
):
    """현재 로그인한 사용자의 문의 목록을 조회합니다."""
    contacts = db.query(Contact).filter(
        Contact.user_id == current_user.id
    ).order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for contact in contacts:
        response_data = ContactResponse.from_orm(contact)
        response_data.user_nickname = current_user.nickname
        if contact.admin_id:
            admin = db.query(User).filter(User.id == contact.admin_id).first()
            response_data.admin_nickname = admin.nickname if admin else None
        result.append(response_data)
    
    return result

# 사용자 본인 문의 상세 조회
@router.get("/my/{contact_id}", response_model=ContactResponse)
def get_my_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 로그인한 사용자의 특정 문의를 조회합니다."""
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.user_id == current_user.id
    ).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    
    response_data = ContactResponse.from_orm(contact)
    response_data.user_nickname = current_user.nickname
    if contact.admin_id:
        admin = db.query(User).filter(User.id == contact.admin_id).first()
        response_data.admin_nickname = admin.nickname if admin else None
    
    return response_data

# 관리자용 문의 목록 조회
@router.get("/admin", response_model=List[ContactListResponse])
def get_all_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    category_filter: Optional[str] = Query(None),
    priority_filter: Optional[str] = Query(None)
):
    """관리자가 모든 문의 목록을 조회합니다."""
    print(f"문의 목록 조회 요청 - 사용자 ID: {current_user.id}, 관리자 여부: {current_user.is_admin}")
    
    if not current_user.is_admin:
        print(f"관리자 권한 없음 - 사용자 ID: {current_user.id}")
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    query = db.query(Contact).join(User, Contact.user_id == User.id)
    
    # 필터 적용
    if status_filter:
        query = query.filter(Contact.status == status_filter)
    if category_filter:
        query = query.filter(Contact.category == category_filter)
    if priority_filter:
        query = query.filter(Contact.priority == priority_filter)
    
    contacts = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for contact in contacts:
        response_data = ContactListResponse.from_orm(contact)
        response_data.user_nickname = contact.user.nickname
        result.append(response_data)
    
    return result

# 문의 통계 (관리자용)
@router.get("/admin/stats")
def get_contact_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 문의 통계를 조회합니다."""
    print(f"통계 조회 요청 - 사용자 ID: {current_user.id}, 관리자 여부: {current_user.is_admin}")
    
    if not current_user.is_admin:
        print(f"관리자 권한 없음 - 사용자 ID: {current_user.id}")
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    total_contacts = db.query(Contact).count()
    unread_contacts = db.query(Contact).filter(Contact.is_read == False).count()
    pending_contacts = db.query(Contact).filter(Contact.status == "대기중").count()
    answered_contacts = db.query(Contact).filter(Contact.is_answered == True).count()
    
    # 카테고리별 통계
    category_stats = db.query(Contact.category, func.count(Contact.id)).group_by(Contact.category).all()
    
    return {
        "total": total_contacts,
        "unread": unread_contacts,
        "pending": pending_contacts,
        "answered": answered_contacts,
        "category_stats": dict(category_stats)
    }

# 관리자용 문의 상세 조회
@router.get("/admin/{contact_id}", response_model=ContactResponse)
def get_contact_detail(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 특정 문의를 상세 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    
    response_data = ContactResponse.from_orm(contact)
    response_data.user_nickname = contact.user.nickname
    if contact.admin_id:
        admin = db.query(User).filter(User.id == contact.admin_id).first()
        response_data.admin_nickname = admin.nickname if admin else None
    
    # 읽음 처리
    if not contact.is_read:
        contact.is_read = True
        db.commit()
    
    return response_data

# 관리자용 문의 답변/상태 업데이트
@router.put("/admin/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자가 문의에 답변하거나 상태를 업데이트합니다."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    
    # 업데이트할 필드들
    if contact_update.status is not None:
        contact.status = contact_update.status
    if contact_update.priority is not None:
        contact.priority = contact_update.priority
    if contact_update.admin_response is not None:
        contact.admin_response = contact_update.admin_response
        contact.admin_id = current_user.id
        contact.is_answered = True
        contact.status = "답변완료"
    if contact_update.is_read is not None:
        contact.is_read = contact_update.is_read
    if contact_update.is_answered is not None:
        contact.is_answered = contact_update.is_answered
    
    contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contact)
    
    response_data = ContactResponse.from_orm(contact)
    response_data.user_nickname = contact.user.nickname
    response_data.admin_nickname = current_user.nickname
    
    return response_data 