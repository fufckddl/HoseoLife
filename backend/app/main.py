from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import user, email_verification, post, contact, report, chat, direct_chat
from app.db.database import Base, engine, create_database_if_not_exists
from app.models.user import User
from app.models.email_verification import EmailVerification
from app.models.post import Post
from app.models.comment import Comment
from app.models.heart import Heart
from app.models.view_log import ViewLog
# Contact 모델을 마지막에 import하여 순환 참조 방지
from app.models.contact import Contact
from app.models.report import Report, UserPenalty
from dotenv import load_dotenv
import os
import time

# FCM 서비스 import (초기화는 fcm_service.py에서 자동으로 수행됨)
try:
    from app.services import fcm_service
    print("FCM 서비스 로드 완료")
except Exception as e:
    print(f"FCM 서비스 로드 실패: {e}")

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

app.include_router(user.router)
app.include_router(email_verification.router)
app.include_router(post.router)
app.include_router(contact.router)
app.include_router(report.router)
app.include_router(chat.router)
app.include_router(direct_chat.router)

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
                "token_length": len(user.fcm_token) if user.fcm_token else 0
            })
        
        return {
            "success": True, 
            "total_users_with_tokens": len(token_info),
            "users": token_info
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
