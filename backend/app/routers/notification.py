from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from app.db.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.routers.user import get_current_user
from app.utils.date_utils import convert_to_kst

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[NotificationResponse])
def get_user_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False
):
    """사용자의 알림 목록을 조회합니다."""
    print(f"=== 사용자 알림 조회 시작 ===")
    print(f"사용자 ID: {current_user.id}")
    print(f"읽지 않은 알림만: {unread_only}")
    
    # 🔧 직접 SQL 사용
    sql = """
        SELECT id, user_id, title, message, notification_type, data, is_read, read_at, created_at, updated_at
        FROM notifications 
        WHERE user_id = :user_id
    """
    
    if unread_only:
        sql += " AND is_read = FALSE"
    
    sql += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    
    result = db.execute(text(sql), {
        'user_id': current_user.id,
        'limit': limit,
        'skip': skip
    })
    
    notifications = result.fetchall()
    print(f"조회된 알림 수: {len(notifications)}")
    
    # 응답 데이터 생성
    response_data = []
    for notification in notifications:
        response_data.append({
            "id": notification[0],
            "user_id": notification[1],
            "title": notification[2],
            "message": notification[3],
            "notification_type": notification[4],
            "data": notification[5],
            "is_read": bool(notification[6]),
            "read_at": notification[7].isoformat() if notification[7] else None,
            "created_at": notification[8].isoformat() if notification[8] else None,
            "updated_at": notification[9].isoformat() if notification[9] else None
        })
    
    return response_data

@router.put("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알림을 읽음으로 표시합니다."""
    # 🔧 직접 SQL 사용
    check_sql = text("SELECT id, is_read FROM notifications WHERE id = :id AND user_id = :user_id")
    result = db.execute(check_sql, {'id': notification_id, 'user_id': current_user.id})
    notification = result.fetchone()
    
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
    
    if not notification[1]:  # is_read가 False인 경우
        from app.utils.date_utils import get_current_korea_time
        current_time = get_current_korea_time()
        
        update_sql = text("""
            UPDATE notifications 
            SET is_read = TRUE, read_at = :read_at, updated_at = :updated_at 
            WHERE id = :id AND user_id = :user_id
        """)
        
        db.execute(update_sql, {
            'read_at': current_time,
            'updated_at': current_time,
            'id': notification_id,
            'user_id': current_user.id
        })
        db.commit()
        print(f"✅ 알림 {notification_id} 읽음 처리 완료: {current_time}")
    
    return {"message": "알림이 읽음으로 표시되었습니다"}

@router.put("/read-all")
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 알림을 읽음으로 표시합니다."""
    # 🔧 직접 SQL 사용
    from app.utils.date_utils import get_current_korea_time
    current_time = get_current_korea_time()
    
    # 읽지 않은 알림 개수 확인
    count_sql = text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = FALSE")
    count_result = db.execute(count_sql, {'user_id': current_user.id})
    unread_count = count_result.scalar()
    
    if unread_count > 0:
        # 모든 읽지 않은 알림을 읽음으로 처리
        update_sql = text("""
            UPDATE notifications 
            SET is_read = TRUE, read_at = :read_at, updated_at = :updated_at 
            WHERE user_id = :user_id AND is_read = FALSE
        """)
        
        db.execute(update_sql, {
            'read_at': current_time,
            'updated_at': current_time,
            'user_id': current_user.id
        })
        db.commit()
    
    print(f"✅ 사용자 {current_user.id}의 모든 알림 읽음 처리 완료: {unread_count}개")
    return {"message": f"{unread_count}개의 알림이 읽음으로 표시되었습니다"}

@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """읽지 않은 알림 개수를 조회합니다."""
    # 🔧 직접 SQL 사용
    count_sql = text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = FALSE")
    result = db.execute(count_sql, {'user_id': current_user.id})
    count = result.scalar()
    
    return {"unread_count": count}
