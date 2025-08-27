import json
import asyncio
from typing import Dict, Set, List, Optional
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.models.chat import ChatRoom, ChatMessage
from app.models.user import User
from app.services.fcm_service import send_fcm_to_user
from datetime import datetime

class ConnectionManager:
    def __init__(self):
        # 사용자별 WebSocket 연결
        self.active_connections: Dict[int, WebSocket] = {}
        # 채팅방별 참여자
        self.room_participants: Dict[int, Set[int]] = {}
        # 사용자별 참여 중인 채팅방
        self.user_rooms: Dict[int, Set[int]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """사용자 WebSocket 연결"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_rooms[user_id] = set()
        print(f"✅ 사용자 {user_id} WebSocket 연결됨")
    
    def disconnect(self, user_id: int):
        """사용자 WebSocket 연결 해제"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        
        # 사용자가 참여 중인 모든 채팅방에서 제거
        if user_id in self.user_rooms:
            for room_id in self.user_rooms[user_id]:
                if room_id in self.room_participants:
                    self.room_participants[room_id].discard(user_id)
                    if not self.room_participants[room_id]:
                        del self.room_participants[room_id]
            del self.user_rooms[user_id]
        
        print(f"❌ 사용자 {user_id} WebSocket 연결 해제됨")
    
    async def join_room(self, user_id: int, room_id: int, db: Session):
        """사용자를 채팅방에 참여시킴"""
        # 채팅방 존재 확인
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id, ChatRoom.is_active == True).first()
        if not room:
            return False, "채팅방을 찾을 수 없습니다"
        
        # 사용자가 채팅방 멤버인지 확인
        if user_id not in [member.id for member in room.members]:
            return False, "채팅방 멤버가 아닙니다"
        
        # 채팅방 참여자 목록에 추가
        if room_id not in self.room_participants:
            self.room_participants[room_id] = set()
        self.room_participants[room_id].add(user_id)
        
        # 사용자 참여 채팅방 목록에 추가
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)
        
        print(f"✅ 사용자 {user_id}가 채팅방 {room_id}에 참여함")
        return True, "채팅방 참여 성공"
    
    async def leave_room(self, user_id: int, room_id: int):
        """사용자를 채팅방에서 나가게 함"""
        if room_id in self.room_participants:
            self.room_participants[room_id].discard(user_id)
            if not self.room_participants[room_id]:
                del self.room_participants[room_id]
        
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room_id)
        
        print(f"❌ 사용자 {user_id}가 채팅방 {room_id}에서 나감")
    
    def is_user_in_room(self, user_id: int, room_id: int) -> bool:
        """사용자가 특정 채팅방에 있는지 확인"""
        if room_id in self.room_participants:
            return user_id in self.room_participants[room_id]
        return False
    
    async def send_personal_message(self, message: str, user_id: int):
        """특정 사용자에게 메시지 전송"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
                return True
            except Exception as e:
                print(f"❌ 사용자 {user_id}에게 메시지 전송 실패: {e}")
                return False
        return False
    
    async def broadcast_to_room(self, message: str, room_id: int, exclude_user: Optional[int] = None):
        """채팅방의 모든 참여자에게 메시지 브로드캐스트"""
        if room_id not in self.room_participants:
            return
        
        disconnected_users = []
        for user_id in self.room_participants[room_id]:
            if user_id == exclude_user:
                continue
            
            success = await self.send_personal_message(message, user_id)
            if not success:
                disconnected_users.append(user_id)
        
        # 연결이 끊어진 사용자들 정리
        for user_id in disconnected_users:
            self.disconnect(user_id)
    
    async def send_chat_notification(self, room_id: int, sender_id: int, content: str, db: Session):
        """오프라인 사용자들에게 채팅 알림 전송"""
        if room_id not in self.room_participants:
            return
        
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
        if not room:
            return
        
        sender = db.query(User).filter(User.id == sender_id).first()
        if not sender:
            return
        
        # 채팅방 멤버 중 오프라인 사용자들에게 알림 전송
        for member in room.members:
            if member.id == sender_id:  # 발신자 제외
                continue
            
            if member.id not in self.room_participants.get(room_id, set()):  # 오프라인 사용자
                try:
                    room_name = room.name if room.name else f"{sender.nickname}님과의 대화"
                    title = f"새로운 메시지"
                    body = f"{sender.nickname}: {content[:50]}{'...' if len(content) > 50 else ''}"
                    
                    data = {
                        "type": "chat_message",
                        "room_id": str(room_id),
                        "room_type": room.type,
                        "sender_id": str(sender_id),
                        "sender_nickname": sender.nickname
                    }
                    
                    send_fcm_to_user(db, member.id, title, body, data)
                    print(f"📱 사용자 {member.id}에게 채팅 알림 전송")
                except Exception as e:
                    print(f"❌ 사용자 {member.id}에게 알림 전송 실패: {e}")

# 전역 인스턴스
manager = ConnectionManager()
