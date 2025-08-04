import firebase_admin
from firebase_admin import credentials, messaging
from app.models.user import User
from typing import List, Optional
import json
import os

# Firebase Admin SDK 초기화
def initialize_firebase():
    """Firebase Admin SDK 초기화"""
    try:
        # 서비스 계정 키 파일 경로 (실제 파일로 교체 필요)
        service_account_path = "camsawAccountKey.json"  # backend 폴더 내에 저장
        
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK 초기화 성공")
        else:
            print("서비스 계정 키 파일을 찾을 수 없습니다.")
            print("Firebase 콘솔에서 서비스 계정 키를 다운로드하고 backend 폴더에 'serviceAccountKey.json'으로 저장하세요.")
    except Exception as e:
        print(f"Firebase 초기화 실패: {e}")

# Firebase 초기화 시도
try:
    initialize_firebase()
except Exception as e:
    print(f"Firebase 초기화 오류: {e}")

def send_fcm_to_all_users(db, title, body):
    """모든 사용자에게 FCM 알림 전송"""
    tokens = [user.fcm_token for user in db.query(User).filter(User.fcm_token != None).all()]
    if not tokens:
        return {"message": "No FCM tokens found."}
    
    return send_fcm_to_multiple_users(db, [user.id for user in db.query(User).filter(User.fcm_token != None).all()], title, body)

def send_fcm_to_user(db, user_id: int, title: str, body: str, data: Optional[dict] = None):
    """특정 사용자에게 FCM 알림 전송"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.fcm_token:
        return {"message": "User not found or no FCM token."}
    
    # 알림 설정 확인
    if not user.notifications_enabled:
        print(f"사용자 {user.nickname}의 알림이 비활성화되어 있습니다.")
        return {"message": "Notifications are disabled for this user."}
    
    try:
        # Expo Push Token을 사용하여 알림 전송
        import requests
        
        expo_token = user.fcm_token
        message = {
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data if data else {},
            "sound": "default",
            "priority": "high"
        }
        
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate"
            },
            json=message
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Expo 알림 전송 성공: {result}")
            return {"success": True, "message_id": result.get("data", {}).get("id")}
        else:
            print(f"Expo 알림 전송 실패: {response.status_code} - {response.text}")
            return {"success": False, "error": f"HTTP {response.status_code}"}
            
    except Exception as e:
        print(f"Expo 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}

def send_fcm_to_multiple_users(db, user_ids: List[int], title: str, body: str, data: Optional[dict] = None):
    """여러 사용자에게 FCM 알림 전송"""
    # 알림이 활성화된 사용자만 필터링
    users = db.query(User).filter(
        User.id.in_(user_ids), 
        User.fcm_token != None,
        User.notifications_enabled == True
    ).all()
    tokens = [user.fcm_token for user in users]
    
    if not tokens:
        return {"message": "No FCM tokens found or all users have notifications disabled."}
    
    try:
        # Expo Push Token을 사용하여 알림 전송
        import requests
        
        # 배치로 전송 (Expo는 최대 100개씩)
        batch_size = 100
        results = []
        success_count = 0
        failure_count = 0
        
        for i in range(0, len(tokens), batch_size):
            batch_tokens = tokens[i:i + batch_size]
            
            # Expo 배치 메시지 형식
            messages = []
            for token in batch_tokens:
                messages.append({
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data if data else {},
                    "sound": "default",
                    "priority": "high"
                })
            
            response = requests.post(
                "https://exp.host/--/api/v2/push/send",
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate"
                },
                json=messages
            )
            
            if response.status_code == 200:
                result = response.json()
                batch_results = result if isinstance(result, list) else [result]
                
                for j, batch_result in enumerate(batch_results):
                    if batch_result.get("status") == "ok":
                        results.append({"token": batch_tokens[j], "success": True, "message_id": batch_result.get("id")})
                        success_count += 1
                        print(f"Expo 알림 전송 성공: {batch_result.get('id')}")
                    else:
                        results.append({"token": batch_tokens[j], "success": False, "error": batch_result.get("message", "Unknown error")})
                        failure_count += 1
                        print(f"Expo 알림 전송 실패 (토큰: {batch_tokens[j][:10]}...): {batch_result.get('message')}")
            else:
                for token in batch_tokens:
                    results.append({"token": token, "success": False, "error": f"HTTP {response.status_code}"})
                    failure_count += 1
                print(f"Expo 배치 알림 전송 실패: {response.status_code} - {response.text}")
        
        print(f"전체 전송 결과: 성공 {success_count}, 실패 {failure_count}")
        return {"success": True, "success_count": success_count, "failure_count": failure_count, "results": results}
    except Exception as e:
        print(f"Expo 배치 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}

def send_comment_notification(db, post_author_id: int, commenter_nickname: str, post_title: str):
    """댓글 알림 전송"""
    title = "새로운 댓글"
    body = f"{commenter_nickname}님이 '{post_title}'에 댓글을 남겼습니다."
    
    data = {
        "type": "comment",
        "post_title": post_title,
        "commenter": commenter_nickname
    }
    
    return send_fcm_to_user(db, post_author_id, title, body, data)

def send_chat_notification(db, chat_room_id: int, sender_nickname: str, message_content: str, recipient_ids: List[int]):
    """채팅 알림 전송"""
    title = "새로운 채팅"
    body = f"{sender_nickname}: {message_content}"
    
    data = {
        "type": "chat",
        "chat_room_id": str(chat_room_id),
        "sender": sender_nickname,
        "message": message_content
    }
    
    return send_fcm_to_multiple_users(db, recipient_ids, title, body, data)

def send_direct_message_notification(db, sender_nickname: str, message_content: str, receiver_id: int):
    """1:1 메시지 알림 전송"""
    title = "새로운 메시지"
    body = f"{sender_nickname}: {message_content}"
    
    data = {
        "type": "direct_message",
        "sender": sender_nickname,
        "message": message_content
    }
    
    return send_fcm_to_user(db, receiver_id, title, body, data) 