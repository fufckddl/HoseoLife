from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from typing import List
from datetime import datetime, timezone, timedelta

from ..db.database import get_db
from ..models.user import User
from ..models.chat import DirectMessage
from ..schemas.chat import (
    DirectMessageCreate,
    DirectMessageResponse,
    DirectChatResponse
)
from ..routers.user import get_current_user
from ..services.fcm_service import send_direct_message_notification

router = APIRouter(prefix="/direct-chat", tags=["direct-chat"])

def get_korea_time():
    """한국 시간을 반환하는 함수"""
    korea_tz = timezone(timedelta(hours=9))
    return datetime.now(korea_tz)

@router.get("/conversations", response_model=List[DirectChatResponse])
def get_direct_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 1:1 채팅 대화 목록 조회"""
    
    print(f"1:1 채팅 대화 목록 조회 - 사용자 ID: {current_user.id}, 닉네임: {current_user.nickname}")
    
    # 현재 사용자가 참여한 모든 1:1 대화 조회
    conversations = db.query(DirectMessage).filter(
        or_(
            DirectMessage.sender_id == current_user.id,
            DirectMessage.receiver_id == current_user.id
        )
    ).order_by(DirectMessage.created_at.desc()).all()
    
    print(f"조회된 메시지 수: {len(conversations)}")
    
    # 대화 상대별로 그룹화
    conversation_map = {}
    
    for message in conversations:
        # 대화 상대 ID 결정
        if message.sender_id == current_user.id:
            other_user_id = message.receiver_id
            other_user = message.receiver
        else:
            other_user_id = message.sender_id
            other_user = message.sender
        
        print(f"메시지 처리: ID={message.id}, 발신자={message.sender_id}, 수신자={message.receiver_id}, 상대방={other_user_id}, 내용={message.content[:20]}...")
        
        # 대화 상대가 이미 있는 경우, 더 최신 메시지로 업데이트
        if other_user_id not in conversation_map:
            conversation_map[other_user_id] = {
                'other_user_id': other_user_id,
                'other_user_nickname': other_user.nickname,
                'other_user_profile_image_url': other_user.profile_image_url,
                'last_message': message.content,
                'last_message_time': message.created_at,
                'unread_count': 0
            }
            print(f"새로운 대화 상대 추가: {other_user.nickname} (ID: {other_user_id})")
        else:
            # 더 최신 메시지인 경우 업데이트
            if message.created_at > conversation_map[other_user_id]['last_message_time']:
                conversation_map[other_user_id]['last_message'] = message.content
                conversation_map[other_user_id]['last_message_time'] = message.created_at
                print(f"최신 메시지로 업데이트: {other_user.nickname} - {message.content[:20]}...")
        
        # 읽지 않은 메시지 수 계산 (받은 메시지만)
        if message.receiver_id == current_user.id and not message.is_read:
            conversation_map[other_user_id]['unread_count'] += 1
            print(f"읽지 않은 메시지 추가: {other_user.nickname} (총 {conversation_map[other_user_id]['unread_count']}개)")
    
    # 최신 메시지 순으로 정렬
    conversations_list = list(conversation_map.values())
    conversations_list.sort(key=lambda x: x['last_message_time'], reverse=True)
    
    print(f"최종 대화 목록: {len(conversations_list)}개")
    for conv in conversations_list:
        print(f"  - {conv['other_user_nickname']}: {conv['last_message'][:20]}... (읽지 않은 메시지: {conv['unread_count']}개)")
    
    return conversations_list

@router.get("/conversations/{other_user_id}/messages", response_model=List[DirectMessageResponse])
def get_direct_messages(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """특정 사용자와의 1:1 메시지 조회"""
    
    # 상대방 사용자 존재 확인
    other_user = db.query(User).filter(User.id == other_user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 메시지 조회
    messages = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == current_user.id, DirectMessage.receiver_id == other_user_id),
            and_(DirectMessage.sender_id == other_user_id, DirectMessage.receiver_id == current_user.id)
        )
    ).order_by(DirectMessage.created_at.desc()).offset(skip).limit(limit).all()
    
    # 메시지를 시간순으로 정렬 (오래된 순)
    messages.reverse()
    
    # 읽지 않은 메시지를 읽음으로 표시
    unread_messages = db.query(DirectMessage).filter(
        DirectMessage.sender_id == other_user_id,
        DirectMessage.receiver_id == current_user.id,
        DirectMessage.is_read == False
    ).all()
    
    for message in unread_messages:
        message.is_read = True
    
    db.commit()
    
    # 응답 데이터 구성
    result = []
    for message in messages:
        result.append(DirectMessageResponse(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            content=message.content,
            created_at=message.created_at,
            is_read=message.is_read,
            sender_nickname=message.sender.nickname,
            sender_profile_image_url=message.sender.profile_image_url,
            receiver_nickname=message.receiver.nickname,
            receiver_profile_image_url=message.receiver.profile_image_url
        ))
    
    return result

@router.post("/conversations/{other_user_id}/messages", response_model=DirectMessageResponse)
def send_direct_message(
    other_user_id: int,
    message_data: DirectMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """1:1 메시지 전송"""
    
    # 상대방 사용자 존재 확인
    other_user = db.query(User).filter(User.id == other_user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 자신에게 메시지 보내기 방지
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신에게 메시지를 보낼 수 없습니다.")
    
    # 메시지 생성
    new_message = DirectMessage(
        sender_id=current_user.id,
        receiver_id=other_user_id,  # URL 경로에서 가져온 other_user_id 사용
        content=message_data.content
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # FCM 알림 전송
    try:
        send_direct_message_notification(
            db=db,
            sender_nickname=current_user.nickname,
            message_content=message_data.content,
            receiver_id=other_user_id
        )
        print("1:1 메시지 알림 전송 성공")
    except Exception as e:
        print(f"1:1 메시지 알림 전송 실패: {e}")
    
    return DirectMessageResponse(
        id=new_message.id,
        sender_id=new_message.sender_id,
        receiver_id=new_message.receiver_id,
        content=new_message.content,
        created_at=new_message.created_at,
        is_read=new_message.is_read,
        sender_nickname=current_user.nickname,
        sender_profile_image_url=current_user.profile_image_url,
        receiver_nickname=other_user.nickname,
        receiver_profile_image_url=other_user.profile_image_url
    ) 