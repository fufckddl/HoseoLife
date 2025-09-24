from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, PasswordChange, NotificationSettingsResponse, NotificationSettingsUpdate
from app.models.user import User
from app.db.database import get_db
from app.services.s3_service import s3_service
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Union, List, Optional
import os
from app.models.post import Post
from app.models.comment import Comment
from app.models.report import Report, UserPenalty
from app.models.contact import Contact
from app.models.board import Board
from app.models.board_request import BoardRequest
from sqlalchemy import or_, text

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30일

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

router = APIRouter(prefix="/users", tags=["users"])

def decode_token(token: str):
    """JWT 토큰을 디코드하여 페이로드를 반환합니다."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 🆕 닉네임 중복 체크 API
@router.get("/check-nickname/{nickname}")
def check_nickname_availability(
    nickname: str,
    db: Session = Depends(get_db)
):
    """닉네임 사용 가능 여부를 확인합니다."""
    print(f"=== 닉네임 중복 체크 ===")
    print(f"확인할 닉네임: {nickname}")
    
    # 닉네임 길이 체크 (2-20자)
    if len(nickname) < 2 or len(nickname) > 20:
        return {
            "available": False,
            "message": "닉네임은 2-20자 사이여야 합니다."
        }
    
    # 특수문자 체크 (한글, 영문, 숫자만 허용)
    import re
    if not re.match(r'^[가-힣a-zA-Z0-9]+$', nickname):
        return {
            "available": False,
            "message": "닉네임은 한글, 영문, 숫자만 사용 가능합니다."
        }
    
    # 데이터베이스에서 중복 체크
    existing_user = db.query(User).filter(User.nickname == nickname).first()
    
    if existing_user:
        print(f"❌ 이미 사용 중인 닉네임: {nickname}")
        return {
            "available": False,
            "message": "이미 사용 중인 닉네임입니다."
        }
    else:
        print(f"✅ 사용 가능한 닉네임: {nickname}")
        return {
            "available": True,
            "message": "사용 가능한 닉네임입니다."
        }

@router.post("/check-board-name")
def check_board_name_availability(
    request_data: dict,
    db: Session = Depends(get_db)
):
    """게시판 이름 중복 검증"""
    try:
        board_name = request_data.get("name", "").strip()
        print(f"🔍 게시판 이름 검증 요청: '{board_name}'")
        
        if not board_name:
            return {
                "available": False,
                "message": "게시판 이름을 입력해주세요."
            }
        
        # 기존 게시판에서 동일한 이름 확인
        existing_board = db.execute(text("""
            SELECT id FROM boards WHERE name = :board_name AND is_active = TRUE
        """), {'board_name': board_name}).fetchone()
        
        # 대기 중인 게시판 요청에서 동일한 이름 확인
        pending_request = db.execute(text("""
            SELECT id FROM board_requests WHERE name = :board_name AND status = 'pending'
        """), {'board_name': board_name}).fetchone()
        
        is_available = not existing_board and not pending_request
        
        result = {
            "available": is_available,
            "message": "사용 가능한 게시판 이름입니다." if is_available else "이미 사용 중이거나 대기 중인 게시판 이름입니다."
        }
        
        if existing_board:
            result["reason"] = "existing_board"
        elif pending_request:
            result["reason"] = "pending_request"
        
        print(f"✅ 게시판 이름 검증 결과: '{board_name}' -> {result}")
        return result
        
    except Exception as e:
        print(f"❌ 게시판 이름 검증 실패: {e}")
        return {
            "available": False,
            "message": "이름 확인 중 오류가 발생했습니다."
        }

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # 이메일/닉네임 중복 체크
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    if db.query(User).filter(User.nickname == user.nickname).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
    hashed_pw = get_password_hash(user.password)
    db_user = User(email=user.email, nickname=user.nickname, hashed_password=hashed_pw, university=user.university)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    print(f"로그인 시도: {user.email}")
    
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        print(f"사용자를 찾을 수 없음: {user.email}")
        raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    
    if not verify_password(user.password, db_user.hashed_password):
        print(f"비밀번호 검증 실패: {user.email}")
        raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    
    print(f"로그인 성공: {user.email}")
    access_token = create_access_token({"sub": str(db_user.id)})
    response_data = {"access_token": access_token, "token_type": "bearer"}
    print(f"응답 데이터: {response_data}")
    return response_data

@router.get("/profile", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자의 프로필 정보를 조회합니다."""
    return current_user

@router.put("/profile", response_model=UserResponse)
def update_user_profile(
    user_update: UserUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """현재 로그인한 사용자의 프로필 정보를 업데이트합니다."""
    # 닉네임 중복 체크 (다른 사용자가 사용 중인지)
    if user_update.nickname and user_update.nickname != current_user.nickname:
        existing_user = db.query(User).filter(User.nickname == user_update.nickname).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
    
    # 업데이트할 필드만 변경
    if user_update.nickname is not None:
        current_user.nickname = user_update.nickname
    if user_update.university is not None:
        current_user.university = user_update.university
    
    db.commit()
    db.refresh(current_user)
    return current_user 

@router.post("/update-fcm-token")
def update_fcm_token(
    fcm_token: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"=== FCM 토큰 업데이트 요청 ===")
    print(f"사용자: {current_user.nickname} (ID: {current_user.id})")
    print(f"새 FCM 토큰: {fcm_token[:20]}...")
    
    current_user.fcm_token = fcm_token
    db.commit()
    
    print(f"✅ FCM 토큰 업데이트 완료")
    return {"message": "FCM 토큰이 저장되었습니다."}

@router.post("/clear-fcm-token")
def clear_fcm_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """FCM 토큰 제거 (로그아웃 시 호출)"""
    print(f"=== FCM 토큰 제거 요청 ===")
    print(f"사용자: {current_user.nickname} (ID: {current_user.id})")
    print(f"기존 FCM 토큰: {current_user.fcm_token[:20] if current_user.fcm_token else 'None'}...")
    
    current_user.fcm_token = None
    db.commit()
    
    print(f"✅ FCM 토큰 제거 완료")
    return {"message": "FCM 토큰이 제거되었습니다."}

@router.post("/test-notification")
def test_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """테스트 알림 전송 (디버깅용)"""
    print(f"=== 테스트 알림 전송 ===")
    print(f"사용자: {current_user.nickname} (ID: {current_user.id})")
    print(f"FCM 토큰: {current_user.fcm_token[:20] if current_user.fcm_token else 'None'}...")
    print(f"알림 설정: {current_user.notifications_enabled}")
    
    from app.services.fcm_service import send_fcm_to_user
    
    result = send_fcm_to_user(
        db=db,
        user_id=current_user.id,
        title="테스트 알림",
        body="이것은 테스트 알림입니다.",
        data={"type": "test", "message": "테스트 메시지"}
    )
    
    print(f"테스트 알림 전송 결과: {result}")
    return {"message": "테스트 알림이 전송되었습니다.", "result": result}

@router.post("/test-notification-all")
def test_notification_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 사용자에게 테스트 알림 전송 (관리자만)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    print(f"=== 모든 사용자 테스트 알림 전송 ===")
    print(f"요청자: {current_user.nickname} (ID: {current_user.id})")
    
    from app.services.fcm_service import send_fcm_to_all_users
    
    result = send_fcm_to_all_users(
        db=db,
        title="전체 테스트 알림",
        body="모든 사용자에게 전송되는 테스트 알림입니다."
    )
    
    print(f"전체 테스트 알림 전송 결과: {result}")
    return {"message": "모든 사용자에게 테스트 알림이 전송되었습니다.", "result": result}

# 🆕 회원탈퇴 API (데이터 익명화 방식)
@router.delete("/deactivate")
def deactivate_user_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """회원탈퇴 처리 (데이터 익명화, 게시글/댓글 유지)"""
    print(f"=== 회원탈퇴 요청 ===")
    print(f"사용자: {current_user.nickname} (ID: {current_user.id})")
    print(f"이메일: {current_user.email}")
    
    try:
        from app.utils.date_utils import get_current_korea_time
        from sqlalchemy import text
        
        deactivation_time = get_current_korea_time()
        
        # 🔧 사용자 정보 익명화 (데이터는 유지)
        original_nickname = current_user.nickname
        original_email = current_user.email
        
        # 사용자 계정 비활성화 및 정보 익명화
        current_user.is_active = False
        current_user.nickname = f"(알수없음){current_user.id}"  # 🔧 고유한 익명 닉네임 (ID 포함)
        current_user.email = f"deactivated_{current_user.id}_{int(deactivation_time.timestamp())}@deleted.local"  # 🔧 이메일 익명화
        current_user.hashed_password = "DEACTIVATED"  # 🔧 비밀번호 무효화
        current_user.fcm_token = None  # FCM 토큰 제거
        current_user.profile_image_url = None  # 프로필 이미지 제거
        current_user.notifications_enabled = False  # 알림 비활성화
        
        # 🔧 채팅방 멤버십 비활성화 (채팅방에서 제외)
        db.execute(text("""
            UPDATE memberships 
            SET is_active = FALSE 
            WHERE user_id = :user_id
        """), {'user_id': current_user.id})
        
        # 🔧 개인 데이터 안전 삭제 (테이블 존재 여부 확인)
        personal_data_tables = [
            ('user_schedules', '사용자 시간표'),
            ('alarms', '알람'),
            ('scraps', '스크랩'),
            ('view_logs', '조회 기록'),
            ('contacts', '문의'),
            ('notifications', '알림 기록')
        ]
        
        for table_name, description in personal_data_tables:
            try:
                result = db.execute(text(f"""
                    DELETE FROM {table_name} 
                    WHERE user_id = :user_id
                """), {'user_id': current_user.id})
                deleted_count = result.rowcount
                print(f"✅ {description} 삭제 완료: {deleted_count}개")
            except Exception as e:
                if "doesn't exist" in str(e):
                    print(f"⚠️ {table_name} 테이블이 없음 (무시)")
                else:
                    print(f"❌ {description} 삭제 실패: {e}")
        
        # 🔧 채팅방 나간 시간 기록 삭제 (개인 데이터) - 테이블 존재 시에만
        try:
            db.execute(text("""
                DELETE FROM user_room_leave_times 
                WHERE user_id = :user_id
            """), {'user_id': current_user.id})
            print("✅ 채팅방 나간 시간 기록 삭제 완료")
        except Exception as e:
            if "doesn't exist" in str(e):
                print("⚠️ user_room_leave_times 테이블이 없음 (무시)")
            else:
                print(f"❌ 채팅방 나간 시간 기록 삭제 실패: {e}")
        
        db.commit()
        
        print(f"✅ 회원탈퇴 완료")
        print(f"  - 원래 닉네임: {original_nickname} → (알수없음)")
        print(f"  - 원래 이메일: {original_email} → 익명화됨")
        print(f"  - 게시글/댓글: 유지됨 (작성자만 익명화)")
        print(f"  - 개인 데이터: 삭제됨 (시간표, 알람, 스크랩 등)")
        print(f"  - 채팅방 멤버십: 비활성화됨")
        
        return {
            "message": "회원탈퇴가 완료되었습니다. 게시글과 댓글은 익명으로 유지됩니다.",
            "deactivated_at": deactivation_time.isoformat()
        }
        
    except Exception as e:
        print(f"❌ 회원탈퇴 처리 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="회원탈퇴 처리 중 오류가 발생했습니다.")

@router.post("/change-password")
def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 로그인한 사용자의 비밀번호를 변경합니다."""
    print(f"비밀번호 변경 시도: {current_user.email}")
    
    # 현재 비밀번호 확인
    if not verify_password(password_change.current_password, current_user.hashed_password):
        print(f"현재 비밀번호 검증 실패: {current_user.email}")
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    
    # 새 비밀번호가 현재 비밀번호와 다른지 확인
    if password_change.current_password == password_change.new_password:
        print(f"새 비밀번호가 현재 비밀번호와 동일: {current_user.email}")
        raise HTTPException(status_code=400, detail="새 비밀번호는 현재 비밀번호와 달라야 합니다.")
    
    # 새 비밀번호 해시화
    new_hashed_password = get_password_hash(password_change.new_password)
    current_user.hashed_password = new_hashed_password
    
    db.commit()
    print(f"비밀번호 변경 성공: {current_user.email}")
    return {"message": "비밀번호가 성공적으로 변경되었습니다."}

@router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 프로필 이미지를 업로드합니다."""
    print(f"프로필 이미지 업로드 요청 받음: 사용자 {current_user.id}")
    
    # 파일 타입 검증
    if not file.content_type.startswith('image/'):
        print(f"잘못된 파일 타입: {file.content_type}")
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    
    # 파일 크기 검증 (5MB 제한)
    if file.size and file.size > 5 * 1024 * 1024:
        print(f"파일 크기 초과: {file.size} bytes")
        raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")
    
    try:
        # 파일 데이터 읽기
        file_data = await file.read()
        print(f"파일 데이터 읽기 완료: {len(file_data)} bytes")
        
        # S3에 업로드
        image_url = await s3_service.upload_profile_image(
            file_data=file_data,
            user_id=current_user.id,
            original_filename=file.filename or "profile_image.jpg"
        )
        
        # 데이터베이스에 URL 저장
        current_user.profile_image_url = image_url
        db.commit()
        db.refresh(current_user)
        
        print(f"프로필 이미지 업로드 성공: {image_url}")
        
        return {
            "message": "프로필 이미지가 성공적으로 업로드되었습니다.",
            "profile_image_url": image_url
        }
        
    except Exception as e:
        print(f"프로필 이미지 업로드 오류: {e}")
        print(f"오류 타입: {type(e)}")
        raise HTTPException(status_code=500, detail=f"프로필 이미지 업로드에 실패했습니다: {str(e)}")

@router.delete("/delete-profile-image")
async def delete_profile_image(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 프로필 이미지를 삭제합니다."""
    try:
        if current_user.profile_image_url:
            # S3에서 이미지 삭제
            await s3_service.delete_profile_image(current_user.id)
            
            # 데이터베이스에서 URL 제거
            current_user.profile_image_url = None
            db.commit()
            
            return {"message": "프로필 이미지가 삭제되었습니다."}
        else:
            return {"message": "프로필 이미지가 없습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"프로필 이미지 삭제에 실패했습니다: {str(e)}")

@router.get("/notification-settings", response_model=NotificationSettingsResponse)
def get_notification_settings(current_user: User = Depends(get_current_user)):
    """현재 사용자의 알림 설정을 조회합니다."""
    return NotificationSettingsResponse(notifications_enabled=current_user.notifications_enabled)

@router.put("/notification-settings")
def update_notification_settings(
    settings: NotificationSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 알림 설정을 업데이트합니다."""
    try:
        current_user.notifications_enabled = settings.notifications_enabled
        db.commit()
        
        return {"message": f"알림 설정이 {'활성화' if settings.notifications_enabled else '비활성화'}되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"알림 설정 업데이트에 실패했습니다: {str(e)}") 

# 회원 탈퇴
@router.delete("/withdraw", status_code=status.HTTP_200_OK)
def withdraw_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 회원 탈퇴를 처리합니다."""
    try:
        print(f"회원 탈퇴 시작: 사용자 {current_user.nickname} (ID: {current_user.id})")
        
        # "삭제된 사용자" 레코드 생성 또는 조회
        deleted_user = db.query(User).filter(User.email == "deleted@deleted.com").first()
        if not deleted_user:
            deleted_user = User(
                email="deleted@deleted.com",
                nickname="알 수 없음",
                hashed_password="",  # 빈 문자열
                university="",
                is_admin=False,
                is_premium=False
            )
            db.add(deleted_user)
            db.flush()  # ID 생성
        
        # 1. 사용자가 작성한 게시글들의 작성자를 "삭제된 사용자"로 변경
        posts = db.query(Post).filter(Post.author_id == current_user.id).all()
        for post in posts:
            post.author_id = deleted_user.id
        
        # 2. 사용자가 작성한 댓글들의 작성자를 "삭제된 사용자"로 변경
        comments = db.query(Comment).filter(Comment.author_id == current_user.id).all()
        for comment in comments:
            comment.author_id = deleted_user.id
        
        # 3. 사용자가 작성한 신고들의 신고자를 "삭제된 사용자"로 변경
        reports = db.query(Report).filter(Report.reporter_id == current_user.id).all()
        for report in reports:
            report.reporter_id = deleted_user.id
        
        # 4. 사용자 관련 처벌 기록들 삭제
        penalties = db.query(UserPenalty).filter(UserPenalty.user_id == current_user.id).all()
        for penalty in penalties:
            db.delete(penalty)
        
        # 5. 사용자 관련 연락처 기록들 삭제
        contacts = db.query(Contact).filter(Contact.user_id == current_user.id).all()
        for contact in contacts:
            db.delete(contact)
        
        # 6. 사용자 정보 삭제
        db.delete(current_user)
        
        db.commit()
        print(f"회원 탈퇴 완료: 사용자 {current_user.nickname}")
        
        return {"message": "회원 탈퇴가 완료되었습니다."}
        
    except Exception as e:
        db.rollback()
        print(f"회원 탈퇴 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail="회원 탈퇴 처리 중 오류가 발생했습니다."
        ) 

# 사용자 목록 조회 (채팅용)
@router.get("/list", response_model=List[UserResponse])
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 목록을 조회합니다 (채팅용)."""
    query = db.query(User)
    
    # 검색 필터
    if search:
        query = query.filter(
            or_(
                User.nickname.contains(search),
                User.email.contains(search)
            )
        )
    
    # 자신 제외
    query = query.filter(User.id != current_user.id)
    
    users = query.offset(skip).limit(limit).all()
    return users 