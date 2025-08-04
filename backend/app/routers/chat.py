from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime, timezone, timedelta

from ..db.database import get_db
from ..models.user import User
from ..models.chat import ChatRoom, ChatMessage
from ..schemas.chat import (
    ChatRoomCreate, 
    ChatRoomResponse, 
    ChatRoomDetailResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatRoomApprovalRequest,
    ChatRoomListResponse
)
from ..routers.user import get_current_user
from ..services.fcm_service import send_chat_notification

router = APIRouter(prefix="/chat", tags=["chat"])

def get_korea_time():
    """한국 시간을 반환하는 함수"""
    korea_tz = timezone(timedelta(hours=9))
    return datetime.now(korea_tz)

# 채팅방 생성 요청
@router.post("/rooms", response_model=ChatRoomResponse)
def create_chat_room(
    chat_data: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 생성 요청"""
    
    # 채팅방 생성
    new_chat_room = ChatRoom(
        title=chat_data.title,
        purpose=chat_data.purpose,
        created_by=current_user.id,
        is_approved=None  # None으로 설정하여 대기 상태로 만듦
    )
    
    db.add(new_chat_room)
    db.commit()
    db.refresh(new_chat_room)
    
    # 생성자를 멤버로 추가
    new_chat_room.members.append(current_user)
    db.commit()
    
    print(f"채팅방 생성 완료: {new_chat_room.title} (ID: {new_chat_room.id})")
    print(f"생성자: {current_user.nickname} (ID: {current_user.id})")
    print(f"멤버 수: {len(new_chat_room.members)}")
    
    # 응답 데이터 구성
    response_data = ChatRoomResponse(
        id=new_chat_room.id,
        title=new_chat_room.title,
        purpose=new_chat_room.purpose,
        created_by=new_chat_room.created_by,
        created_at=new_chat_room.created_at,
        is_active=new_chat_room.is_active,
        is_approved=new_chat_room.is_approved,
        approved_by=new_chat_room.approved_by,
        approved_at=new_chat_room.approved_at,
        creator_nickname=current_user.nickname,
        creator_profile_image_url=current_user.profile_image_url,
        member_count=1,
        last_message=None,
        last_message_time=None
    )
    
    return response_data

# 사용자의 채팅방 목록 조회
@router.get("/rooms", response_model=ChatRoomListResponse)
def get_user_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """사용자가 참여한 채팅방 목록 조회"""
    
    print(f"사용자 {current_user.email}의 채팅방 목록 조회")
    
    # 승인된 채팅방만 조회
    approved_rooms = db.query(ChatRoom).filter(
        ChatRoom.is_approved == True,
        ChatRoom.is_active == True,
        ChatRoom.members.any(id=current_user.id)
    ).offset(skip).limit(limit).all()
    
    print(f"승인된 채팅방 수: {len(approved_rooms)}")
    for room in approved_rooms:
        print(f"  - {room.title} (ID: {room.id})")
    
    # 대기 중인 채팅방 (본인이 생성한 것만)
    pending_rooms = db.query(ChatRoom).filter(
        ChatRoom.is_approved.is_(None),
        ChatRoom.created_by == current_user.id
    ).offset(skip).limit(limit).all()
    
    print(f"대기 중인 채팅방 수: {len(pending_rooms)}")
    for room in pending_rooms:
        print(f"  - {room.title} (ID: {room.id})")
    
    # 응답 데이터 구성
    def create_room_response(room: ChatRoom, is_pending: bool = False):
        # 마지막 메시지 조회
        last_message = db.query(ChatMessage).filter(
            ChatMessage.chat_id == room.id
        ).order_by(desc(ChatMessage.created_at)).first()
        
        return ChatRoomResponse(
            id=room.id,
            title=room.title,
            purpose=room.purpose,
            created_by=room.created_by,
            created_at=room.created_at,
            is_active=room.is_active,
            is_approved=room.is_approved,
            approved_by=room.approved_by,
            approved_at=room.approved_at,
            creator_nickname=room.creator.nickname,
            creator_profile_image_url=room.creator.profile_image_url,
            member_count=len(room.members),
            last_message=last_message.content if last_message else None,
            last_message_time=last_message.created_at if last_message else None
        )
    
    approved_responses = [create_room_response(room) for room in approved_rooms]
    pending_responses = [create_room_response(room, True) for room in pending_rooms]
    
    return ChatRoomListResponse(
        pending_rooms=pending_responses,
        approved_rooms=approved_responses,
        total_pending=len(pending_responses),
        total_approved=len(approved_responses)
    )

# 전체 채팅방 목록 조회 (승인된 채팅방만)
@router.get("/rooms/all", response_model=List[ChatRoomResponse])
def get_all_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """전체 채팅방 목록 조회 (승인된 채팅방만)"""
    
    print(f"사용자 {current_user.email}의 전체 채팅방 목록 조회")
    
    # 승인된 활성 채팅방만 조회
    all_rooms = db.query(ChatRoom).filter(
        ChatRoom.is_approved == True,
        ChatRoom.is_active == True
    ).order_by(ChatRoom.created_at.desc()).offset(skip).limit(limit).all()
    
    print(f"전체 채팅방 수: {len(all_rooms)}")
    for room in all_rooms:
        print(f"  - {room.title} (ID: {room.id})")
    
    def create_room_response(room: ChatRoom):
        # 마지막 메시지 조회
        last_message = db.query(ChatMessage).filter(
            ChatMessage.chat_id == room.id
        ).order_by(desc(ChatMessage.created_at)).first()
        
        # 현재 사용자가 멤버인지 확인
        is_member = current_user in room.members
        
        return ChatRoomResponse(
            id=room.id,
            title=room.title,
            purpose=room.purpose,
            created_by=room.created_by,
            created_at=room.created_at,
            is_active=room.is_active,
            is_approved=room.is_approved,
            approved_by=room.approved_by,
            approved_at=room.approved_at,
            creator_nickname=room.creator.nickname,
            creator_profile_image_url=room.creator.profile_image_url,
            member_count=len(room.members),
            last_message=last_message.content if last_message else None,
            last_message_time=last_message.created_at if last_message else None
        )
    
    return [create_room_response(room) for room in all_rooms]

# 채팅방 참여
@router.post("/rooms/{room_id}/join", response_model=ChatRoomResponse)
def join_chat_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 참여"""
    
    chat_room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    
    # 승인되지 않은 채팅방은 참여 불가
    if not chat_room.is_approved:
        raise HTTPException(status_code=403, detail="승인되지 않은 채팅방입니다.")
    
    # 비활성화된 채팅방은 참여 불가
    if not chat_room.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 채팅방입니다.")
    
    # 이미 멤버인지 확인
    if current_user in chat_room.members:
        raise HTTPException(status_code=400, detail="이미 참여 중인 채팅방입니다.")
    
    # 채팅방에 참여
    chat_room.members.append(current_user)
    db.commit()
    db.refresh(chat_room)
    
    print(f"사용자 {current_user.email}이 채팅방 {chat_room.title}에 참여했습니다.")
    
    return ChatRoomResponse(
        id=chat_room.id,
        title=chat_room.title,
        purpose=chat_room.purpose,
        created_by=chat_room.created_by,
        created_at=chat_room.created_at,
        is_active=chat_room.is_active,
        is_approved=chat_room.is_approved,
        approved_by=chat_room.approved_by,
        approved_at=chat_room.approved_at,
        creator_nickname=chat_room.creator.nickname,
        creator_profile_image_url=chat_room.creator.profile_image_url,
        member_count=len(chat_room.members),
        last_message=None,
        last_message_time=None
    )

# 채팅방 상세 정보 조회
@router.get("/rooms/{room_id}", response_model=ChatRoomDetailResponse)
def get_chat_room_detail(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 상세 정보 조회"""
    
    chat_room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    
    # 승인되지 않은 채팅방은 생성자만 접근 가능
    if not chat_room.is_approved and chat_room.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="승인되지 않은 채팅방입니다.")
    
    # 승인된 채팅방은 멤버만 접근 가능
    if chat_room.is_approved and current_user not in chat_room.members:
        raise HTTPException(status_code=403, detail="채팅방 멤버가 아닙니다.")
    
    # 멤버 정보 구성
    members_info = []
    for member in chat_room.members:
        members_info.append({
            "id": member.id,
            "nickname": member.nickname,
            "joined_at": chat_room.created_at  # 기본값으로 채팅방 생성 시간 사용
        })
    
    return ChatRoomDetailResponse(
        id=chat_room.id,
        title=chat_room.title,
        purpose=chat_room.purpose,
        created_by=chat_room.created_by,
        created_at=chat_room.created_at,
        is_active=chat_room.is_active,
        is_approved=chat_room.is_approved,
        approved_by=chat_room.approved_by,
        approved_at=chat_room.approved_at,
        creator_nickname=chat_room.creator.nickname,
        creator_profile_image_url=chat_room.creator.profile_image_url,
        members=members_info
    )

# 채팅방 메시지 목록 조회
@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def get_chat_messages(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """채팅방 메시지 목록 조회"""
    
    chat_room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    
    # 승인되지 않은 채팅방은 생성자만 접근 가능
    if not chat_room.is_approved and chat_room.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="승인되지 않은 채팅방입니다.")
    
    # 승인된 채팅방은 멤버만 접근 가능
    if chat_room.is_approved and current_user not in chat_room.members:
        raise HTTPException(status_code=403, detail="채팅방 멤버가 아닙니다.")
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_id == room_id
    ).order_by(desc(ChatMessage.created_at)).offset(skip).limit(limit).all()
    
    # 최신 메시지부터 정렬
    messages.reverse()
    
    return [
        ChatMessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender_id=msg.sender_id,
            content=msg.content,
            created_at=msg.created_at,
            sender_nickname=msg.sender.nickname,
            sender_profile_image_url=msg.sender.profile_image_url
        )
        for msg in messages
    ]

# 메시지 전송
@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse)
def send_message(
    room_id: int,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메시지 전송"""
    
    chat_room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    
    # 승인되지 않은 채팅방은 메시지 전송 불가
    if not chat_room.is_approved:
        raise HTTPException(status_code=403, detail="승인되지 않은 채팅방입니다.")
    
    # 멤버가 아닌 경우 메시지 전송 불가
    if current_user not in chat_room.members:
        raise HTTPException(status_code=403, detail="채팅방 멤버가 아닙니다.")
    
    # 메시지 생성
    new_message = ChatMessage(
        chat_id=room_id,
        sender_id=current_user.id,
        content=message_data.content
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # 메시지 전송 시 FCM 알림 발송 (자신에게는 알림 안 보내기)
    recipient_ids = [member.id for member in chat_room.members if member.id != current_user.id]
    if recipient_ids:
        try:
            print(f"채팅 알림 전송 시작: 채팅방 ID={room_id}, 발신자={current_user.nickname}, 수신자 수={len(recipient_ids)}, 수신자 IDs={recipient_ids}")
            send_chat_notification(
                db=db,
                chat_room_id=room_id,
                sender_nickname=current_user.nickname,
                message_content=message_data.content,
                recipient_ids=recipient_ids
            )
            print("채팅 알림 전송 성공")
        except Exception as e:
            print(f"채팅 FCM 알림 발송 실패: {e}")
            print(f"오류 타입: {type(e)}")
    else:
        print(f"채팅방에 다른 멤버가 없음: 알림 전송 건너뜀")
    
    return ChatMessageResponse(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        content=new_message.content,
        created_at=new_message.created_at,
        sender_nickname=current_user.nickname,
        sender_profile_image_url=current_user.profile_image_url
    )

# 관리자용 채팅방 승인/거부
@router.put("/rooms/{room_id}/approve", response_model=ChatRoomResponse)
def approve_chat_room(
    room_id: int,
    approval_data: ChatRoomApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 승인/거부 (관리자만)"""
    
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    chat_room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    
    if chat_room.is_approved is not None and chat_room.approved_by is not None:
        raise HTTPException(status_code=400, detail="이미 처리된 채팅방입니다.")
    
    # 승인/거부 처리
    chat_room.is_approved = approval_data.is_approved
    chat_room.approved_by = current_user.id
    chat_room.approved_at = datetime.now()
    
    if approval_data.is_approved:
        # 승인된 경우 생성자를 멤버로 추가 (이미 멤버가 아닌 경우)
        creator = db.query(User).filter(User.id == chat_room.created_by).first()
        print(f"채팅방 승인: {chat_room.title} (ID: {chat_room.id})")
        print(f"생성자: {creator.nickname if creator else 'Unknown'} (ID: {chat_room.created_by})")
        print(f"현재 멤버 수: {len(chat_room.members)}")
        
        if creator and creator not in chat_room.members:
            chat_room.members.append(creator)
            print(f"생성자를 멤버로 추가: {creator.nickname}")
        else:
            print(f"생성자는 이미 멤버입니다: {creator.nickname if creator else 'Unknown'}")
        
        print(f"승인 후 멤버 수: {len(chat_room.members)}")
    else:
        # 거부된 경우 비활성화
        chat_room.is_active = False
        print(f"채팅방 거부: {chat_room.title} (ID: {chat_room.id})")
    
    db.commit()
    db.refresh(chat_room)
    
    return ChatRoomResponse(
        id=chat_room.id,
        title=chat_room.title,
        purpose=chat_room.purpose,
        created_by=chat_room.created_by,
        created_at=chat_room.created_at,
        is_active=chat_room.is_active,
        is_approved=chat_room.is_approved,
        approved_by=chat_room.approved_by,
        approved_at=chat_room.approved_at,
        creator_nickname=chat_room.creator.nickname,
        member_count=len(chat_room.members),
        last_message=None,
        last_message_time=None
    )

# 관리자용 대기 중인 채팅방 목록 조회
@router.get("/admin/pending", response_model=List[ChatRoomResponse])
def get_pending_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """대기 중인 채팅방 목록 조회 (관리자만)"""
    
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    
    pending_rooms = db.query(ChatRoom).filter(
        (ChatRoom.is_approved.is_(None)) | (ChatRoom.is_approved == False)
    ).order_by(ChatRoom.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        ChatRoomResponse(
            id=room.id,
            title=room.title,
            purpose=room.purpose,
            created_by=room.created_by,
            created_at=room.created_at,
            is_active=room.is_active,
            is_approved=room.is_approved,
            approved_by=room.approved_by,
            approved_at=room.approved_at,
            creator_nickname=room.creator.nickname,
            member_count=len(room.members),
            last_message=None,
            last_message_time=None
        )
        for room in pending_rooms
    ] 