"""
JWT 토큰 검증 모듈
WebSocket 연결 시 사용자 인증을 담당합니다.
"""
import jwt
from typing import Optional, Dict, Any
import os
from datetime import datetime

# 환경변수에서 SECRET_KEY 가져오기
SECRET_KEY = os.getenv("SECRET_KEY", "iME5K3LhkeSU7xRvhF67bAsUXl9DHomPPHmgATjlZi4")
ALGORITHM = "HS256"

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    JWT 토큰을 검증하고 페이로드를 반환합니다.
    
    Args:
        token: JWT 토큰 문자열
        
    Returns:
        토큰이 유효한 경우 페이로드 딕셔너리, 그렇지 않으면 None
    """
    try:
        # Bearer 접두사 제거
        if token.startswith("Bearer "):
            token = token[7:]
        
        # JWT 토큰 디코딩
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 토큰 만료 시간 확인
        if "exp" in payload:
            exp_timestamp = payload["exp"]
            current_timestamp = datetime.utcnow().timestamp()
            if current_timestamp > exp_timestamp:
                print(f"❌ 토큰 만료됨: exp={exp_timestamp}, current={current_timestamp}")
                return None
        
        print(f"✅ JWT 토큰 검증 성공: user_id={payload.get('sub')}")
        return payload
        
    except jwt.ExpiredSignatureError:
        print("❌ JWT 토큰 만료됨")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ JWT 토큰 검증 실패: {e}")
        return None
    except Exception as e:
        print(f"❌ JWT 토큰 처리 오류: {e}")
        return None

def extract_user_id(token: str) -> Optional[int]:
    """
    JWT 토큰에서 사용자 ID를 추출합니다.
    
    Args:
        token: JWT 토큰 문자열
        
    Returns:
        사용자 ID (정수), 실패 시 None
    """
    payload = verify_token(token)
    if payload and "sub" in payload:
        try:
            return int(payload["sub"])
        except (ValueError, TypeError):
            print(f"❌ 사용자 ID 변환 실패: {payload.get('sub')}")
            return None
    return None
