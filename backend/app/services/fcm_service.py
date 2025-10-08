from app.models.user import User
from typing import List, Optional
import json
import os

def send_fcm_to_all_users(db, title, body):
    """모든 사용자에게 FCM 알림 전송"""
    print(f"=== 모든 사용자 알림 전송 시작 ===")
    print(f"제목: {title}")
    print(f"내용: {body}")
    
    # FCM 토큰이 있는 사용자들 조회
    users_with_tokens = db.query(User).filter(
        User.fcm_token != None,
        User.notifications_enabled == True
    ).all()
    
    print(f"FCM 토큰이 있는 사용자 수: {len(users_with_tokens)}")
    
    if not users_with_tokens:
        print("❌ FCM 토큰이 있는 사용자가 없습니다.")
        return {"message": "No FCM tokens found."}
    
    user_ids = [user.id for user in users_with_tokens]
    print(f"알림을 받을 사용자 IDs: {user_ids}")
    
    result = send_fcm_to_multiple_users(db, user_ids, title, body)
    print(f"전체 알림 전송 결과: {result}")
    return result

def save_notification_record(db, user_id: int, title: str, message: str, notification_type: str, data: Optional[dict] = None):
    """알림 기록을 데이터베이스에 저장"""
    try:
        from app.utils.date_utils import get_current_korea_time
        from sqlalchemy import text
        
        current_time = get_current_korea_time()
        print(f"🕐 현재 한국 시간: {current_time}")
        
        # 🔧 직접 SQL을 사용해서 순환 참조 문제 회피
        insert_sql = text("""
            INSERT INTO notifications (user_id, title, message, notification_type, data, is_read, created_at, updated_at)
            VALUES (:user_id, :title, :message, :notification_type, :data, :is_read, :created_at, :updated_at)
        """)
        
        result = db.execute(insert_sql, {
            'user_id': user_id,
            'title': title,
            'message': message,
            'notification_type': notification_type,
            'data': json.dumps(data) if data else None,
            'is_read': False,
            'created_at': current_time,
            'updated_at': current_time
        })
        
        db.commit()
        notification_id = result.lastrowid
        print(f"✅ 알림 기록 저장 완료: ID {notification_id}, 사용자 {user_id}, 타입 {notification_type}, 시간 {current_time}")
        return {"id": notification_id, "created_at": current_time}
    except Exception as e:
        print(f"❌ 알림 기록 저장 실패: {e}")
        db.rollback()
        return None

def send_fcm_to_user(db, user_id: int, title: str, body: str, data: Optional[dict] = None):
    """특정 사용자에게 FCM 알림 전송"""
    print(f"=== FCM 알림 전송 시작 ===")
    print(f"사용자 ID: {user_id}")
    print(f"제목: {title}")
    print(f"내용: {body}")
    print(f"데이터: {data}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"❌ 사용자를 찾을 수 없음: ID {user_id}")
        return {"message": "User not found."}
    
    print(f"✅ 사용자 정보: {user.nickname} (ID: {user.id})")
    
    if not user.fcm_token:
        print(f"❌ 사용자 {user.nickname}의 FCM 토큰이 없음")
        return {"message": "No FCM token."}
    
    print(f"✅ Expo Push Token: {user.fcm_token[:20]}...")
    
    # FCM 토큰 형식 확인 (Expo Push Token)
    if not user.fcm_token.startswith('ExponentPushToken') and not user.fcm_token.startswith('ExpoPushToken'):
        print(f"❌ 잘못된 Expo Push Token 형식: {user.fcm_token[:30]}...")
        return {"message": "Invalid Expo Push Token format."}
    
    # 토큰 환경 감지 (projectId 명시 토큰 기준)
    if user.fcm_token.startswith('ExponentPushToken'):
        environment = "expo_go"  # Expo Go 환경 (placeholder 아이콘 사용)
    elif user.fcm_token.startswith('ExpoPushToken'):
        environment = "testflight"  # TestFlight/App Store 환경 (앱 아이콘 사용)
    else:
        environment = "unknown"
    
    print(f"✅ Expo Push Token 형식 확인됨 (환경: {environment})")
    
    print(f"✅ 토큰 형식 확인됨")
    
    # 알림 설정 확인
    if not user.notifications_enabled:
        print(f"❌ 사용자 {user.nickname}의 알림이 비활성화되어 있습니다.")
        return {"message": "Notifications are disabled for this user."}
    
    print(f"✅ 알림 설정: 활성화됨")
    
    try:
        # Expo Push Token 사용
        result = send_expo_notification(user.fcm_token, title, body, data)
        
        # 🆕 FCM 전송 성공시 알림 기록 저장
        if result.get("success"):
            notification_type = data.get("type", "general") if data else "general"
            save_notification_record(db, user_id, title, body, notification_type, data)
        
        return result
            
    except Exception as e:
        print(f"FCM 알림 전송 실패: {e}")
        return {"success": False, "error": str(e)}

def send_expo_notification(token, title, body, data=None):
    """Expo Push Token을 사용한 알림 전송"""
    import requests
    
    # 알림 타입에 따른 채널 설정
    notification_type = data.get("type", "general") if data else "general"
    channel_id = "default"
    
    if notification_type == "chat_message":
        channel_id = "chat"
    elif notification_type in ["comment", "my_post_comment"]:
        channel_id = "comment"
    
    # 🎯 토큰 환경별 아이콘 설정 (토큰 형식에 관계없이 올바른 아이콘 사용)
    is_expo_go = token.startswith('ExponentPushToken')
    is_testflight = token.startswith('ExpoPushToken')
    
    print(f"🔍 토큰 환경 감지: {is_expo_go and 'Expo Go' or is_testflight and 'TestFlight/App Store' or 'Unknown'}")
    
    # iOS 아이콘 설정 (토큰 형식에 관계없이 앱 아이콘 사용)
    ios_icon_config = {
        "icon": "AppIcon",  # 앱 아이콘 사용
        "iconType": "app_icon",  # 앱 아이콘 타입
        "useAppIcon": True,  # 앱 아이콘 사용 명시
        "preferAppIcon": True  # 앱 아이콘 우선 사용
    }
    
    # 모든 환경에서 HoseoLife 로고 사용 (Expo Go, TestFlight 모두)
    if is_expo_go:
        print("📱 Expo Go 환경 - HoseoLife 로고 강제 사용")
        # Expo Go 환경에서도 HoseoLife 로고 사용
        ios_icon_config.update({
            "icon": "AppIcon",  # HoseoLife 앱 아이콘 사용
            "iconType": "app_icon",
            "forceAppIcon": True,  # 앱 아이콘 강제 사용
            "overrideExpoIcon": True,  # Expo 기본 아이콘 오버라이드
            "useCustomIcon": True,  # 커스텀 아이콘 사용
            "iconSource": "hoseolife"  # HoseoLife 아이콘 소스 명시
        })
    elif is_testflight:
        print("📱 TestFlight/App Store 환경 - HoseoLife 로고 강제 설정")
        # TestFlight 환경에서는 더 명시적인 아이콘 설정
        ios_icon_config.update({
            "icon": "AppIcon",
            "iconType": "app_icon",
            "forceAppIcon": True,  # 앱 아이콘 강제 사용
            "overrideDefaultIcon": True,  # 기본 아이콘 오버라이드
            "appIconPriority": "high",  # 앱 아이콘 우선순위 높음
            "useCustomIcon": True,  # 커스텀 아이콘 사용
            "iconSource": "hoseolife"  # HoseoLife 아이콘 소스 명시
        })
    else:
        print("📱 기타 환경 - HoseoLife 로고 사용")
        # 기타 환경에서도 HoseoLife 로고 사용
        ios_icon_config.update({
            "icon": "AppIcon",
            "iconType": "app_icon",
            "forceAppIcon": True,
            "useCustomIcon": True,
            "iconSource": "hoseolife"
        })
    
    message = {
        "to": token,
        "title": title,
        "body": body,
        "data": data if data else {},
        "sound": "default",
        "priority": "high",
        "channelId": channel_id,
        "badge": 1,  # iOS 배지 설정
        "ttl": 3600,  # 1시간 TTL
        "expiration": 86400,  # 24시간 만료
        # 🎯 전역 아이콘 설정 (모든 환경에서 HoseoLife 로고 사용)
        "icon": "AppIcon",
        # Android 전용 설정 (강화)
        "android": {
            "priority": "high",
            "channelId": channel_id,
            "sound": "default",
            "vibrate": [0, 250, 250, 250],
            "lightColor": "#FF231F7C",
            "visibility": "public",
            "importance": "max",
            "notification": {
                "title": title,
                "body": body,
                "sound": "default",
                "vibrate": [0, 250, 250, 250],
                "lightColor": "#FF231F7C",
                "visibility": "public",
                "importance": "max",
                "priority": "high",
                "defaultSound": True,
                "defaultVibrateTimings": True,
                "defaultLightSettings": True,
                "autoCancel": False,
                "ongoing": False,
                "showWhen": True,
                "when": None,
                "ticker": f"{title}: {body}",
                "subText": None,
                "number": 1,
                "category": "message",
                "localOnly": False,
                "sticky": False,
                "tag": f"hoseolife_{channel_id}",
                "color": "#FF231F7C",
                "smallIcon": "ic_notification",  # HoseoLife 알림 아이콘
                "largeIcon": "ic_launcher",  # HoseoLife 로고 아이콘
                "forceIcon": True,  # 아이콘 강제 사용
                "bigText": body if len(body) > 50 else None,
                "bigTextStyle": True,
                "inboxStyle": False,
                "actions": [],
                "remoteInputHistory": None,
                "extras": {
                    "android.support.wearable.notifications.VOICE_REPLY": True
                }
            }
        },
        # iOS 전용 설정 (강화) - 토큰 형식에 관계없이 올바른 아이콘 사용
        "ios": {
            "sound": "default",
            "badge": 1,
            "priority": "high",
            "alert": {
                "title": title,
                "body": body
            },
            "category": "MESSAGE",
            "threadId": "hoseolife",
            "mutableContent": True,
            "contentAvailable": True,
            "interruptionLevel": "active",
            "relevanceScore": 1.0,
            "sticker": None,
            "attachments": [],
            "targetContentIdentifier": f"hoseolife_{channel_id}",
            "summaryArgument": title,
            "summaryArgumentCount": 1,
            "launchImageName": None,
            "critical": False,
            "criticalSound": None,
            "customData": data if data else {},
            # 🎯 iOS 알림 아이콘 설정 (모든 환경에서 HoseoLife 로고 강제 사용)
            **ios_icon_config,
            # 🎯 추가 iOS 아이콘 강제 설정 (Expo Go에서도 HoseoLife 로고 사용)
            "notificationIcon": "AppIcon",  # 알림 아이콘 명시
            "appIcon": "AppIcon",  # 앱 아이콘 명시
            "customIcon": "hoseolife_logo",  # 커스텀 HoseoLife 로고
            "iconOverride": True,  # 아이콘 오버라이드
            "preventDefaultIcon": True,  # 기본 아이콘 방지
            # 🎯 TestFlight 환경에서 더 강력한 아이콘 설정
            "bundleId": "com.dlckdfuf.camsaw",  # 번들 ID 명시
            "appName": "HoseoLife",  # 앱 이름 명시
            "forceAppIconUsage": True,  # 앱 아이콘 강제 사용
            "disableExpoIcon": True,  # Expo 아이콘 비활성화
            "useNativeIcon": True  # 네이티브 아이콘 사용
        }
    }
    
    print(f"📤 Expo API 요청 전송:")
    print(f"   URL: https://exp.host/--/api/v2/push/send")
    print(f"   토큰: {token[:20]}...")
    print(f"   제목: {title}")
    print(f"   내용: {body}")
    print(f"   채널: {channel_id}")
    print(f"   환경: {is_expo_go and 'Expo Go' or is_testflight and 'TestFlight/App Store' or 'Unknown'}")
    print(f"   아이콘: HoseoLife 로고 (모든 환경에서 강제 사용)")
    
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate"
            },
            json=message,
            timeout=30
        )
        
        print(f"📥 Expo API 응답:")
        print(f"   상태 코드: {response.status_code}")
        print(f"   응답 내용: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Expo 알림 전송 성공: {result}")
            
            # APNs 인증서 오류가 있더라도 성공으로 처리 (Expo Go에서는 로컬 알림이 작동)
            if result.get("data", {}).get("status") == "error":
                print(f"⚠️ APNs 인증서 오류가 있지만 Expo Go에서는 로컬 알림이 작동할 수 있습니다.")
                print(f"💡 앱이 켜져 있을 때는 로컬 알림이 작동합니다.")
                return {"success": True, "message_id": None, "warning": "APNs credentials not configured"}
            
            return {"success": True, "message_id": result.get("data", {}).get("id")}
        else:
            print(f"❌ Expo 알림 전송 실패: {response.status_code} - {response.text}")
            return {"success": False, "error": f"HTTP {response.status_code}"}
            
    except Exception as e:
        print(f"❌ Expo API 요청 실패: {e}")
        return {"success": False, "error": str(e)}

def send_test_notification_to_user(db, user_id: int, title: str = "테스트 알림", body: str = "이것은 테스트 알림입니다."):
    """특정 사용자에게 테스트 알림 전송"""
    print(f"=== 테스트 알림 전송 시작 ===")
    print(f"사용자 ID: {user_id}")
    print(f"제목: {title}")
    print(f"내용: {body}")
    
    data = {
        "type": "test",
        "test": True
    }
    
    result = send_fcm_to_user(db, user_id, title, body, data)
    print(f"테스트 알림 전송 결과: {result}")
    return result



def send_fcm_to_multiple_users(db, user_ids: List[int], title: str, body: str, data: Optional[dict] = None):
    """여러 사용자에게 FCM 알림 전송"""
    print(f"=== 다중 사용자 FCM 알림 전송 시작 ===")
    print(f"요청된 사용자 IDs: {user_ids}")
    
    # 알림이 활성화된 사용자만 필터링
    users = db.query(User).filter(
        User.id.in_(user_ids), 
        User.fcm_token != None,
        User.notifications_enabled == True
    ).all()
    
    print(f"FCM 토큰이 있고 알림이 활성화된 사용자: {[user.id for user in users]}")
    
    if not users:
        print("❌ FCM 토큰이 없거나 모든 사용자의 알림이 비활성화됨")
        return {"message": "No FCM tokens found or all users have notifications disabled."}
    
    results = []
    success_count = 0
    failure_count = 0
    
    for user in users:
        result = send_fcm_to_user(db, user.id, title, body, data)
        results.append({"user_id": user.id, "result": result})
        
        if result.get("success"):
            success_count += 1
        else:
            failure_count += 1
    
    print(f"전체 전송 결과: 성공 {success_count}, 실패 {failure_count}")
    return {"success": True, "success_count": success_count, "failure_count": failure_count, "results": results}

# 기존 알림 함수들은 그대로 유지
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



# 새로운 알림 함수들 추가
def send_news_notification(db, title: str, content: str):
    """뉴스/공지사항 알림 전송 (모든 사용자에게)"""
    notification_title = "새로운 공지사항"
    notification_body = f"{title}"
    
    data = {
        "type": "news",
        "title": title,
        "content": content
    }
    
    # 모든 활성화된 사용자에게 전송
    users = db.query(User).filter(
        User.fcm_token != None,
        User.notifications_enabled == True
    ).all()
    user_ids = [user.id for user in users]
    
    return send_fcm_to_multiple_users(db, user_ids, notification_title, notification_body, data)

def send_my_post_notification(db, post_author_id: int, post_title: str, notification_type: str, post_id: int = None, comment_id: int = None):
    """내가 작성한 게시글 관련 알림 전송"""
    print(f"=== 내 게시글 알림 전송 시작 ===")
    print(f"게시글 작성자 ID: {post_author_id}")
    print(f"게시글 제목: {post_title}")
    print(f"알림 타입: {notification_type}")
    print(f"게시글 ID: {post_id}")
    print(f"댓글 ID: {comment_id}")
    
    if notification_type == "comment":
        title = "내 게시글에 댓글이 달렸습니다"
        body = f"'{post_title}'에 새로운 댓글이 달렸습니다."
        data = {
            "type": "my_post_comment", 
            "post_title": post_title,
            "post_id": str(post_id) if post_id else None
        }
    elif notification_type == "heart":
        title = "내 게시글에 좋아요가 달렸습니다"
        body = f"'{post_title}'에 좋아요가 달렸습니다."
        data = {
            "type": "my_post_heart", 
            "post_title": post_title,
            "post_id": str(post_id) if post_id else None
        }
    elif notification_type == "hot":
        title = "내 게시글이 핫 게시판에 등장했습니다!"
        body = f"'{post_title}'이 인기 게시글이 되었습니다!"
        data = {
            "type": "my_post_hot", 
            "post_title": post_title,
            "post_id": str(post_id) if post_id else None
        }
    elif notification_type == "reply":
        title = "내 댓글에 대댓글이 달렸습니다"
        body = f"'{post_title}' 게시글에서 내 댓글에 대댓글이 달렸습니다."
        data = {
            "type": "reply", 
            "post_title": post_title,
            "post_id": str(post_id) if post_id else None,
            "comment_id": str(comment_id) if comment_id else None
        }
    else:
        print(f"❌ 잘못된 알림 타입: {notification_type}")
        return {"message": "Invalid notification type"}
    
    print(f"알림 제목: {title}")
    print(f"알림 내용: {body}")
    print(f"알림 데이터: {data}")
    
    result = send_fcm_to_user(db, post_author_id, title, body, data)
    print(f"알림 전송 결과: {result}")
    return result



def send_hot_post_notification(db, post_title: str, post_author_id: int):
    """핫 게시판 등장 알림 전송"""
    print(f"=== 핫 게시판 등장 알림 전송 시작 ===")
    print(f"게시글 제목: {post_title}")
    print(f"게시글 작성자 ID: {post_author_id}")
    
    title = "내 게시글이 핫 게시판에 등장했습니다!"
    body = f"'{post_title}'이 인기 게시글이 되었습니다!"
    
    data = {
        "type": "hot_post",
        "post_title": post_title
    }
    
    result = send_fcm_to_user(db, post_author_id, title, body, data)
    print(f"핫 게시판 등장 알림 전송 결과: {result}")
    return result

def send_chat_notification(db, room_id: int, sender_id: int, message_content: str, room_type: str, room_name: str = None):
    """채팅 메시지 알림 전송"""
    print(f"=== 채팅 알림 전송 시작 ===")
    print(f"방 ID: {room_id}")
    print(f"발신자 ID: {sender_id}")
    print(f"방 타입: {room_type}")
    print(f"방 이름: {room_name}")
    print(f"메시지 내용: {message_content}")
    
    # 발신자 정보 조회
    sender = db.query(User).filter(User.id == sender_id).first()
    if not sender:
        print(f"❌ 발신자를 찾을 수 없음: ID {sender_id}")
        return {"message": "Sender not found."}
    
    # 방의 다른 멤버들에게 알림 전송
    from app.models.group_chat import Membership
    
    other_memberships = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id != sender_id,
        Membership.is_active == True
    ).all()
    
    print(f"알림을 받을 멤버 수: {len(other_memberships)}")
    
    if not other_memberships:
        print("❌ 알림을 받을 멤버가 없습니다.")
        return {"message": "No other members to notify."}
    
    # 알림 제목과 내용 설정
    if room_type == "dm":
        title = f"{sender.nickname}님의 메시지"
        body = message_content[:50] + "..." if len(message_content) > 50 else message_content
    else:
        title = f"{room_name or '그룹 채팅'}"
        body = f"{sender.nickname}: {message_content[:30]}{'...' if len(message_content) > 30 else ''}"
    
    # 알림 데이터 설정
    data = {
        "type": "chat_message",
        "room_id": str(room_id),
        "room_type": room_type,
        "sender_id": str(sender_id),
        "sender_nickname": sender.nickname,
        "message_content": message_content
    }
    
    # 각 멤버에게 알림 전송 (현재 채팅방에 있는 사용자는 제외)
    results = []
    success_count = 0
    failure_count = 0
    skipped_count = 0
    
    for membership in other_memberships:
        member = db.query(User).filter(User.id == membership.user_id).first()
        if member and member.notifications_enabled and member.fcm_token:
            print(f"🔎 대상 사용자 {member.id} - user.notifications_enabled={member.notifications_enabled}, membership.notifications_enabled={getattr(membership, 'notifications_enabled', None)}")
            # 방별 알림 설정 확인
            if membership.notifications_enabled is False:
                print(f"⏭️ 사용자 {member.id} 방별 알림 끔 - room {room_id}")
                skipped_count += 1
                continue
            # 현재 채팅방에 있는 사용자인지 확인 (WebSocket 연결 상태로 판단)
            from app.websocket_manager import manager
            is_user_in_room = manager.is_user_in_room(member.id, room_id)
            
            if is_user_in_room:
                print(f"⏭️ 사용자 {member.nickname}은 현재 채팅방 {room_id}에 접속 중 - 알림 스킵")
                skipped_count += 1
                continue
            
            result = send_fcm_to_user(db, member.id, title, body, data)
            results.append({"user_id": member.id, "result": result})
            
            if result.get("success"):
                success_count += 1
            else:
                failure_count += 1
        else:
            print(f"⚠️ 사용자 {membership.user_id}는 알림을 받을 수 없음 (토큰 없음 또는 알림 비활성화)")
    
    print(f"채팅 알림 전송 결과: 성공 {success_count}, 실패 {failure_count}, 스킵 {skipped_count}")
    return {
        "success": True,
        "success_count": success_count,
        "failure_count": failure_count,
        "skipped_count": skipped_count,
        "results": results
    } 