from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationUpdate
from app.routers.user import get_current_user
from app.utils.date_utils import convert_to_kst
from app.services.fcm_service import send_test_notification_to_user

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
    response_ = []
    for notification in notifications:
        response_.append({
            "id": notification.id,
            "user_id": notification.user_id,
            "title": notification.title,
            "message": notification.message,
            "notification_type": notification.notification_type,
            "data": notification.data,
            "is_read": notification.is_read,
            "read_at": convert_to_kst(notification.read_at) if notification.read_at else None,
            "created_at": convert_to_kst(notification.created_at),
            "updated_at": convert_to_kst(notification.updated_at) if notification.updated_at else None
        })
    
    print(f"응답 데이터 수: {len(response_)}")
    return response_

@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: int,
    notification_update: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알림을 업데이트합니다."""
    print(f"=== 알림 업데이트 시작 ===")
    print(f"알림 ID: {notification_id}")
    print(f"사용자 ID: {current_user.id}")
    
    # 알림 존재 여부 및 소유자 확인
    notification = db.execute(text("""
        SELECT id, user_id, title, message, notification_type, data, is_read, read_at, created_at, updated_at
        FROM notifications 
        WHERE id = :notification_id AND user_id = :user_id
    """), {
        'notification_id': notification_id,
        'user_id': current_user.id
    }).fetchone()
    
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    
    # 업데이트 실행
    update_sql = """
        UPDATE notifications 
        SET is_read = :is_read, read_at = :read_at, updated_at = NOW()
        WHERE id = :notification_id
    """
    
    db.execute(text(update_sql), {
        'notification_id': notification_id,
        'is_read': notification_update.is_read,
        'read_at': notification_update.read_at
    })
    db.commit()
    
    # 업데이트된 알림 조회
    updated_notification = db.execute(text("""
        SELECT id, user_id, title, message, notification_type, data, is_read, read_at, created_at, updated_at
        FROM notifications 
        WHERE id = :notification_id
    """), {'notification_id': notification_id}).fetchone()
    
    return {
        "id": updated_notification.id,
        "user_id": updated_notification.user_id,
        "title": updated_notification.title,
        "message": updated_notification.message,
        "notification_type": updated_notification.notification_type,
        "data": updated_notification.data,
        "is_read": updated_notification.is_read,
        "read_at": convert_to_kst(updated_notification.read_at) if updated_notification.read_at else None,
        "created_at": convert_to_kst(updated_notification.created_at),
        "updated_at": convert_to_kst(updated_notification.updated_at) if updated_notification.updated_at else None
    }

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알림을 삭제합니다."""
    print(f"=== 알림 삭제 시작 ===")
    print(f"알림 ID: {notification_id}")
    print(f"사용자 ID: {current_user.id}")
    
    # 알림 존재 여부 및 소유자 확인
    notification = db.execute(text("""
        SELECT id, user_id
        FROM notifications 
        WHERE id = :notification_id AND user_id = :user_id
    """), {
        'notification_id': notification_id,
        'user_id': current_user.id
    }).fetchone()
    
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    
    # 삭제 실행
    delete_sql = "DELETE FROM notifications WHERE id = :notification_id"
    db.execute(text(delete_sql), {'notification_id': notification_id})
    db.commit()
    
    return {"message": "알림이 삭제되었습니다."}

@router.get("/unread-count")
def get_unread_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """읽지 않은 알림 개수를 조회합니다."""
    print(f"=== 읽지 않은 알림 개수 조회 ===")
    print(f"사용자 ID: {current_user.id}")
    
    result = db.execute(text("""
        SELECT COUNT(*) as unread_count
        FROM notifications 
        WHERE user_id = :user_id AND is_read = FALSE
    """), {'user_id': current_user.id})
    
    unread_count = result.fetchone().unread_count
    print(f"읽지 않은 알림 개수: {unread_count}")
    
    return {"unread_count": unread_count}

@router.post("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 알림을 읽음으로 표시합니다."""
    print(f"=== 모든 알림 읽음 처리 ===")
    print(f"사용자 ID: {current_user.id}")
    
    # 모든 알림을 읽음으로 표시
    update_sql = """
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE user_id = :user_id AND is_read = FALSE
    """
    
    result = db.execute(text(update_sql), {'user_id': current_user.id})
    db.commit()
    
    print(f"읽음 처리된 알림 수: {result.rowcount}")
    
    return {"message": f"{result.rowcount}개의 알림이 읽음으로 표시되었습니다."}

@router.post("/test")
def send_test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """테스트 알림을 전송합니다."""
    print(f"=== 테스트 알림 전송 ===")
    print(f"사용자 ID: {current_user.id}")
    
    try:
        result = send_test_notification_to_user(
            db,
            current_user.id,
            "🧪 HoseoLife 테스트 알림", 
            "안녕하세요 호서라이프님! 알림이 정상적으로 작동합니다."
        )
        
        if result.get("success"):
            return {
                "success": True,
                "message": "테스트 알림이 전송되었습니다.",
                "result": result
            }
        else:
            return {
                "success": False,
                "message": "테스트 알림 전송에 실패했습니다.",
                "error": result.get("error", "알 수 없는 오류")
            }
    except Exception as e:
        print(f"❌ 알림 전송 실패: {e}")
        return {
            "success": False,
            "message": f"알림 전송 실패: {str(e)}"
        }

@router.post("/send-to-self")
def send_notification_to_self(
    request_: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """자신에게 알림을 전송합니다."""
    title = request_.get("title")
    message = request_.get("message")
    type = request_.get("type", "test")
    
    print(f"=== 자신에게 알림 전송 ===")
    print(f"사용자 ID: {current_user.id}")
    print(f"제목: {title}")
    print(f"메시지: {message}")
    
    try:
        result = send_test_notification_to_user(
            db,
            current_user.id,
            title, 
            message
        )
        
        if result.get("success"):
            return {
                "success": True,
                "message": "자신에게 알림이 전송되었습니다.",
                "result": result
            }
        else:
            return {
                "success": False,
                "message": "알림 전송에 실패했습니다.",
                "error": result.get("error", "알 수 없는 오류")
            }
    except Exception as e:
        print(f"❌ 알림 전송 실패: {e}")
        return {
            "success": False,
            "message": f"알림 전송 실패: {str(e)}"
        }

@router.get("/users/me/token-info")
def get_current_user_token_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 토큰 정보를 조회합니다."""
    print(f"=== 사용자 토큰 정보 조회 ===")
    print(f"사용자 ID: {current_user.id}")
    
    try:
        # 사용자 정보에서 FCM 토큰 조회
        user_info = db.execute(text("""
            SELECT id, nickname, fcm_token, created_at
            FROM users 
            WHERE id = :user_id
        """), {'user_id': current_user.id}).fetchone()
        
        if not user_info:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # FCM 토큰이 있는지 확인
        fcm_token = user_info.fcm_token if user_info.fcm_token else None
        
        # 토큰 환경 정보 추정 (projectId 명시 토큰 기준)
        environment = "unknown"
        if fcm_token:
            if fcm_token.startswith("ExponentPushToken"):
                environment = "expo_go"  # Expo Go 환경 (placeholder 아이콘 사용)
            elif fcm_token.startswith("ExpoPushToken"):
                environment = "testflight"  # TestFlight/App Store 환경 (앱 아이콘 사용)
            else:
                environment = "production"  # 기타 환경
        
        return {
            "success": True,
            "userId": current_user.id,
            "fcmToken": fcm_token,
            "environment": environment,
            "lastUpdated": user_info.created_at.isoformat() if user_info.created_at else None,
            "hasToken": fcm_token is not None
        }
        
    except Exception as e:
        print(f"❌ 사용자 토큰 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 토큰 정보 조회 실패: {str(e)}")

# 🆕 프론트엔드에서 요청하는 경로 추가
@router.get("/me/token-info")
def get_current_user_token_info_alt(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 토큰 정보를 조회합니다. (대체 경로)"""
    print(f"=== 사용자 토큰 정보 조회 (대체 경로) ===")
    print(f"사용자 ID: {current_user.id}")
    
    try:
        # 사용자 정보에서 FCM 토큰 조회
        user_info = db.execute(text("""
            SELECT id, nickname, fcm_token, created_at
            FROM users 
            WHERE id = :user_id
        """), {'user_id': current_user.id}).fetchone()
        
        if not user_info:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # FCM 토큰이 있는지 확인
        fcm_token = user_info.fcm_token if user_info.fcm_token else None
        
        # 토큰 환경 정보 추정 (projectId 명시 토큰 기준)
        environment = "unknown"
        if fcm_token:
            if fcm_token.startswith("ExponentPushToken"):
                environment = "expo_go"  # Expo Go 환경 (placeholder 아이콘 사용)
            elif fcm_token.startswith("ExpoPushToken"):
                environment = "testflight"  # TestFlight/App Store 환경 (앱 아이콘 사용)
            else:
                environment = "production"  # 기타 환경
        
        return {
            "success": True,
            "userId": current_user.id,
            "fcmToken": fcm_token,
            "environment": environment,
            "lastUpdated": user_info.created_at.isoformat() if user_info.created_at else None,
            "hasToken": fcm_token is not None
        }
        
    except Exception as e:
        print(f"❌ 사용자 토큰 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 토큰 정보 조회 실패: {str(e)}")

# 🆕 프론트엔드에서 요청하는 경로 추가 (users 라우터용)
@router.get("/users/me/token-info")
def get_current_user_token_info_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 토큰 정보를 조회합니다. (users 경로)"""
    print(f"=== 사용자 토큰 정보 조회 (users 경로) ===")
    print(f"사용자 ID: {current_user.id}")
    
    try:
        # 사용자 정보에서 FCM 토큰 조회
        user_info = db.execute(text("""
            SELECT id, nickname, fcm_token, created_at
            FROM users 
            WHERE id = :user_id
        """), {'user_id': current_user.id}).fetchone()
        
        if not user_info:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # FCM 토큰이 있는지 확인
        fcm_token = user_info.fcm_token if user_info.fcm_token else None
        
        # 토큰 환경 정보 추정 (projectId 명시 토큰 기준)
        environment = "unknown"
        if fcm_token:
            if fcm_token.startswith("ExponentPushToken"):
                environment = "expo_go"  # Expo Go 환경 (placeholder 아이콘 사용)
            elif fcm_token.startswith("ExpoPushToken"):
                environment = "testflight"  # TestFlight/App Store 환경 (앱 아이콘 사용)
            else:
                environment = "production"  # 기타 환경
        
        return {
            "success": True,
            "userId": current_user.id,
            "fcmToken": fcm_token,
            "environment": environment,
            "lastUpdated": user_info.created_at.isoformat() if user_info.created_at else None,
            "hasToken": fcm_token is not None
        }
        
    except Exception as e:
        print(f"❌ 사용자 토큰 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 토큰 정보 조회 실패: {str(e)}")
        
@router.post("/send-to-user")
def send_notification_to_user_endpoint(
    request_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 사용자에게 알림을 전송합니다."""
    target_user_id = request_data.get("target_user_id")
    title = request_data.get("title")
    message = request_data.get("message")
    notification_type = request_data.get("type", "test")
    data = request_data.get("data", {})

    print(f"=== 특정 사용자에게 알림 전송 ===")
    print(f"요청 사용자 ID: {current_user.id}")
    print(f"대상 사용자 ID: {target_user_id}")
    print(f"제목: {title}")
    print(f"메시지: {message}")

    try:
        result = send_test_notification_to_user(
            db,
            int(target_user_id),
            title,
            message
        )

        if result.get("success"):
            return {
                "success": True,
                "message": f"사용자 {target_user_id}에게 알림이 전송되었습니다.",
                "result": result
            }
        else:
            return {
                "success": False,
                "message": "알림 전송에 실패했습니다.",
                "error": result.get("error", "알 수 없는 오류")
            }
    except Exception as e:
        print(f"❌ 알림 전송 실패: {e}")
        raise HTTPException(status_code=500, detail=f"알림 전송 실패: {str(e)}")
