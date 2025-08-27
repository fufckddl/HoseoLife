# 그룹 채팅 관련 API 엔드포인트
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from app.db.database import get_db
from app.models.user import User
from app.models.group_chat import GroupCreationRequest, Room, Membership, GroupStatus, RoomStatus, UserRole
from app.models.chat import ChatMessage, ChatRoom
from app.schemas.group_chat import (
    GroupRequestCreate, GroupRequestOut, GroupApproveOut, 
    AvailableGroupOut, MyRoomsOut, JoinResponse, RoomSummary
)
from app.routers.user import get_current_user
from app.services.fcm_service import send_fcm_to_user
from app.services.s3_service import s3_service
from fastapi import Request
import json

router = APIRouter(prefix="/chat", tags=["group_chat"])

# 그룹 생성 요청
@router.post("/groups/requests", response_model=GroupRequestOut)
def create_group_request(
    request: GroupRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 생성 요청을 생성합니다."""
    group_request = GroupCreationRequest(
        requester_id=current_user.id,
        name=request.name,
        description=request.description,
        status=GroupStatus.PENDING
    )
    
    db.add(group_request)
    db.commit()
    db.refresh(group_request)
    
    return GroupRequestOut(
        id=group_request.id,
        name=group_request.name,
        description=group_request.description,
        requesterId=group_request.requester_id,
        status=group_request.status.value,
        createdAt=group_request.created_at
    )

# 관리자: 대기 중인 그룹 요청 목록
@router.get("/admin/groups/pending", response_model=List[GroupRequestOut])
def get_pending_group_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """대기 중인 그룹 생성 요청 목록을 조회합니다."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    
    pending_requests = db.query(GroupCreationRequest).filter(
        GroupCreationRequest.status == GroupStatus.PENDING
    ).order_by(GroupCreationRequest.created_at.desc()).all()
    
    return [
        GroupRequestOut(
            id=req.id,
            name=req.name,
            description=req.description,
            requesterId=req.requester_id,
            status=req.status.value,
            createdAt=req.created_at
        )
        for req in pending_requests
    ]

# 관리자: 그룹 요청 승인
@router.post("/admin/groups/{request_id}/approve", response_model=GroupApproveOut)
def approve_group_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 생성 요청을 승인합니다."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    
    group_request = db.query(GroupCreationRequest).filter(
        GroupCreationRequest.id == request_id,
        GroupCreationRequest.status == GroupStatus.PENDING
    ).first()
    
    if not group_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대기 중인 그룹 요청을 찾을 수 없습니다"
        )
    
    # 그룹 요청 상태 업데이트
    group_request.status = GroupStatus.APPROVED
    group_request.decided_at = datetime.utcnow()
    
    # 새로운 그룹 채팅방 생성
    new_room = Room(
        type="group",
        name=group_request.name,
        description=group_request.description,
        status=RoomStatus.ACTIVE
    )
    db.add(new_room)
    db.flush()  # ID 생성을 위해 flush
    
    # 요청자에게 관리자 권한 부여
    membership = Membership(
        room_id=new_room.id,
        user_id=group_request.requester_id,
        role=UserRole.ADMIN
    )
    db.add(membership)
    
    db.commit()
    
    # 푸시 알림 전송
    requester = db.query(User).filter(User.id == group_request.requester_id).first()
    if requester and requester.fcm_token:
        notification_data = {
            "title": "그룹 승인",
            "body": f"'{group_request.name}' 그룹이 승인되었습니다",
            "data": {
                "kind": "groupApproved",
                "roomId": new_room.id
            }
        }
        send_fcm_to_user(db, group_request.requester_id, notification_data["title"], notification_data["body"], notification_data["data"])
    
    return GroupApproveOut(room_id=new_room.id, status="approved")

# 관리자: 그룹 요청 거절
@router.post("/admin/groups/{request_id}/reject")
def reject_group_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 생성 요청을 거절합니다."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    
    group_request = db.query(GroupCreationRequest).filter(
        GroupCreationRequest.id == request_id,
        GroupCreationRequest.status == GroupStatus.PENDING
    ).first()
    
    if not group_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="대기 중인 그룹 요청을 찾을 수 없습니다"
        )
    
    group_request.status = GroupStatus.REJECTED
    group_request.decided_at = datetime.utcnow()
    db.commit()
    
    return {"message": "그룹 요청이 거절되었습니다"}

# 참여 가능한 그룹 목록
@router.get("/rooms/available", response_model=List[AvailableGroupOut])
def get_available_groups(
    type: str = "group",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """참여 가능한 그룹 목록을 조회합니다."""
    print(f"🔍 참여 가능한 그룹 조회 - 사용자 ID: {current_user.id}")
    
    # 사용자가 이미 참여 중인 그룹 ID 목록
    my_memberships = db.query(Membership.room_id).filter(
        Membership.user_id == current_user.id
    ).all()
    my_group_ids = [m.room_id for m in my_memberships]
    print(f"📊 사용자가 참여 중인 그룹 ID: {my_group_ids}")
    
    # 참여 가능한 그룹 조회
    available_rooms = db.query(Room).filter(
        Room.type == type,
        Room.status == RoomStatus.ACTIVE
    ).all()
    
    print(f"🏠 전체 활성 그룹 수: {len(available_rooms)}")
    
    result = []
    for room in available_rooms:
        # 이미 참여 중인지 확인
        if room.id in my_group_ids:
            print(f"⏭️ 그룹 {room.id} ({room.name}) - 이미 참여 중")
            continue
            
        # 멤버 수 계산
        member_count = db.query(Membership).filter(
            Membership.room_id == room.id,
            Membership.is_active == True
        ).count()
        
        group_info = AvailableGroupOut(
            room_id=room.id,
            name=room.name,
            description=room.description,
            member_count=member_count
        )
        result.append(group_info)
        print(f"✅ 그룹 {room.id} ({room.name}) - 멤버 {member_count}명")
    
    print(f"🎯 반환할 그룹 수: {len(result)}")
    return result

# 1:1 채팅방 찾기 또는 생성 (새로운 Room 모델)
@router.get("/rooms/dm/new")
def find_or_create_direct_chat(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """1:1 채팅방을 찾거나 새로 생성합니다 (새로운 Room 모델 사용)."""
    print(f"🔍 1:1 채팅방 찾기/생성 - 사용자 {current_user.id} -> {target_user_id}")
    
    if current_user.id == target_user_id:
        raise HTTPException(status_code=400, detail="자신과는 채팅할 수 없습니다")
    
    # 상대방 사용자 존재 확인
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="상대방 사용자를 찾을 수 없습니다")
    
    # 기존 1:1 채팅방이 있는지 확인
    # 두 사용자가 모두 참여한 DM 타입의 방을 찾기
    existing_room = db.query(Room).join(Membership, Room.id == Membership.room_id).filter(
        Room.type == "dm",
        Room.status == RoomStatus.ACTIVE,
        Membership.user_id.in_([current_user.id, target_user_id])
    ).group_by(Room.id).having(
        func.count(Membership.user_id) == 2
    ).first()
    
    if existing_room:
        print(f"✅ 기존 1:1 채팅방 발견: {existing_room.id}")
        return {
            "exists": True,
            "room": {
                "id": existing_room.id,
                "name": existing_room.name,
                "type": existing_room.type
            }
        }
    
    # 새 1:1 채팅방 생성
    print(f"🆕 새 1:1 채팅방 생성")
    new_room = Room(
        name=f"DM_{current_user.id}_{target_user_id}",
        type="dm",
        status=RoomStatus.ACTIVE
    )
    db.add(new_room)
    db.flush()  # ID 생성을 위해 flush
    
    # 두 사용자를 멤버로 추가
    membership1 = Membership(
        room_id=new_room.id,
        user_id=current_user.id,
        role=UserRole.MEMBER
    )
    membership2 = Membership(
        room_id=new_room.id,
        user_id=target_user_id,
        role=UserRole.MEMBER
    )
    
    db.add(membership1)
    db.add(membership2)
    db.commit()
    db.refresh(new_room)
    
    print(f"✅ 새 1:1 채팅방 생성 완료: {new_room.id}")
    return {
        "exists": False,
        "room": {
            "id": new_room.id,
            "name": new_room.name,
            "type": new_room.type
        }
    }

# 그룹 참여
@router.post("/rooms/{room_id}/join", response_model=JoinResponse)
def join_group(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹에 참여합니다."""
    # 그룹 존재 확인
    room = db.query(Room).filter(
        Room.id == room_id,
        Room.type == "group",
        Room.status == RoomStatus.ACTIVE
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")
    
    # 이미 참여 중인지 확인
    existing_membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    
    if existing_membership:
        return JoinResponse(joined=True)  # idempotent 처리
    
    # 새 멤버십 생성
    membership = Membership(
        room_id=room_id,
        user_id=current_user.id,
        role=UserRole.MEMBER
    )
    db.add(membership)
    db.commit()
    
    return JoinResponse(joined=True)

# 방별 알림 설정 토글
@router.post("/rooms/{room_id}/notifications/toggle")
def toggle_room_notifications(
    room_id: int,
    enabled: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"🔔 방 알림 토글 - room_id={room_id}, user_id={current_user.id}, enabled={enabled}")
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="채팅방에 참여하고 있지 않습니다")
    membership.notifications_enabled = bool(enabled)
    db.commit()
    return {"room_id": room_id, "notifications_enabled": membership.notifications_enabled}

# 방별 알림 설정 조회
@router.get("/rooms/{room_id}/notifications")
def get_room_notifications(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"🔔 방 알림 조회 - room_id={room_id}, user_id={current_user.id}")
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="채팅방에 참여하고 있지 않습니다")
    return {"room_id": room_id, "notifications_enabled": membership.notifications_enabled}

# 내 채팅방 목록 조회 (DM/그룹 분리) - 새로운 Room 모델
@router.get("/my-rooms", response_model=MyRoomsOut)
def get_my_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내 채팅방 목록을 DM과 그룹으로 분리하여 조회합니다."""
    print(f"🔍 내 채팅방 목록 조회 - 사용자 ID: {current_user.id}")
    
    dms = []
    groups = []
    
    # 1. 새로운 Room 모델에서 그룹 채팅방 조회
    my_memberships = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).all()
    
    print(f"📊 내 멤버십 수: {len(my_memberships)}")
    
    for membership in my_memberships:
        room = membership.room
        print(f"🏠 채팅방 {room.id}: {room.name} (타입: {room.type})")
        
        # 마지막 메시지 조회 (새로운 Room 모델)
        last_message = db.query(ChatMessage).filter(
            ChatMessage.room_id == room.id,
            ChatMessage.is_deleted == False
        ).order_by(ChatMessage.id.desc()).first()
        
        # 1:1 채팅방인 경우 상대방 닉네임을 이름으로 사용
        display_name = room.name or "채팅방"
        if room.type == "dm":
            # DM 채팅방의 경우 상대방 사용자 찾기
            other_membership = db.query(Membership).filter(
                Membership.room_id == room.id,
                Membership.user_id != current_user.id
            ).first()
            
            if other_membership:
                other_user = db.query(User).filter(User.id == other_membership.user_id).first()
                if other_user:
                    display_name = other_user.nickname
                    print(f"👤 1:1 채팅방 상대방: {other_user.nickname}")
        
        room_summary = RoomSummary(
            room_id=room.id,
            name=display_name,
            type=room.type,
            last_message=last_message.content if last_message else None,
            unread=0  # TODO: 읽지 않은 메시지 수 계산
        )
        
        if room.type == "dm":
            dms.append(room_summary)
            print(f"💬 DM 추가: {room.name}")
        elif room.type == "group":
            groups.append(room_summary)
            print(f"👥 그룹 추가: {room.name}")
    
    # 그룹 채팅방만 조회하는 경우 추가 로그
    print(f"🔍 그룹 채팅방 조회 결과:")
    print(f"   - DM 수: {len(dms)}")
    print(f"   - 그룹 수: {len(groups)}")
    for group in groups:
        print(f"   - 그룹: {group.room_id} ({group.name})")
    
    # 그룹 채팅은 새로운 Room 모델만 사용하므로 기존 ChatRoom 조회 제거
    print(f"📱 기존 ChatRoom 조회 제거됨 - 새로운 Room 모델만 사용")
    
    print(f"✅ 반환할 DM 수: {len(dms)}, 그룹 수: {len(groups)}")
    return MyRoomsOut(dms=dms, groups=groups)

# 새로운 Room 모델용 메시지 조회 API
@router.get("/rooms/{room_id}/messages/new")
def get_room_messages(
    room_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 Room 모델의 메시지를 조회합니다."""
    print(f"🔍 Room {room_id} 메시지 조회 - 사용자 ID: {current_user.id}")
    
    # Room 존재 확인
    print(f"🔎 Room 조회 시작 - room_id={room_id}")
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        print(f"❌ Room 없음 - room_id={room_id}")
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    print(f"✅ Room 확인 - id={room.id}, type={room.type}, status={room.status}")
    
    # 사용자가 해당 방의 멤버인지 확인
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="채팅방에 접근할 권한이 없습니다")
    
    # 메시지 조회
    messages = db.query(ChatMessage).filter(
        ChatMessage.room_id == room_id,
        ChatMessage.is_deleted == False
    ).order_by(ChatMessage.id.desc()).limit(limit).all()
    
    # 메시지 순서를 시간순으로 정렬 (최신 메시지가 마지막)
    messages = list(reversed(messages))
    
    print(f"📊 Room {room_id} 메시지 수: {len(messages)}")
    
    return {
        "messages": [
            {
                "id": msg.id,
                "content": msg.content,
                "image_urls": json.loads(msg.image_urls) if msg.image_urls else None,
                "sender_id": msg.sender_id,
                "room_id": msg.room_id,
                "created_at": msg.sent_at.isoformat() if msg.sent_at else None,
                "is_deleted": msg.is_deleted
            }
            for msg in messages
        ],
        "room_info": {
            "id": room.id,
            "name": room.name,
            "type": room.type,
            "description": room.description
        }
    }

# 새로운 Room 모델용 메시지 전송 API
@router.post("/rooms/{room_id}/messages/new")
async def send_room_message(
    room_id: int,
    message_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새로운 Room 모델에 메시지를 전송합니다."""
    print(f"📤 Room {room_id} 메시지 전송 - 사용자 ID: {current_user.id}")
    
    # Room 존재 확인
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 사용자가 해당 방의 멤버인지 확인
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="채팅방에 접근할 권한이 없습니다")
    
    # 메시지 생성
    new_message = ChatMessage(
        content=message_data.get("text", ""),
        sender_id=current_user.id,
        room_id=room_id,
        is_deleted=False
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    print(f"✅ Room {room_id} 메시지 전송 완료 - 메시지 ID: {new_message.id}")
    
    # WebSocket으로 실시간 전송
    try:
        from app.websocket_manager import manager
        ws_message = {
            "type": "message",
            "room_id": room_id,
            "user_id": current_user.id,
            "content": new_message.content,
            "sent_at": new_message.sent_at.isoformat() if new_message.sent_at else None
        }
        
        # 온라인 사용자들에게 브로드캐스트
        await manager.broadcast_to_room(
            json.dumps(ws_message),
            room_id,
            exclude_user=current_user.id
        )
        print(f"📡 WebSocket 브로드캐스트 완료")
    except Exception as e:
        print(f"❌ WebSocket 브로드캐스트 실패: {e}")
    
    # 채팅 알림 전송 (현재 채팅방에 없는 사용자에게만)
    try:
        from app.services.fcm_service import send_chat_notification
        notification_result = send_chat_notification(
            db=db,
            room_id=room_id,
            sender_id=current_user.id,
            message_content=new_message.content,
            room_type=room.type,
            room_name=room.name
        )
        print(f"📱 채팅 알림 전송 결과: {notification_result}")
    except Exception as e:
        print(f"❌ 채팅 알림 전송 실패: {e}")
    
    return {
        "id": new_message.id,
        "content": new_message.content,
        "image_urls": json.loads(new_message.image_urls) if new_message.image_urls else None,
        "sender_id": new_message.sender_id,
        "room_id": new_message.room_id,
        "created_at": new_message.sent_at.isoformat() if new_message.sent_at else None
    }

# 이미지 업로드 및 전송 (최대 10장)
@router.post("/rooms/{room_id}/images")
async def upload_room_images(
    room_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Base64 또는 바이너리 배열을 받아 S3 업로드 후 이미지 메시지 생성.
    요청 형식: { images: [{ content_type: string, data_base64: string }, ...] } (최대 10)
    """
    import base64
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 요청 본문")

    images = body.get('images', [])
    if not isinstance(images, list) or len(images) == 0:
        raise HTTPException(status_code=400, detail="이미지가 없습니다")
    if len(images) > 10:
        raise HTTPException(status_code=400, detail="최대 10장까지 업로드 가능합니다")

    # 방 정보 조회 (알림 전송 시 사용 및 멤버십 정책 판단)
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")

    # 권한 체크: DM의 경우 비활성 멤버십이면 자동 재활성화(idempotent)
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="채팅방에 접근할 권한이 없습니다")
    if not membership.is_active:
        if room.type == "dm":
            membership.is_active = True
            db.commit()
        else:
            # 그룹은 명시적으로 재참여해야 함
            raise HTTPException(status_code=403, detail="채팅방에 접근할 권한이 없습니다")

    urls = []
    # 업로드 시작 인덱스 계산 (중복 방지)
    start_idx = s3_service.get_next_chat_index(room_id, current_user.id)
    for offset, img in enumerate(images):
        content_type = img.get('content_type')
        data_b64 = img.get('data_base64')
        if not data_b64:
            continue
        try:
            data = base64.b64decode(data_b64)
            # 게시글과 동일한 S3 업로드 로직으로 통일
            idx = start_idx + offset
            filename = f"chat/{room_id}/image_{current_user.id}_{idx}.jpg"
            url = await s3_service.upload_image(data, filename, content_type or 'image/jpeg')
            urls.append(url)
        except Exception as e:
            print(f"❌ 이미지 업로드 실패 idx={idx}: {e}")
            continue

    if len(urls) == 0:
        raise HTTPException(status_code=400, detail="업로드된 이미지가 없습니다")

    # 이미지 메시지 생성
    msg = ChatMessage(
        content="",  # 텍스트 없음
        sender_id=current_user.id,
        room_id=room_id,
        image_urls=json.dumps(urls),
        is_deleted=False
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # WS 브로드캐스트
    try:
        from app.websocket_manager import manager
        ws_message = {
            "type": "message",
            "room_id": room_id,
            "user_id": current_user.id,
            "content": "",
            "image_urls": urls,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None
        }
        await manager.broadcast_to_room(json.dumps(ws_message), room_id, exclude_user=current_user.id)
    except Exception as e:
        print(f"❌ 이미지 메시지 WS 브로드캐스트 실패: {e}")

    # 채팅 알림 전송 (현재 채팅방에 없는 사용자에게만)
    try:
        from app.services.fcm_service import send_chat_notification
        placeholder = f"사진 {len(urls)}장을 보냈습니다."
        notification_result = send_chat_notification(
            db=db,
            room_id=room_id,
            sender_id=current_user.id,
            message_content=placeholder,
            room_type=room.type,
            room_name=room.name
        )
        print(f"📱 이미지 채팅 알림 전송 결과: {notification_result}")
    except Exception as e:
        print(f"❌ 이미지 채팅 알림 전송 실패: {e}")

    return {
        "id": msg.id,
        "content": "",
        "image_urls": urls,
        "sender_id": msg.sender_id,
        "room_id": msg.room_id,
        "created_at": msg.sent_at.isoformat() if msg.sent_at else None
    }

# 채팅방 참여자 목록 조회 API
@router.get("/rooms/{room_id}/participants")
def get_room_participants(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방의 참여자 목록을 조회"""
    print(f"🔍 채팅방 참여자 목록 조회 - Room ID: {room_id}, 사용자 ID: {current_user.id}")
    
    # Room 존재 확인
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 사용자가 해당 방의 멤버인지 확인
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="채팅방에 접근할 권한이 없습니다")
    
    # 참여자 목록 조회 (User와 Membership 정보 함께)
    participants_data = db.query(User, Membership).join(Membership).filter(
        Membership.room_id == room_id,
        Membership.is_active == True
    ).all()
    
    print(f"✅ 참여자 목록 조회 완료 - 참여자 수: {len(participants_data)}")
    
    return {
        "participants": [
            {
                "id": user.id,
                "nickname": user.nickname,
                "profile_image_url": user.profile_image_url,
                "is_admin": user.is_admin,
                "joined_at": membership.created_at.isoformat() if membership.created_at else None
            }
            for user, membership in participants_data
        ],
        "total_count": len(participants_data)
    }

# 채팅방 나가기 API
@router.post("/rooms/{room_id}/leave")
async def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방에서 나갑니다."""
    print(f"🚪 채팅방 나가기 - Room ID: {room_id}, 사용자 ID: {current_user.id}")
    
    # Room 존재 확인
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 사용자의 멤버십 확인
    print(f"🔎 Membership 조회 - room_id={room_id}, user_id={current_user.id}")
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).first()
    
    if not membership:
        # 멤버십이 없거나 이미 비활성화된 경우에도 idempotent하게 성공 처리
        print(f"ℹ️ 활성 멤버십 없음 - room_id={room_id}, user_id={current_user.id}")
        return {"message": "이미 채팅방을 나갔습니다"}
    else:
        print(f"✅ Membership 확인 - id={membership.id}, is_active={membership.is_active}, role={membership.role}")
    
    # 1:1 채팅방인 경우
    if room.type == "dm":
        # 1:1 채팅방은 멤버십을 비활성화
        membership.is_active = False
        db.commit()
        print(f"✅ 1:1 채팅방 나가기 완료 - 사용자 {current_user.id}, room_id={room_id}")
        
        return {"message": "채팅방을 나갔습니다"}
    
    # 그룹 채팅방인 경우
    else:
        # 시스템 메시지 생성 (다른 사용자들에게 알림)
        print(f"📝 시스템 메시지 생성 준비 - room_id={room_id}")
        system_message = ChatMessage(
            content=f"{current_user.nickname}님이 채팅방에서 나갔습니다",
            sender_id=None,  # 시스템 메시지는 sender_id가 없음
            room_id=room_id,
            is_deleted=False
        )
        
        db.add(system_message)
        
        # 멤버십 비활성화
        membership.is_active = False
        
        db.commit()
        db.refresh(system_message)
        
        print(f"✅ 그룹 채팅방 나가기 완료 - 사용자 {current_user.id}, room_id={room_id}, system_message_id={system_message.id}")
        
        # WebSocket으로 시스템 메시지 브로드캐스트
        try:
            from app.websocket_manager import manager
            ws_message = {
                "type": "system_message",
                "room_id": room_id,
                "content": system_message.content,
                "sent_at": system_message.sent_at.isoformat() if system_message.sent_at else None
            }
            
            await manager.broadcast_to_room(
                json.dumps(ws_message),
                room_id,
                exclude_user=current_user.id
            )
            print(f"📡 시스템 메시지 브로드캐스트 완료")
        except Exception as e:
            import traceback
            print(f"❌ WebSocket 브로드캐스트 실패: {e}\n{traceback.format_exc()}")
        
        return {"message": "채팅방을 나갔습니다"}