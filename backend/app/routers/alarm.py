from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import pytz

from app.db.database import get_db
from app.models.user import User
from app.models.alarm import Alarm
from app.schemas.alarm import AlarmCreate, AlarmUpdate, AlarmResponse, AlarmListResponse
from app.routers.user import get_current_user
from app.services.fcm_service import send_fcm_to_user
from app.services.alarm_scheduler import alarm_scheduler

router = APIRouter(prefix="/alarms", tags=["alarms"])

@router.post("/", response_model=AlarmResponse, status_code=status.HTTP_201_CREATED)
def create_alarm(
    alarm: AlarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 알람을 생성합니다."""
    
    # 알람 시간이 과거인지 확인
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    
    if alarm.alarm_time < now:
        raise HTTPException(
            status_code=400,
            detail="알람 시간은 현재 시간보다 이후여야 합니다."
        )
    
    # 반복 알람인 경우 요일 설정 확인
    if alarm.is_repeated and not alarm.repeat_days:
        raise HTTPException(
            status_code=400,
            detail="반복 알람의 경우 요일을 설정해야 합니다."
        )
    
    # 알람 생성
    db_alarm = Alarm(
        user_id=current_user.id,
        title=alarm.title,
        message=alarm.message,
        alarm_time=alarm.alarm_time,
        is_repeated=alarm.is_repeated,
        repeat_days=alarm.repeat_days,
        sound=alarm.sound,
        vibration=alarm.vibration
    )
    
    db.add(db_alarm)
    db.commit()
    db.refresh(db_alarm)
    
    # 알람 스케줄러에 추가
    alarm_scheduler.add_alarm(db_alarm)
    
    return db_alarm

@router.get("/", response_model=AlarmListResponse)
def get_user_alarms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 모든 알람을 조회합니다."""
    
    alarms = db.query(Alarm).filter(Alarm.user_id == current_user.id).all()
    
    return {
        "alarms": alarms,
        "total": len(alarms)
    }

@router.get("/{alarm_id}", response_model=AlarmResponse)
def get_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 알람을 조회합니다."""
    
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id
    ).first()
    
    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="알람을 찾을 수 없습니다."
        )
    
    return alarm

@router.put("/{alarm_id}", response_model=AlarmResponse)
def update_alarm(
    alarm_id: int,
    alarm_update: AlarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알람을 수정합니다."""
    
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id
    ).first()
    
    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="알람을 찾을 수 없습니다."
        )
    
    # 업데이트할 필드들
    update_data = alarm_update.dict(exclude_unset=True)
    
    # 알람 시간이 변경되는 경우 과거 시간인지 확인
    if "alarm_time" in update_data:
        kst = pytz.timezone('Asia/Seoul')
        now = datetime.now(kst)
        
        if update_data["alarm_time"] < now:
            raise HTTPException(
                status_code=400,
                detail="알람 시간은 현재 시간보다 이후여야 합니다."
            )
    
    # 반복 알람 설정 확인
    if update_data.get("is_repeated") and not update_data.get("repeat_days"):
        raise HTTPException(
            status_code=400,
            detail="반복 알람의 경우 요일을 설정해야 합니다."
        )
    
    for field, value in update_data.items():
        setattr(alarm, field, value)
    
    db.commit()
    db.refresh(alarm)
    
    # 알람 스케줄러 업데이트
    alarm_scheduler.update_alarm(alarm)
    
    return alarm

@router.delete("/{alarm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알람을 삭제합니다."""
    
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id
    ).first()
    
    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="알람을 찾을 수 없습니다."
        )
    
    # 알람 스케줄러에서 제거
    alarm_scheduler.remove_alarm(alarm.id)
    
    db.delete(alarm)
    db.commit()
    
    return None

@router.post("/{alarm_id}/toggle", response_model=AlarmResponse)
def toggle_alarm(
    alarm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알람의 활성화/비활성화를 토글합니다."""
    
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == current_user.id
    ).first()
    
    if not alarm:
        raise HTTPException(
            status_code=404,
            detail="알람을 찾을 수 없습니다."
        )
    
    alarm.is_active = not alarm.is_active
    db.commit()
    db.refresh(alarm)
    
    # 알람 스케줄러 업데이트
    alarm_scheduler.update_alarm(alarm)
    
    return alarm

@router.post("/test", status_code=status.HTTP_200_OK)
def test_alarm_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """알람 알림을 테스트합니다."""
    
    title = "알람 테스트"
    body = "알람 기능이 정상적으로 작동합니다!"
    
    data = {
        "type": "alarm",
        "alarm_id": "test",
        "title": title,
        "message": body
    }
    
    result = send_fcm_to_user(db, current_user.id, title, body, data)
    
    if result.get("success"):
        return {"message": "테스트 알림이 전송되었습니다."}
    else:
        raise HTTPException(
            status_code=500,
            detail=f"알림 전송 실패: {result.get('error', 'Unknown error')}"
        )

@router.post("/test-local", status_code=status.HTTP_200_OK)
def test_local_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """로컬 알림을 테스트합니다."""
    
    title = "로컬 알림 테스트"
    body = "로컬 알림이 정상적으로 작동합니다!"
    
    data = {
        "type": "test",
        "title": title,
        "message": body
    }
    
    result = send_fcm_to_user(db, current_user.id, title, body, data)
    
    if result.get("success"):
        return {"message": "로컬 테스트 알림이 전송되었습니다."}
    else:
        raise HTTPException(
            status_code=500,
            detail=f"알림 전송 실패: {result.get('error', 'Unknown error')}"
        )
