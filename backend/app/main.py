from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.routers import user, email_verification, post, contact, report, alarm, board_request, chat, group_chat, building, upload, shuttle_bus, schedule, notification, block
import json

from app.db.database import Base, engine, create_database_if_not_exists
from app.models.user import User
from app.models.email_verification import EmailVerification
from app.models.post import Post
from app.models.comment import Comment
from app.models.heart import Heart
from app.models.view_log import ViewLog
from app.models.scrap import Scrap
# Contact 모델을 마지막에 import하여 순환 참조 방지
from app.models.contact import Contact
from app.models.report import Report, UserPenalty
# Alarm 모델 import 추가
from app.models.alarm import Alarm
# BoardRequest 모델 import 추가
from app.models.board_request import BoardRequest
# Board 모델 import 추가
from app.models.board import Board
# BoardNotice 모델 import 추가 🆕
from app.models.board_notice import BoardNotice
# Building 모델 import 추가
from app.models.building import Building
# ShuttleBus 모델 import 추가
from app.models.shuttle_bus import ShuttleBus
# Course 모델 import 추가
from app.models.schedule import Course
# UserSchedule 모델 import 추가
from app.models.user_schedule import UserSchedule
# 🆕 Notification 모델 import 추가
from app.models.notification import Notification
# 🆕 Block 모델 import 추가
from app.models.block import Block

from dotenv import load_dotenv
import os
import time
import logging

# 로깅 설정 - SQLAlchemy 로그 끄기
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
logging.getLogger('sqlalchemy.dialects').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# FCM 서비스 import (초기화는 fcm_service.py에서 자동으로 수행됨)
try:
    from app.services import fcm_service
    print("FCM 서비스 로드 완료")
except Exception as e:
    print(f"FCM 서비스 로드 실패: {e}")

# 알람 스케줄러 import 및 시작
try:
    from app.services.alarm_scheduler import alarm_scheduler
    alarm_scheduler.start()
    print("알람 스케줄러 시작 완료")
except Exception as e:
    print(f"알람 스케줄러 시작 실패: {e}")

# Redis 서비스 import 및 초기화
try:
    from app.services.redis_service import redis_service
    from app.websocket_manager import manager
    print("Redis 서비스 및 WebSocket Manager 로드 완료")
except Exception as e:
    print(f"Redis 서비스 로드 실패: {e}")

# 환경 변수 로드
load_dotenv()
# 서버 시작 시 데이터베이스 및 테이블 자동 생성
import time

try:
    print("데이터베이스 초기화 시작...")
    create_database_if_not_exists()
    
    # 데이터베이스 생성 후 잠시 대기
    time.sleep(1)
    
    print("테이블 생성 시작...")
    Base.metadata.create_all(bind=engine)
    print("데이터베이스 및 테이블 생성 완료")
except Exception as e:
    print(f"데이터베이스 초기화 오류: {e}")
    print(f"오류 타입: {type(e)}")
    print("오류가 발생했지만 서버를 계속 시작합니다.")
    # 오류가 발생해도 서버는 시작

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경에서는 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 요청 로깅 미들웨어
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    print(f"요청 시작: {request.method} {request.url}")
    print(f"헤더: {dict(request.headers)}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    print(f"요청 완료: {request.method} {request.url} - 상태: {response.status_code} - 시간: {process_time:.2f}초")
    
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
    except Exception:
        body = b"<unreadable>"
    logger.warning("422 body=%s errors=%s", body, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.include_router(user.router)
app.include_router(email_verification.router)
app.include_router(post.router)
app.include_router(contact.router)
app.include_router(report.router)
app.include_router(chat.router)
app.include_router(group_chat.router)
app.include_router(alarm.router)
app.include_router(board_request.router)
app.include_router(building.router)
app.include_router(upload.router)
app.include_router(shuttle_bus.router)
app.include_router(schedule.router)
app.include_router(notification.router)  # 🆕 알림 라우터 추가
app.include_router(block.router)  # 🆕 차단 라우터 추가



@app.get("/")
def root():
    return {"message": "CamSaw 백엔드 API"}

@app.get("/test-fcm")
def test_fcm():
    """FCM 테스트용 엔드포인트"""
    try:
        from app.services import fcm_service
        from app.db.database import get_db
        from sqlalchemy.orm import Session
        
        db = next(get_db())
        result = fcm_service.send_fcm_to_all_users(db, "테스트 알림", "FCM이 정상적으로 작동하고 있습니다!")
        
        return {"success": True, "message": "테스트 알림 전송 완료", "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/check-fcm-tokens")
def check_fcm_tokens():
    """FCM 토큰 확인용 엔드포인트"""
    try:
        from app.db.database import get_db
        from app.models.user import User
        
        db = next(get_db())
        users_with_tokens = db.query(User).filter(User.fcm_token != None).all()
        
        token_info = []
        for user in users_with_tokens:
            token_info.append({
                "user_id": user.id,
                "nickname": user.nickname,
                "has_token": bool(user.fcm_token),
                "token_length": len(user.fcm_token) if user.fcm_token else 0,
                "notifications_enabled": user.notifications_enabled
            })
        
        return {
            "success": True, 
            "total_users_with_tokens": len(token_info),
            "users": token_info
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/test-group-chat-notification")
def test_group_chat_notification():
    """그룹 채팅 알림 테스트용 엔드포인트"""
    try:
        from app.db.database import get_db
        from app.models.user import User
        from app.services.fcm_service import send_group_chat_notification
        
        db = next(get_db())
        
        # 테스트용 사용자들 (실제 사용자 ID로 변경 필요)
        test_user_ids = [1, 2]  # 실제 존재하는 사용자 ID로 변경
        
        result = send_group_chat_notification(
            db=db,
            chat_room_name="테스트 채팅방",
            sender_nickname="테스트 발신자",
            message_content="테스트 메시지입니다.",
            recipient_ids=test_user_ids,
            chat_room_id=1
        )
        
        return {
            "success": True,
            "test_result": result,
            "test_user_ids": test_user_ids
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행되는 이벤트"""
    try:
        # Redis 초기화
        await redis_service.initialize()
        print("✅ Redis 서비스 초기화 완료")
        
        # WebSocket Manager Redis 초기화
        await manager.initialize_redis()
        print("✅ WebSocket Manager Redis 초기화 완료")
        
    except Exception as e:
        print(f"❌ 서버 시작 이벤트 실패: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 실행되는 이벤트"""
    try:
        # WebSocket Manager 정리
        await manager.close()
        print("✅ WebSocket Manager 종료 완료")
        
        # Redis 연결 종료
        await redis_service.close()
        print("✅ Redis 서비스 종료 완료")
        
    except Exception as e:
        print(f"❌ 서버 종료 이벤트 실패: {e}")
