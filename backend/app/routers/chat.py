from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import SessionLocal
from typing import List, Optional, Dict, Any
from app.db.database import get_db
from app.models.group_chat import Room, Membership, ChatMessage
from app.models.user import User
from app.schemas.chat import RoomCreate, RoomResponse, ChatMessageCreate, ChatMessageResponse, PushTokenRegister
from app.websocket_manager import manager
from app.routers.user import get_current_user
from app.utils.encryption import room_link_encryption
import json
import asyncio
from datetime import datetime
import secrets
import string

router = APIRouter(prefix="/chat", tags=["chat"])

# 채팅방 목록 조회
@router.get("/rooms", response_model=List[RoomResponse])
def get_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 참여 중인 채팅방 목록을 조회합니다."""
    print(f"🔍 채팅방 목록 조회 - 사용자 ID: {current_user.id}")
    
    # 사용자의 멤버십을 통해 참여 중인 채팅방 조회
    user_memberships = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).all()
    
    print(f"👤 사용자 {current_user.id}가 참여한 채팅방 수: {len(user_memberships)}")
    
    # 채팅방 정보와 마지막 메시지, 상대방 정보 포함하여 반환
    result = []
    for membership in user_memberships:
        room = membership.room
        print(f"🏠 채팅방 {room.id}: {room.name} (타입: {room.type})")
        
        # 마지막 메시지 조회
        last_message = db.query(ChatMessage).filter(
            ChatMessage.room_id == room.id,
            ChatMessage.is_deleted == False
        ).order_by(ChatMessage.id.desc()).first()
        
        # 1:1 채팅인 경우 상대방 정보 조회
        other_user = None
        if room.type == "dm":
            other_memberships = db.query(Membership).filter(
                Membership.room_id == room.id,
                Membership.user_id != current_user.id,
                Membership.is_active == True
            ).all()
            if other_memberships:
                other_user = other_memberships[0].user
        
        room_dict = {
            "id": room.id,
            "name": room.name or (f"{other_user.nickname}님과의 채팅" if other_user else "채팅방"),
            "type": room.type,
            "created_by": room.created_at,  # 임시로 created_at 사용
            "created_at": room.created_at,
            "is_active": room.status == "active",
            "members": [m.user_id for m in db.query(Membership).filter(
                Membership.room_id == room.id,
                Membership.is_active == True
            ).all()],
            "last_message": {
                "content": last_message.content if last_message else None,
                "sent_at": last_message.sent_at if last_message else None,
                "sender_id": last_message.sender_id if last_message else None
            } if last_message else None,
            "other_user": {
                "id": other_user.id,
                "nickname": other_user.nickname,
                "profile_image_url": other_user.profile_image_url
            } if other_user else None
        }
        result.append(room_dict)
    
    print(f"✅ 반환할 채팅방 목록: {len(result)}개")
    return result

# 그룹 채팅방 공유 링크 생성
@router.post("/rooms/{room_id}/share-link")
def create_share_link(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 채팅방의 공유 링크를 생성합니다."""
    print(f"🔍 공유 링크 생성 요청 - Room ID: {room_id}, User ID: {current_user.id}")
    
    # 채팅방 존재 확인 (새로운 Room 모델 사용)
    room = db.query(Room).filter(Room.id == room_id, Room.status == "active").first()
    if not room:
        print(f"❌ 채팅방을 찾을 수 없습니다 - Room ID: {room_id}")
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    print(f"✅ 채팅방 찾음 - ID: {room.id}, 이름: {room.name}, 타입: {room.type}")
    
    # 그룹 채팅방인지 확인
    if room.type != "group":
        print(f"❌ 그룹 채팅방이 아닙니다 - Room ID: {room_id}, 타입: {room.type}")
        raise HTTPException(status_code=400, detail="그룹 채팅방만 공유할 수 있습니다")
    
    # 사용자가 해당 채팅방의 멤버인지 확인 (새로운 Membership 모델 사용)
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="해당 채팅방의 멤버가 아닙니다")
    
    # 채팅방 ID를 암호화하여 공유 코드 생성
    share_code = room_link_encryption.encrypt_room_id(room_id)
    
    # 공유 링크 생성
    share_link = f"https://hoseolife.kro.kr/chat/rooms/share/{share_code}"
    
    return {
        "share_link": share_link,
        "share_code": share_code,
        "room_id": room_id,
        "room_name": room.name
    }

# 공유 링크로 채팅방 참여
@router.get("/rooms/join/{share_code}")
def join_room_by_share_link(
    share_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공유 링크를 통해 채팅방에 참여합니다."""
    # 암호화된 share_code를 복호화하여 room_id 추출
    try:
        room_id = room_link_encryption.decrypt_room_id(share_code)
        room = db.query(Room).filter(Room.id == room_id, Room.status == "active").first()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 그룹 채팅방인지 확인
    if room.type != "group":
        raise HTTPException(status_code=400, detail="그룹 채팅방만 참여할 수 있습니다")
    
    # 이미 멤버인지 확인 (새로운 Membership 모델 사용)
    existing_membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    
    if existing_membership:
        return {"message": "이미 참여 중인 채팅방입니다", "room_id": room.id}
    
    # 채팅방에 참여 (새로운 Membership 모델 사용)
    new_membership = Membership(
        room_id=room_id,
        user_id=current_user.id,
        role="member",
        is_active=True,
        notifications_enabled=True
    )
    db.add(new_membership)
    db.commit()
    
    return {"message": "채팅방 참여가 완료되었습니다", "room_id": room.id}

# 1:1 채팅방 조회
@router.get("/rooms/dm")
def get_dm_room(
    target_user_id: int = Query(..., description="상대방 사용자 ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """1:1 채팅방이 존재하는지 확인하고 반환합니다."""
    # 상대방 사용자 존재 확인
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    
    # 기존 1:1 채팅방 조회 (새로운 Room 모델 사용)
    existing_room = db.query(Room).join(Membership, Room.id == Membership.room_id).filter(
        Room.type == "dm",
        Room.status == "active",
        Membership.user_id.in_([current_user.id, target_user_id]),
        Membership.is_active == True
    ).group_by(Room.id).having(
        func.count(Membership.user_id) == 2
    ).first()
    
    if existing_room:
        # 멤버 ID만 추출하여 반환
        members = db.query(Membership.user_id).filter(
            Membership.room_id == existing_room.id,
            Membership.is_active == True
        ).all()
        
        room_dict = {
            "id": existing_room.id,
            "name": existing_room.name,
            "type": existing_room.type,
            "created_by": existing_room.created_at,  # 임시로 created_at 사용
            "created_at": existing_room.created_at,
            "is_active": existing_room.status == "active",
            "members": [m.user_id for m in members]
        }
        return {"exists": True, "room": room_dict}
    else:
        return {"exists": False, "room": None}

# 채팅방 생성
@router.post("/rooms", response_model=RoomResponse)
def create_chat_room(
    room_data: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 채팅방을 생성합니다."""
    # 1:1 채팅인 경우 기존 채팅방 확인
    if room_data.type == "dm" and len(room_data.members) == 1:
        other_user_id = room_data.members[0]
        existing_room = db.query(Room).join(Membership, Room.id == Membership.room_id).filter(
            Room.type == "dm",
            Room.status == "active",
            Membership.user_id.in_([current_user.id, other_user_id]),
            Membership.is_active == True
        ).group_by(Room.id).having(
            func.count(Membership.user_id) == 2
        ).first()
        
        if existing_room:
            # 멤버 ID만 추출하여 반환
            members = db.query(Membership.user_id).filter(
                Membership.room_id == existing_room.id,
                Membership.is_active == True
            ).all()
            
            room_dict = {
                "id": existing_room.id,
                "name": existing_room.name,
                "type": existing_room.type,
                "created_by": existing_room.created_at,  # 임시로 created_at 사용
                "created_at": existing_room.created_at,
                "is_active": existing_room.status == "active",
                "members": [m.user_id for m in members]
            }
            return room_dict
    
    # 새 채팅방 생성
    new_room = Room(
        name=room_data.name,
        type=room_data.type,
        status="active"
    )
    db.add(new_room)
    db.flush()  # ID 생성
    
    # 멤버십 생성 (생성자 포함)
    members = [current_user.id] + room_data.members
    for user_id in members:
        membership = Membership(
            room_id=new_room.id,
            user_id=user_id,
            role="admin" if user_id == current_user.id else "member"
        )
        db.add(membership)
    
    db.commit()
    db.refresh(new_room)
    
    # 멤버 ID만 추출하여 반환
    room_dict = {
        "id": new_room.id,
        "name": new_room.name,
        "type": new_room.type,
        "created_by": new_room.created_at,  # 임시로 created_at 사용
        "created_at": new_room.created_at,
        "is_active": new_room.status == "active",
        "members": members
    }
    return room_dict

# 채팅방 메시지 조회
@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def get_chat_messages(
    room_id: int,
    cursor: Optional[int] = Query(None, description="마지막 메시지 ID"),
    limit: int = Query(50, le=100, description="조회할 메시지 수"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방의 메시지를 조회합니다."""
    # 채팅방 멤버 확인 (새로운 Room 모델 사용)
    room = db.query(Room).join(Membership, Room.id == Membership.room_id).filter(
        Room.id == room_id,
        Room.status == "active",
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 메시지 조회 (발신자 정보 포함)
    try:
        from sqlalchemy import text
        
        # 🔧 직접 SQL 사용하여 발신자 정보와 함께 조회
        sql = """
            SELECT 
                m.id, m.room_id, m.content, m.client_msg_id, m.sender_id, m.sent_at, m.is_deleted,
                u.nickname as sender_nickname, u.profile_image_url as sender_profile_image_url
            FROM chat_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = :room_id AND m.is_deleted = FALSE
        """
        
        if cursor:
            sql += " AND m.id < :cursor"
            params = {'room_id': room_id, 'cursor': cursor}
        else:
            params = {'room_id': room_id}
        
        sql += " ORDER BY m.id DESC LIMIT :limit"
        params['limit'] = limit
        
        result = db.execute(text(sql), params)
        messages = result.fetchall()
        
        # 시간순으로 정렬 (역순)
        messages = list(reversed(messages))
        
        # 응답 형식으로 변환
        response_messages = []
        for msg in messages:
            response_messages.append({
                "id": msg[0],
                "room_id": msg[1],
                "content": msg[2],
                "client_msg_id": msg[3],
                "sender_id": msg[4],
                "sent_at": msg[5],
                "is_deleted": msg[6],
                "sender_nickname": msg[7],
                "sender_profile_image_url": msg[8]
            })
        
        return response_messages
        
    except Exception as e:
        print(f"❌ 메시지 조회 실패: {e}")
        # 실패 시 기존 방식으로 fallback
        query = db.query(ChatMessage).filter(
            ChatMessage.room_id == room_id,
            ChatMessage.is_deleted == False
        )
        
        if cursor:
            query = query.filter(ChatMessage.id < cursor)
        
        messages = query.order_by(ChatMessage.id.desc()).limit(limit).all()
        messages.reverse()  # 시간순 정렬
        
        return messages

# 메시지 전송
@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse)
async def send_message(
    room_id: int,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방에 메시지를 전송합니다."""
    # 채팅방 멤버 확인 (새로운 Room 모델 사용)
    room = db.query(Room).join(Membership, Room.id == Membership.room_id).filter(
        Room.id == room_id,
        Room.status == "active",
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 메시지 저장 (한국 시간으로 저장)
    from datetime import datetime, timezone, timedelta
    
    # 현재 한국 시간
    korea_tz = timezone(timedelta(hours=9))
    current_korea_time = datetime.now(korea_tz)
    
    new_message = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        content=message_data.text,
        client_msg_id=message_data.client_msg_id,
        sent_at=current_korea_time
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # WebSocket으로 실시간 전송 (발신자 정보 포함)
    ws_message = {
        "type": "message",
        "room_id": room_id,
        "user_id": current_user.id,
        "sender_id": current_user.id,  # 🆕 발신자 ID
        "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
        "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
        "content": message_data.text,
        "client_msg_id": message_data.client_msg_id,
        "sent_at": new_message.sent_at.isoformat()
    }
    
    # 온라인 사용자들에게 브로드캐스트 (발신자 포함)
    await manager.broadcast_to_room(
        room_id,
        ws_message,
        exclude_user=None
    )
    
    # 오프라인 사용자들에게 알림 전송
    await manager.send_chat_notification(room_id, current_user.id, message_data.text, db)
    
    # 🔧 응답에 발신자 정보 포함
    response_message = {
        "id": new_message.id,
        "room_id": new_message.room_id,
        "content": new_message.content,
        "client_msg_id": new_message.client_msg_id,
        "sender_id": new_message.sender_id,
        "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
        "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
        "sent_at": new_message.sent_at,
        "is_deleted": new_message.is_deleted
    }
    
    return response_message

# 푸시 토큰 등록
@router.post("/push/register")
def register_push_token(
    token_data: PushTokenRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 Expo Push 토큰을 등록합니다."""
    current_user.fcm_token = token_data.expo_push_token
    db.commit()
    
    return {"message": "푸시 토큰이 등록되었습니다"}

# WebSocket 테스트 엔드포인트
@router.get("/ws-test/{user_id}")
async def websocket_test(user_id: int):
    """WebSocket 엔드포인트 테스트용"""
    return {"message": f"WebSocket 엔드포인트 테스트 - 사용자 ID: {user_id}", "path": "/chat/ws/"}

# WebSocket 엔드포인트 (요구사항 스펙 준수)
@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str = Query(...)):
    """WebSocket 연결을 처리합니다."""
    print(f"🔌 WebSocket 연결 시도 - 방 ID: {room_id}")
    
    # 쿼리 파라미터에서 토큰 가져오기
    token = websocket.query_params.get("token")
    print(f"🔑 토큰 확인: {token[:20] if token else 'None'}...")
    
    # 토큰 검증
    if not token:
        print("❌ 토큰이 없습니다")
        await websocket.close(code=4001, reason="토큰이 필요합니다")
        return
    
    # JWT 토큰 검증
    try:
        from app.routers.user import decode_token
        payload = decode_token(token)
        if not payload or not payload.get("sub"):
            print("❌ 토큰 검증 실패")
            await websocket.close(code=4001, reason="유효하지 않은 토큰")
            return
        
        user_id = int(payload.get("sub"))
        print(f"✅ 토큰 검증 성공 - 사용자 ID: {user_id}")
    except Exception as e:
        print(f"❌ 토큰 검증 오류: {e}")
        await websocket.close(code=4001, reason="토큰 검증 실패")
        return
    
    # WebSocket 연결 수락
    await websocket.accept()
    print(f"✅ WebSocket 연결 수락 - 사용자 ID: {user_id}")
    
    try:
        # 매니저에 연결 등록
        await manager.connect(websocket, user_id, room_id)
        print(f"📝 매니저에 연결 등록 완료 - 사용자 ID: {user_id}, 방 ID: {room_id}")
        
        # 연결 확인
        print(f"✅ WebSocket 연결 성공 - 사용자 ID: {user_id}")
        print(f"🔌 연결 상태: {websocket.client_state}")
        
        # 연결 확인 메시지 전송
        await websocket.send_text(json.dumps({
            "type": "connected",
            "user_id": user_id,
            "room_id": room_id,
            "message": "WebSocket 연결이 성공적으로 설정되었습니다"
        }))
        
        # WebSocket 메시지 처리 루프
        try:
            while True:
                # 클라이언트로부터 메시지 수신 대기
                data = await websocket.receive_text()
                print(f"📨 WebSocket 메시지 수신: {data}")
                
                try:
                    message_data = json.loads(data)
                    print(f"📨 파싱된 메시지: {message_data}")
                except json.JSONDecodeError as e:
                    print(f"❌ JSON 파싱 오류: {e}")
                    continue
                
                # 메시지 타입에 따른 처리
                try:
                    if message_data.get("type") == "join":
                        room_id = message_data.get("room_id")
                        print(f"🚪 사용자 {user_id}가 채팅방 {room_id}에 참여 요청")
                        
                        # 실제 채팅방 참여 처리
                        try:
                            from app.db.database import get_db
                            db = next(get_db())
                            success, message = await manager.join_room(user_id, room_id, db)
                            db.close()
                            
                            if success:
                                print(f"✅ 사용자 {user_id}가 채팅방 {room_id}에 참여 성공")
                            else:
                                print(f"❌ 사용자 {user_id}가 채팅방 {room_id}에 참여 실패: {message}")
                        except Exception as e:
                            print(f"❌ 채팅방 참여 처리 오류: {e}")
                            success = False
                            message = "채팅방 참여 처리 중 오류 발생"
                        
                        # 채팅방 참여 응답 전송
                        await websocket.send_text(json.dumps({
                            "type": "join_response",
                            "room_id": room_id,
                            "user_id": user_id,
                            "success": success,
                            "message": message
                        }))
                    
                    elif message_data.get("type") == "leave":
                        room_id = message_data.get("room_id")
                        print(f"🚪 사용자 {user_id}가 채팅방 {room_id}에서 나가기 요청")
                        
                        # 실제 채팅방 나가기 처리
                        try:
                            # room_participants에서 사용자 제거
                            if room_id in manager.room_participants:
                                manager.room_participants[room_id].discard(user_id)
                                if not manager.room_participants[room_id]:
                                    del manager.room_participants[room_id]
                            
                            # user_rooms에서 채팅방 제거
                            if user_id in manager.user_rooms:
                                manager.user_rooms[user_id].discard(room_id)
                            
                            print(f"✅ 사용자 {user_id}가 채팅방 {room_id}에서 나가기 성공")
                            success = True
                            message = f"채팅방 {room_id}에서 나갔습니다"
                        except Exception as e:
                            print(f"❌ 채팅방 나가기 처리 오류: {e}")
                            success = False
                            message = "채팅방 나가기 처리 중 오류 발생"
                        
                        # 채팅방 나가기 응답 전송
                        await websocket.send_text(json.dumps({
                            "type": "leave_response",
                            "room_id": room_id,
                            "user_id": user_id,
                            "success": success,
                            "message": message
                        }))
                    
                    elif message_data.get("type") == "message":
                        room_id = message_data.get("room_id")
                        content = message_data.get("content", "")
                        image_urls = message_data.get("image_urls", [])
                        print(f"💬 사용자 {user_id}가 채팅방 {room_id}에 메시지 전송: {content}, 이미지: {len(image_urls)}장")
                        
                        # 메시지 저장 (데이터베이스)
                        try:
                            from app.db.database import get_db
                            from app.models.group_chat import ChatMessage
                            from sqlalchemy.orm import Session
                            import json as json_lib
                            
                            db = next(get_db())
                            new_message = ChatMessage(
                                room_id=room_id,
                                sender_id=user_id,
                                content=content,
                                image_urls=json_lib.dumps(image_urls) if image_urls else None
                            )
                            db.add(new_message)
                            db.commit()
                            db.refresh(new_message)
                            
                            # 저장된 메시지 ID로 응답 전송
                            await websocket.send_text(json.dumps({
                                "type": "message_sent",
                                "message_id": new_message.id,
                                "room_id": room_id,
                                "user_id": user_id,
                                "content": content,
                                "image_urls": image_urls,
                                "sent_at": new_message.sent_at.isoformat(),
                                "success": True
                            }))
                            
                            # 같은 채팅방의 모든 사용자들에게 메시지 브로드캐스트 (발신자 포함)
                            await manager.broadcast_to_room(room_id, {
                                "type": "message",
                                "message_id": new_message.id,
                                "room_id": room_id,
                                "sender_id": user_id,
                                "content": content,
                                "image_urls": image_urls,
                                "sent_at": new_message.sent_at.isoformat()
                            }, exclude_user=None)
                            
                            db.close()
                            
                        except Exception as e:
                            print(f"❌ 메시지 저장 오류: {e}")
                            await websocket.send_text(json.dumps({
                                "type": "message_error",
                                "room_id": room_id,
                                "error": "메시지 저장에 실패했습니다"
                            }))
                            
                    elif message_data.get("type") == "typing":
                        room_id = message_data.get("room_id")
                        is_typing = message_data.get("is_typing", False)
                        print(f"⌨️ 사용자 {user_id}가 채팅방 {room_id}에서 타이핑: {is_typing}")
                        
                        # 타이핑 상태를 같은 채팅방의 다른 사용자들에게 브로드캐스트
                        await manager.broadcast_to_room(room_id, {
                            "type": "typing",
                            "room_id": room_id,
                            "user_id": user_id,
                            "is_typing": is_typing
                        }, exclude_user=user_id)
                        
                    elif message_data.get("type") == "ping":
                        # Ping 응답
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "timestamp": message_data.get("timestamp")
                        }))
                        
                    else:
                        print(f"❓ 알 수 없는 메시지 타입: {message_data.get('type')}")
                        
                except Exception as e:
                    print(f"❌ 메시지 처리 오류: {e}")
                    import traceback
                    traceback.print_exc()
                    
        except WebSocketDisconnect:
            print(f"❌ WebSocket 연결 끊김 - 사용자 ID: {user_id}")
            await manager.disconnect(user_id)
                
    except WebSocketDisconnect:
        print(f"❌ WebSocket 연결 끊김 - 사용자 ID: {user_id}")
        await manager.disconnect(user_id)
    except Exception as e:
        print(f"❌ WebSocket 오류: {e}")
        await manager.disconnect(user_id)

# 채팅방 정보 조회 API (웹 폴백용)
@router.get("/rooms/share/{share_code}/info")
async def get_room_info_for_share(share_code: str, db: Session = Depends(get_db)):
    """공유 링크의 채팅방 정보를 조회합니다 (웹 폴백용)"""
    try:
        # 암호화된 share_code를 복호화하여 room_id 추출
        room_id = room_link_encryption.decrypt_room_id(share_code)
        room = db.query(Room).filter(Room.id == room_id, Room.status == "active").first()
        
        if not room:
            raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
        
        if room.type != "group":
            raise HTTPException(status_code=400, detail="그룹 채팅방만 공유할 수 있습니다")
        
        # 참여자 수 계산
        member_count = db.query(Membership).filter(
            Membership.room_id == room_id,
            Membership.is_active == True
        ).count()
        
        return {
            "room_id": room.id,
            "name": room.name,
            "description": room.description,
            "member_count": member_count,
            "type": room.type
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="채팅방 정보 조회에 실패했습니다")

@router.get("/rooms/share/{share_code}", response_class=HTMLResponse)
async def web_fallback_for_share_link(share_code: str, db: Session = Depends(get_db)):
    """앱이 설치되지 않은 사용자를 위한 웹 폴백 페이지"""
    
    # 채팅방 정보 가져오기
    room_info = None
    try:
        room_id = room_link_encryption.decrypt_room_id(share_code)
        room = db.query(Room).filter(Room.id == room_id, Room.status == "active").first()
        
        if room and room.type == "group":
            # 참여자 수 계산
            member_count = db.query(Membership).filter(
                Membership.room_id == room_id,
                Membership.is_active == True
            ).count()
            
            room_info = {
                "name": room.name,
                "description": room.description,
                "member_count": member_count
            }
    except Exception as e:
        print(f"채팅방 정보 조회 실패: {e}")
        room_info = None
    
    # HTML 페이지 생성
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>호서라이프 - 채팅방 초대</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }}
            .container {{
                background: white;
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                max-width: 400px;
                width: 100%;
            }}
            .logo {{
                font-size: 32px;
                font-weight: bold;
                color: #333;
                margin-bottom: 20px;
            }}
            .title {{
                font-size: 24px;
                font-weight: 600;
                color: #333;
                margin-bottom: 15px;
            }}
            .description {{
                color: #666;
                line-height: 1.6;
                margin-bottom: 20px;
            }}
            .room-info {{
                background: #f8f9fa;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 24px;
                border: 1px solid #e9ecef;
            }}
            .room-name {{
                font-size: 18px;
                font-weight: bold;
                color: #333;
                margin-bottom: 8px;
            }}
            .room-description {{
                font-size: 14px;
                color: #666;
                margin-bottom: 12px;
                line-height: 1.4;
            }}
            .member-count {{
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-size: 14px;
                color: #666;
            }}
            .member-icon {{
                font-size: 16px;
            }}
            .button {{
                background: #007AFF;
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin: 10px;
                text-decoration: none;
                display: inline-block;
                transition: background 0.3s;
            }}
            .button:hover {{
                background: #0056CC;
            }}
            .secondary-button {{
                background: #f8f9fa;
                color: #333;
                border: 1px solid #ddd;
            }}
            .secondary-button:hover {{
                background: #e9ecef;
            }}
            .countdown {{
                margin-top: 20px;
                color: #999;
                font-size: 14px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🏫</div>
            <h1 class="title">호서라이프</h1>
            <p class="description">
                그룹 채팅방에 초대되었습니다!<br>
                앱을 설치하고 참여해보세요.
            </p>
            
            {f'''
            <div class="room-info">
                <div class="room-name">이름: {room_info["name"]}</div>
                {f'<div class="room-description">설명: {room_info["description"]}</div>' if room_info["description"] else ''}
                <div class="member-count">
                    <span class="member-icon">👥</span>
                    <span>{room_info["member_count"]}명 참여 중</span>
                </div>
            </div>
            ''' if room_info else ''}
            
            <button class="button" id="openApp">
                앱에서 열기
            </button>
            
            <a href="https://naver.com" class="button secondary-button">
                앱 설치하기
            </a>
            
            <div class="countdown" id="countdown">
                5초 후 네이버로 이동합니다...
            </div>
        </div>

        <script>
            let countdown = 5;
            const countdownElement = document.getElementById('countdown');
            const openAppButton = document.getElementById('openApp');
            
            // 앱 설치 여부 확인
            function checkAppInstalled() {{
                const userAgent = navigator.userAgent;
                return userAgent.includes('KAKAOTALK') || userAgent.includes('Line') || 
                       userAgent.includes('Instagram') || userAgent.includes('Facebook');
            }}
            
            // Deep Link 시도
            function tryOpenApp() {{
                // 커스텀 스키마로 앱 열기 시도
                const customScheme = `camsaw://chat/rooms/{share_code}`;
                const universalLink = `https://hoseolife.kro.kr/chat/rooms/share/{share_code}`;
                
                // 먼저 커스텀 스키마 시도
                window.location.href = customScheme;
                
                // 2초 후 앱이 열리지 않으면 유니버설 링크 시도
                setTimeout(() => {{
                    window.location.href = universalLink;
                }}, 2000);
                
                // 4초 후에도 앱이 열리지 않으면 네이버로 이동
                setTimeout(() => {{
                    window.location.href = 'https://naver.com';
                }}, 4000);
            }}
            
            // 카운트다운
            const timer = setInterval(() => {{
                countdown--;
                countdownElement.textContent = `${{countdown}}초 후 네이버로 이동합니다...`;
                
                if (countdown <= 0) {{
                    clearInterval(timer);
                    window.location.href = 'https://naver.com';
                }}
            }}, 1000);
            
            // 앱에서 열기 버튼 클릭
            openAppButton.addEventListener('click', (e) => {{
                e.preventDefault();
                tryOpenApp();
            }});
            
            // 페이지 로드 시 자동으로 앱 열기 시도
            window.addEventListener('load', () => {{
                // 카카오톡 인앱 브라우저가 아닌 경우에만 자동 시도
                if (!navigator.userAgent.includes('KAKAOTALK')) {{
                    tryOpenApp();
                }}
            }});
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)
