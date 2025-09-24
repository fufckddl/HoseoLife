import base64
import hashlib
import hmac
import os
from cryptography.fernet import Fernet
from datetime import datetime, timedelta

class RoomLinkEncryption:
    def __init__(self):
        # 환경 변수에서 키를 가져오거나 기본값 사용
        self.secret_key = os.getenv('ROOM_LINK_SECRET_KEY', 'your-secret-key-here-32-chars-long!')
        # Fernet 키 생성 (32바이트를 base64로 인코딩)
        key = base64.urlsafe_b64encode(hashlib.sha256(self.secret_key.encode()).digest())
        self.cipher = Fernet(key)
    
    def encrypt_room_id(self, room_id: int) -> str:
        """채팅방 ID를 암호화하여 공유 코드를 생성합니다."""
        # room_id를 문자열로 변환하고 타임스탬프 추가
        data = f"{room_id}:{int(datetime.now().timestamp())}"
        encrypted_data = self.cipher.encrypt(data.encode())
        # URL 안전한 base64로 인코딩
        return base64.urlsafe_b64encode(encrypted_data).decode().rstrip('=')
    
    def decrypt_room_id(self, encrypted_code: str) -> int:
        """암호화된 공유 코드를 복호화하여 채팅방 ID를 반환합니다."""
        try:
            # 패딩 추가
            padding = 4 - len(encrypted_code) % 4
            if padding != 4:
                encrypted_code += '=' * padding
            
            # base64 디코딩
            encrypted_data = base64.urlsafe_b64decode(encrypted_code)
            # 복호화
            decrypted_data = self.cipher.decrypt(encrypted_data).decode()
            # room_id 추출
            room_id_str, timestamp_str = decrypted_data.split(':')
            room_id = int(room_id_str)
            
            # 링크 유효성 검사 (24시간)
            timestamp = int(timestamp_str)
            link_time = datetime.fromtimestamp(timestamp)
            if datetime.now() - link_time > timedelta(hours=24):
                raise ValueError("링크가 만료되었습니다")
            
            return room_id
        except Exception as e:
            raise ValueError(f"유효하지 않은 공유 링크입니다: {str(e)}")

# 전역 인스턴스
room_link_encryption = RoomLinkEncryption()
