from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.email_verification import EmailVerification
from datetime import datetime, timedelta
from pydantic import BaseModel
import random
import smtplib
from email.mime.text import MIMEText
from app.models.user import User

router = APIRouter(prefix="/email", tags=["email"])

CODE_EXPIRE_MINUTES = 10

# DB 세션 의존성

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic 모델 정의
class EmailRequest(BaseModel):
    email: str

class EmailVerifyRequest(BaseModel):
    email: str
    code: str

def send_email(to_email, code):
    msg = MIMEText(f"CamSaw 인증코드: {code}")
    msg['Subject'] = 'CamSaw 이메일 인증코드'
    msg['From'] = 'dlckdfuf141@gmail.com'
    msg['To'] = to_email

    s = smtplib.SMTP_SSL('smtp.gmail.com', 465)
    s.login('dlckdfuf141@gmail.com', 'ronx wvgk wcis jfsu')
    s.send_message(msg)
    s.quit()

# 인증 코드 발송
@router.post("/send")
def send_code(req: EmailRequest, db: Session = Depends(get_db)):
    email = req.email
    # 이미 가입된 이메일인지 체크
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    code = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=CODE_EXPIRE_MINUTES)
    # 기존 인증 내역 삭제/갱신
    db_ver = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if db_ver:
        db_ver.code = code
        db_ver.expires_at = expires_at
        db_ver.verified = False
    else:
        db_ver = EmailVerification(email=email, code=code, expires_at=expires_at, verified=False)
        db.add(db_ver)
    db.commit()
    # 실제 이메일 발송 대신 print
    send_email(email, code)
    return {"message": "인증 코드가 발송되었습니다."}

# 인증 코드 검증
@router.post("/verify")
def verify_code(req: EmailVerifyRequest, db: Session = Depends(get_db)):
    email = req.email
    code = req.code
    db_ver = db.query(EmailVerification).filter(EmailVerification.email == email).first()
    if not db_ver or db_ver.code != code:
        raise HTTPException(status_code=400, detail="인증 코드가 올바르지 않습니다.")
    if db_ver.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다.")
    db_ver.verified = True
    db.commit()
    return {"message": "이메일 인증이 완료되었습니다."} 