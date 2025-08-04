from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate, PasswordChange, NotificationSettingsResponse, NotificationSettingsUpdate
from app.models.user import User
from app.db.database import get_db
from app.services.s3_service import s3_service
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Union
import os

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30일

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")

router = APIRouter(prefix="/users", tags=["users"])

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
    current_user.fcm_token = fcm_token
    db.commit()
    return {"message": "FCM 토큰이 저장되었습니다."}

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