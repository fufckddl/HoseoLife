# 그룹 채팅 관련 API 엔드포인트
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from app.db.database import get_db
from app.models.user import User
from app.models.group_chat import GroupCreationRequest, Room, Membership, GroupStatus, RoomStatus, UserRole, ChatMessage
from app.schemas.group_chat import (
    GroupRequestCreate, GroupRequestOut, GroupApproveOut, 
    AvailableGroupOut, MyRoomsOut, JoinResponse, RoomSummary
)
from app.routers.user import get_current_user
from app.services.fcm_service import send_fcm_to_user
from app.services.s3_service import s3_service
from fastapi import Request
import json
from app.models.chat import UserRoomLeaveTime

router = APIRouter(prefix="/chat", tags=["group_chat"])

# 🆕 그룹 이미지를 임시에서 최종 경로로 이동하는 함수
async def move_group_image_to_final_path(old_image_url: str, room_id: int, s3_service) -> str:
    """
    S3에서 그룹 이미지를 임시 경로에서 최종 경로로 이동
    group/temp_xxx/logo.png -> group/{room_id}/logo.png
    """
    try:
        # URL에서 키 추출: https://bucket.s3.region.amazonaws.com/group/temp_xxx/logo.png
        if '/group/' not in old_image_url:
            return old_image_url
        
        # 기존 키 추출
        old_key = old_image_url.split('.amazonaws.com/')[-1]  # group/temp_xxx/logo.png
        
        # 파일 확장자 추출 (기본값: png)
        file_extension = old_key.split('.')[-1] if '.' in old_key else 'png'
        
        # 새로운 키 생성: group/{room_id}/logo.png
        new_key = f"group/{room_id}/logo.{file_extension}"
        
        # S3에서 파일 복사
        s3_service._initialize()
        
        # 기존 파일을 새 위치로 복사
        s3_service.s3_client.copy_object(
            Bucket=s3_service.bucket_name,
            CopySource={'Bucket': s3_service.bucket_name, 'Key': old_key},
            Key=new_key
        )
        
        # 기존 파일 삭제
        s3_service.s3_client.delete_object(
            Bucket=s3_service.bucket_name,
            Key=old_key
        )
        
        # 새 URL 생성
        new_url = f"https://{s3_service.bucket_name}.s3.ap-northeast-2.amazonaws.com/{new_key}"
        print(f"✅ S3 그룹 이미지 이동 완료: {old_key} -> {new_key}")
        
        return new_url
        
    except Exception as e:
        print(f"❌ S3 그룹 이미지 이동 실패: {e}")
        return old_image_url  # 실패 시 기존 URL 반환

# 그룹 생성 요청
@router.post("/groups/requests", response_model=GroupRequestOut)
def create_group_request(
    request: GroupRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 생성 요청을 생성합니다."""
    print(f"🔍 그룹 생성 요청 - 사용자: {current_user.nickname}, 그룹명: {request.name}, 이미지: {getattr(request, 'image_url', None)}")
    
    group_request = GroupCreationRequest(
        requester_id=current_user.id,
        name=request.name,
        description=request.description,
        image_url=getattr(request, 'image_url', None),  # 🆕 안전하게 image_url 접근
        status=GroupStatus.PENDING
    )
    
    db.add(group_request)
    db.commit()
    db.refresh(group_request)
    
    return GroupRequestOut(
        id=group_request.id,
        name=group_request.name,
        description=group_request.description,
        imageUrl=group_request.image_url,  # 🆕 이미지 URL 추가
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
async def approve_group_request(
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
        image_url=group_request.image_url,  # 🆕 그룹 대표 이미지 URL 추가
        status=RoomStatus.ACTIVE
    )
    db.add(new_room)
    db.flush()  # ID 생성을 위해 flush
    
    # 🆕 S3 이미지 경로를 최종 경로로 업데이트
    if group_request.image_url:
        try:
            from app.services.s3_service import s3_service
            updated_image_url = await move_group_image_to_final_path(
                group_request.image_url, 
                new_room.id,
                s3_service
            )
            if updated_image_url:
                new_room.image_url = updated_image_url
                print(f"✅ 그룹 이미지 경로 업데이트: {group_request.image_url} -> {updated_image_url}")
        except Exception as e:
            print(f"⚠️ 그룹 이미지 경로 업데이트 실패: {e}")
            # 실패해도 그룹 생성은 계속 진행
    
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
    
    return GroupApproveOut(roomId=new_room.id, status="approved")  # 🔧 alias 필드명 사용

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
    
    try:
        from sqlalchemy import text
        
        # 🔧 직접 SQL 사용하여 순환 참조 문제 회피
        # 사용자가 이미 참여 중인 그룹 ID 목록
        my_memberships = db.execute(text("""
            SELECT room_id FROM memberships 
            WHERE user_id = :user_id
        """), {'user_id': current_user.id}).fetchall()
        
        my_group_ids = [m[0] for m in my_memberships]
        print(f"📊 사용자가 참여 중인 그룹 ID: {my_group_ids}")
        
        # 참여 가능한 그룹 조회 (직접 SQL)
        available_rooms_sql = """
            SELECT r.id, r.name, r.description, r.status,
                   (SELECT COUNT(*) FROM memberships WHERE room_id = r.id AND is_active = TRUE) as member_count
            FROM rooms r
            WHERE r.type = :room_type AND r.status = 'ACTIVE'
        """
        
        if my_group_ids:
            # 이미 참여 중인 그룹 제외
            placeholders = ','.join([':group_id_' + str(i) for i in range(len(my_group_ids))])
            available_rooms_sql += f" AND r.id NOT IN ({placeholders})"
            
            params = {'room_type': type}
            for i, group_id in enumerate(my_group_ids):
                params[f'group_id_{i}'] = group_id
        else:
            params = {'room_type': type}
        
        available_rooms = db.execute(text(available_rooms_sql), params).fetchall()
        
        print(f"🏠 참여 가능한 그룹 수: {len(available_rooms)}")
        
        result = []
        for room in available_rooms:
            group_info = {
                "roomId": room[0],  # 🔧 alias 필드명 사용
                "name": room[1],
                "description": room[2],
                "memberCount": room[4]
            }
            result.append(group_info)
            print(f"✅ 그룹 {room[0]} ({room[1]}) - 멤버 {room[4]}명")
        
        print(f"🎯 반환할 그룹 수: {len(result)}")
        return result
        
    except Exception as e:
        print(f"❌ 참여 가능한 그룹 조회 실패: {e}")
        import traceback
        print(f"오류 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="참여 가능한 그룹 조회에 실패했습니다")

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
    
    # 🆕 차단 확인 (양방향)
    from app.models.block import Block
    
    # 내가 상대방을 차단했는지 확인
    i_blocked_other = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == target_user_id,
        Block.is_active == True
    ).first()
    
    if i_blocked_other:
        raise HTTPException(
            status_code=403,
            detail="차단한 사용자와는 채팅할 수 없습니다."
        )
    
    # 상대방이 나를 차단했는지 확인
    other_blocked_me = db.query(Block).filter(
        Block.blocker_id == target_user_id,
        Block.blocked_id == current_user.id,
        Block.is_active == True
    ).first()
    
    if other_blocked_me:
        raise HTTPException(
            status_code=403,
            detail="상대방이 회원님을 차단하여 채팅할 수 없습니다."
        )
    
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
    print(f"🎯 그룹 참여 요청 - 사용자 {current_user.id}, 그룹 {room_id}")
    
    try:
        from sqlalchemy import text
        
        # 🔧 직접 SQL로 그룹 존재 확인
        room = db.execute(text("""
            SELECT id, name, type, status 
            FROM rooms 
            WHERE id = :room_id AND type = 'group' AND status = 'ACTIVE'
        """), {'room_id': room_id}).fetchone()
        
        if not room:
            raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")
        
        print(f"✅ 그룹 확인: {room[1]} (ID: {room[0]})")
        
        # 이미 참여 중인지 확인
        existing_membership = db.execute(text("""
            SELECT id, is_active FROM memberships 
            WHERE room_id = :room_id AND user_id = :user_id
        """), {'room_id': room_id, 'user_id': current_user.id}).fetchone()
        
        if existing_membership:
            if existing_membership[1]:  # is_active가 True인 경우
                print(f"⚠️ 이미 참여 중인 그룹")
                return {"joined": True}  # 🔧 dict 형태로 반환
            else:
                # 비활성화된 멤버십을 다시 활성화
                db.execute(text("""
                    UPDATE memberships 
                    SET is_active = TRUE 
                    WHERE id = :membership_id
                """), {'membership_id': existing_membership[0]})
                db.commit()
                print(f"✅ 멤버십 재활성화 완료")
                return {"joined": True}
        
        # 새 멤버십 생성
        db.execute(text("""
            INSERT INTO memberships (room_id, user_id, role, is_active, notifications_enabled)
            VALUES (:room_id, :user_id, 'MEMBER', TRUE, TRUE)
        """), {'room_id': room_id, 'user_id': current_user.id})
        
        db.commit()
        
        print(f"✅ 그룹 참여 완료")
        return {"joined": True}
        
    except Exception as e:
        print(f"❌ 그룹 참여 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="그룹 참여에 실패했습니다")

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

# 멤버십 활성화 (1:1 채팅방 재입장 시)
@router.post("/rooms/{room_id}/activate-membership")
def activate_membership(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """1:1 채팅방 재입장 시 멤버십을 활성화합니다."""
    print(f"🔄 멤버십 활성화 - room_id={room_id}, user_id={current_user.id}")
    
    # Room 존재 확인
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 1:1 채팅방만 허용
    if room.type != "dm":
        raise HTTPException(status_code=400, detail="1:1 채팅방에서만 사용할 수 있습니다")
    
    # 멤버십 조회 (비활성 상태도 포함)
    membership = db.query(Membership).filter(
        Membership.room_id == room_id,
        Membership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="채팅방 멤버십을 찾을 수 없습니다")
    
    # 멤버십 활성화
    membership.is_active = True
    db.commit()
    
    print(f"✅ 멤버십 활성화 완료 - room_id={room_id}, user_id={current_user.id}")
    return {"message": "멤버십이 활성화되었습니다", "room_id": room_id}

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
    print(f"🔍 Membership 조회 시작 - user_id: {current_user.id}")
    
    # 모든 멤버십 조회 (디버깅용)
    all_memberships = db.query(Membership).filter(
        Membership.user_id == current_user.id
    ).all()
    print(f"📊 전체 멤버십 수: {len(all_memberships)}")
    
    for ms in all_memberships:
        print(f"  - room_id: {ms.room_id}, is_active: {ms.is_active}, role: {ms.role}")
    
    # 활성 멤버십만 조회
    my_memberships = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.is_active == True
    ).all()
    
    print(f"📊 활성 멤버십 수: {len(my_memberships)}")
    
    # Room 테이블 상태 확인 (디버깅용)
    all_rooms = db.query(Room).all()
    print(f"🏠 전체 Room 수: {len(all_rooms)}")
    for r in all_rooms:
        print(f"  - id: {r.id}, name: {r.name}, type: {r.type}, status: {r.status}")
    
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
        other_user_profile_image = None  # 🆕 상대방 프로필 이미지
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
                    other_user_profile_image = other_user.profile_image_url  # 🆕 상대방 프로필 이미지 저장
                    print(f"👤 1:1 채팅방 상대방: {other_user.nickname}, 프로필 이미지: {other_user_profile_image}")
        
        # 🔧 마지막 메시지 처리 개선 (이미지 메시지 포함)
        last_message_text = None
        last_message_sender_name = None
        
        if last_message:
            # 발신자 정보 조회
            sender = db.query(User).filter(User.id == last_message.sender_id).first()
            last_message_sender_name = sender.nickname if sender else "알 수 없음"
            
            # 이미지 메시지인지 확인
            if last_message.image_urls:
                # 이미지 메시지인 경우
                if last_message.sender_id == current_user.id:
                    last_message_text = "내가 사진을 보냈습니다."
                else:
                    last_message_text = f"{last_message_sender_name}님이 사진을 보냈습니다."
            else:
                # 일반 텍스트 메시지인 경우
                last_message_text = last_message.content
        
        # 🆕 DM인 경우 상대방 프로필 이미지, 그룹인 경우 채팅방 이미지 사용
        room_image_url = None
        if room.type == "dm":
            room_image_url = other_user_profile_image  # DM: 상대방 프로필 이미지
        else:
            room_image_url = getattr(room, 'image_url', None)  # 그룹: 채팅방 이미지
        
        room_summary = RoomSummary(
            roomId=room.id,  # alias 사용
            name=display_name,
            type=room.type,
            imageUrl=room_image_url,  # 🆕 DM/그룹에 따라 적절한 이미지 URL 사용
            lastMessage=last_message_text,  # 🔧 개선된 메시지 텍스트 사용
            lastMessageSender=last_message_sender_name,  # 🆕 발신자 정보 추가
            lastMessageTime=last_message.sent_at if last_message else None,  # 🆕 마지막 메시지 시간 추가
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
    
    # 🔧 메시지 조회 (발신자 정보 포함)
    try:
        from sqlalchemy import text
        
        # 직접 SQL 사용하여 발신자 정보와 함께 조회
        sql = """
            SELECT 
                m.id, m.room_id, m.content, m.client_msg_id, m.sender_id, m.sent_at, m.is_deleted, m.image_urls,
                u.nickname as sender_nickname, u.profile_image_url as sender_profile_image_url
            FROM chat_messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = :room_id AND m.is_deleted = FALSE
            ORDER BY m.id DESC 
            LIMIT :limit
        """
        
        result = db.execute(text(sql), {'room_id': room_id, 'limit': limit})
        messages_data = result.fetchall()
        
        # 메시지 순서를 시간순으로 정렬 (최신 메시지가 마지막)
        messages_data = list(reversed(messages_data))
        
        print(f"📊 Room {room_id} 메시지 수: {len(messages_data)}")
        
        # 응답 형식으로 변환
        message_list = []
        for msg in messages_data:
            message_dict = {
                "id": msg[0],
                "content": msg[2],
                "image_urls": json.loads(msg[7]) if msg[7] else None,
                "sender_id": msg[4],
                "sender_nickname": msg[8],  # 🆕 발신자 닉네임
                "sender_profile_image_url": msg[9],  # 🆕 발신자 프로필 이미지
                "room_id": msg[1],
                "client_msg_id": msg[3],
                "sent_at": msg[5].isoformat() if msg[5] else None,
                "is_deleted": bool(msg[6])
            }
            message_list.append(message_dict)
        
        return {
            "messages": message_list,
            "room_info": {
                "id": room.id,
                "name": room.name,
                "type": room.type,
                "description": room.description
            }
        }
        
    except Exception as e:
        print(f"❌ 메시지 조회 실패: {e}")
        import traceback
        print(f"오류 상세: {traceback.format_exc()}")
        
        # 실패 시 기존 방식으로 fallback
        messages = db.query(ChatMessage).filter(
            ChatMessage.room_id == room_id,
            ChatMessage.is_deleted == False
        ).order_by(ChatMessage.id.desc()).limit(limit).all()
        
        # 메시지 순서를 시간순으로 정렬 (최신 메시지가 마지막)
        messages = list(reversed(messages))
        
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
    
    # 🆕 DM 채팅방인 경우 차단 확인
    if room.type == "dm":
        from app.models.block import Block
        
        # 상대방 찾기
        other_membership = db.query(Membership).filter(
            Membership.room_id == room_id,
            Membership.user_id != current_user.id
        ).first()
        
        if other_membership:
            # 상대방이 나를 차단했는지 확인
            is_blocked_by_other = db.query(Block).filter(
                Block.blocker_id == other_membership.user_id,
                Block.blocked_id == current_user.id,
                Block.is_active == True
            ).first()
            
            if is_blocked_by_other:
                raise HTTPException(
                    status_code=403, 
                    detail="상대방이 회원님을 차단하여 메시지를 보낼 수 없습니다."
                )
    
    # 메시지 생성 (한국 시간으로 저장)
    from datetime import datetime, timezone, timedelta
    
    # 현재 한국 시간
    korea_tz = timezone(timedelta(hours=9))
    current_korea_time = datetime.now(korea_tz)
    
    new_message = ChatMessage(
        content=message_data.get("text", ""),
        sender_id=current_user.id,
        room_id=room_id,
        sent_at=current_korea_time,
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
            "message_id": new_message.id,
            "sender_id": new_message.sender_id,
            "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
            "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
            "content": new_message.content,
            "sent_at": new_message.sent_at.isoformat() if new_message.sent_at else None
        }
        
        # 온라인 사용자들에게 브로드캐스트
        await manager.broadcast_to_room(
            room_id,
            ws_message,
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
        "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
        "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
        "room_id": new_message.room_id,
        "client_msg_id": new_message.client_msg_id,
        "sent_at": new_message.sent_at.isoformat() if new_message.sent_at else None,
        "is_deleted": new_message.is_deleted
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

    # 이미지 메시지 생성 (한국 시간으로 저장)
    from datetime import datetime, timezone, timedelta
    
    # 현재 한국 시간
    korea_tz = timezone(timedelta(hours=9))
    current_korea_time = datetime.now(korea_tz)
    
    msg = ChatMessage(
        content="",  # 텍스트 없음
        sender_id=current_user.id,
        room_id=room_id,
        image_urls=json.dumps(urls),
        sent_at=current_korea_time,
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
            "message_id": msg.id,
            "sender_id": msg.sender_id,
            "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
            "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
            "content": "",
            "image_urls": urls,
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None
        }
        await manager.broadcast_to_room(room_id, ws_message, exclude_user=None)
        print(f"📡 이미지 메시지 WebSocket 브로드캐스트 완료 - 메시지 ID: {msg.id}")
    except Exception as e:
        print(f"❌ 이미지 메시지 WS 브로드캐스트 실패: {e}")
        import traceback
        traceback.print_exc()

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
        "sender_nickname": current_user.nickname,  # 🆕 발신자 닉네임
        "sender_profile_image_url": current_user.profile_image_url,  # 🆕 발신자 프로필 이미지
        "room_id": msg.room_id,
        "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
        "is_deleted": msg.is_deleted
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

# 그룹 채팅방 정보 조회 API
@router.get("/rooms/{room_id}/info")
def get_room_info(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 정보를 조회합니다."""
    print(f"🔍 채팅방 정보 조회 - Room ID: {room_id}, 사용자 ID: {current_user.id}")
    
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
    
    print(f"✅ 채팅방 정보 조회 완료 - room_id={room.id}, name={room.name}, type={room.type}")
    
    return {
        "room_id": room.id,
        "name": room.name,
        "type": room.type,
        "description": room.description
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
        
        # 사용자가 나간 시간 기록
        leave_record = UserRoomLeaveTime(
            user_id=current_user.id,
            room_id=room_id,
            leave_time=datetime.utcnow()
        )
        db.merge(leave_record)  # INSERT OR UPDATE
        
        db.commit()
        print(f"✅ 1:1 채팅방 나가기 완료 - 사용자 {current_user.id}, room_id={room_id}, 나간 시간 기록됨")
        
        return {"message": "채팅방을 나갔습니다", "leave_time": leave_record.leave_time.isoformat()}
    
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

# 사용자 채팅방 나간 시간 조회 API
@router.get("/rooms/{room_id}/user-leave-time")
def get_user_leave_time(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자가 특정 채팅방을 나간 시간을 조회합니다."""
    print(f"🔍 사용자 나간 시간 조회 - Room ID: {room_id}, 사용자 ID: {current_user.id}")
    
    # Room 존재 확인
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다")
    
    # 사용자의 나간 시간 기록 조회
    leave_record = db.query(UserRoomLeaveTime).filter(
        UserRoomLeaveTime.user_id == current_user.id,
        UserRoomLeaveTime.room_id == room_id
    ).first()
    
    if leave_record:
        print(f"✅ 사용자 나간 시간 발견: {leave_record.leave_time}")
        return {"leave_time": leave_record.leave_time.isoformat()}
    else:
        print(f"ℹ️ 사용자 나간 시간 기록 없음")
        return {"leave_time": None}