from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import SessionLocal
from typing import List, Optional
from app.db.database import get_db
from app.models.chat import ChatRoom, ChatMessage
from app.models.user import User
from app.schemas.chat import ChatRoomCreate, ChatRoomResponse, ChatMessageCreate, ChatMessageResponse, PushTokenRegister
from app.websocket_manager import manager
from app.routers.user import get_current_user
import json
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["chat"])

# 채팅방 목록 조회
@router.get("/rooms", response_model=List[ChatRoomResponse])
def get_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 참여 중인 채팅방 목록을 조회합니다."""
    print(f"🔍 채팅방 목록 조회 - 사용자 ID: {current_user.id}")
    
    # 전체 채팅방 수 확인
    total_rooms = db.query(ChatRoom).filter(ChatRoom.is_active == True).count()
    print(f"📊 전체 활성 채팅방 수: {total_rooms}")
    
    user_rooms = db.query(ChatRoom).join(ChatRoom.members).filter(
        User.id == current_user.id,
        ChatRoom.is_active == True
    ).all()
    
    print(f"👤 사용자 {current_user.id}가 참여한 채팅방 수: {len(user_rooms)}")
    
    # 채팅방 정보와 마지막 메시지, 상대방 정보 포함하여 반환
    result = []
    for room in user_rooms:
        print(f"🏠 채팅방 {room.id}: {room.name} (타입: {room.type})")
        
        # 마지막 메시지 조회
        last_message = db.query(ChatMessage).filter(
            ChatMessage.room_id == room.id,
            ChatMessage.is_deleted == False
        ).order_by(ChatMessage.id.desc()).first()
        
        # 1:1 채팅인 경우 상대방 정보 조회
        other_user = None
        if room.type == "dm":
            other_members = [member for member in room.members if member.id != current_user.id]
            if other_members:
                other_user = other_members[0]
        
        room_dict = {
            "id": room.id,
            "name": room.name or (f"{other_user.nickname}님과의 채팅" if other_user else "채팅방"),
            "type": room.type,
            "created_by": room.created_by,
            "created_at": room.created_at,
            "is_active": room.is_active,
            "members": [member.id for member in room.members],
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
    
    # 기존 1:1 채팅방 조회
    existing_room = db.query(ChatRoom).join(ChatRoom.members).filter(
        ChatRoom.type == "dm",
        ChatRoom.is_active == True,
        User.id.in_([current_user.id, target_user_id])
    ).group_by(ChatRoom.id).having(
        func.count(User.id) == 2
    ).first()
    
    if existing_room:
        # 멤버 ID만 추출하여 반환
        room_dict = {
            "id": existing_room.id,
            "name": existing_room.name,
            "type": existing_room.type,
            "created_by": existing_room.created_by,
            "created_at": existing_room.created_at,
            "is_active": existing_room.is_active,
            "members": [member.id for member in existing_room.members]
        }
        return {"exists": True, "room": room_dict}
    else:
        return {"exists": False, "room": None}

# 채팅방 생성
@router.post("/rooms", response_model=ChatRoomResponse)
def create_chat_room(
    room_data: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 채팅방을 생성합니다."""
    # 1:1 채팅인 경우 기존 채팅방 확인
    if room_data.type == "dm" and len(room_data.members) == 1:
        other_user_id = room_data.members[0]
        existing_room = db.query(ChatRoom).join(ChatRoom.members).filter(
            ChatRoom.type == "dm",
            ChatRoom.is_active == True,
            User.id.in_([current_user.id, other_user_id])
        ).group_by(ChatRoom.id).having(
            func.count(User.id) == 2
        ).first()
        
        if existing_room:
            # 멤버 ID만 추출하여 반환
            room_dict = {
                "id": existing_room.id,
                "name": existing_room.name,
                "type": existing_room.type,
                "created_by": existing_room.created_by,
                "created_at": existing_room.created_at,
                "is_active": existing_room.is_active,
                "members": [member.id for member in existing_room.members]
            }
            return room_dict
    
    # 새 채팅방 생성
    new_room = ChatRoom(
        name=room_data.name,
        type=room_data.type,
        created_by=current_user.id
    )
    db.add(new_room)
    db.flush()  # ID 생성
    
    # 멤버 추가 (생성자 포함)
    members = [current_user.id] + room_data.members
    member_users = db.query(User).filter(User.id.in_(members)).all()
    new_room.members = member_users
    
    db.commit()
    db.refresh(new_room)
    
    # 멤버 ID만 추출하여 반환
    room_dict = {
        "id": new_room.id,
        "name": new_room.name,
        "type": new_room.type,
        "created_by": new_room.created_by,
        "created_at": new_room.created_at,
        "is_active": new_room.is_active,
        "members": [member.id for member in new_room.members]
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
    # 채팅방 멤버 확인
    room = db.query(ChatRoom).join(ChatRoom.members).filter(
        ChatRoom.id == room_id,
        ChatRoom.is_active == True,
        User.id == current_user.id
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 메시지 조회
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
    # 채팅방 멤버 확인
    room = db.query(ChatRoom).join(ChatRoom.members).filter(
        ChatRoom.id == room_id,
        ChatRoom.is_active == True,
        User.id == current_user.id
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 메시지 저장
    new_message = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        content=message_data.text,
        client_msg_id=message_data.client_msg_id
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # WebSocket으로 실시간 전송
    ws_message = {
        "type": "message",
        "room_id": room_id,
        "user_id": current_user.id,
        "content": message_data.text,
        "client_msg_id": message_data.client_msg_id,
        "sent_at": new_message.sent_at.isoformat()
    }
    
    # 온라인 사용자들에게 브로드캐스트
    await manager.broadcast_to_room(
        json.dumps(ws_message),
        room_id,
        exclude_user=current_user.id
    )
    
    # 오프라인 사용자들에게 알림 전송
    await manager.send_chat_notification(room_id, current_user.id, message_data.text, db)
    
    return new_message

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

# WebSocket 엔드포인트
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    # 쿼리 파라미터에서 토큰 가져오기
    token = websocket.query_params.get("token")
    """WebSocket 연결을 처리합니다."""
    # 토큰 검증 (실제 구현에서는 JWT 검증)
    if not token:
        await websocket.close(code=4001, reason="토큰이 필요합니다")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # 메시지 수신
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 메시지 타입에 따른 처리
            if message["type"] == "join":
                room_id = message["room_id"]
                db = SessionLocal()
                try:
                    # 새로운 Room 모델과 기존 ChatRoom 모델 모두 지원
                    from app.models.group_chat import Room, Membership
                    
                    # 새로운 Room 모델에서 먼저 확인
                    room = db.query(Room).filter(Room.id == room_id).first()
                    if room:
                        # 새로운 Room 모델 사용
                        membership = db.query(Membership).filter(
                            Membership.room_id == room_id,
                            Membership.user_id == user_id
                        ).first()
                        
                        if membership:
                            # WebSocket 매니저에 참여자 추가
                            if room_id not in manager.room_participants:
                                manager.room_participants[room_id] = set()
                            manager.room_participants[room_id].add(user_id)
                            
                            if user_id not in manager.user_rooms:
                                manager.user_rooms[user_id] = set()
                            manager.user_rooms[user_id].add(room_id)
                            
                            success, msg = True, "채팅방 참여 성공 (새로운 Room 모델)"
                        else:
                            success, msg = False, "채팅방 멤버가 아닙니다"
                    else:
                        # 기존 ChatRoom 모델 사용
                        success, msg = await manager.join_room(user_id, room_id, db)
                finally:
                    db.close()
                
                response = {
                    "type": "join_response",
                    "room_id": room_id,
                    "success": success,
                    "message": msg
                }
                await websocket.send_text(json.dumps(response))
                
            elif message["type"] == "leave":
                room_id = message["room_id"]
                await manager.leave_room(user_id, room_id)
                
                response = {
                    "type": "leave_response",
                    "room_id": room_id,
                    "success": True
                }
                await websocket.send_text(json.dumps(response))
                
            elif message["type"] == "typing":
                room_id = message["room_id"]
                is_typing = message.get("is_typing", False)
                
                typing_message = {
                    "type": "typing",
                    "room_id": room_id,
                    "user_id": user_id,
                    "is_typing": is_typing
                }
                
                await manager.broadcast_to_room(
                    json.dumps(typing_message),
                    room_id,
                    exclude_user=user_id
                )
                
            elif message["type"] == "read_receipt":
                room_id = message["room_id"]
                message_id = message["message_id"]
                
                # 읽음 처리 (실제 구현에서는 DB 업데이트)
                read_message = {
                    "type": "read_receipt",
                    "room_id": room_id,
                    "user_id": user_id,
                    "message_id": message_id
                }
                
                await manager.broadcast_to_room(
                    json.dumps(read_message),
                    room_id
                )
                
            elif message["type"] == "pong":
                # ping/pong 응답
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket 오류: {e}")
        manager.disconnect(user_id)
