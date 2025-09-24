import json
import asyncio
import redis.asyncio as redis
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
from sqlalchemy.orm import Session
from app.models.group_chat import Room, Membership, ChatMessage
from app.models.user import User
from app.services.fcm_service import send_fcm_to_user
from app.services.redis_service import redis_service
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # room_id -> set of WebSocket connections
        self.room_connections: Dict[int, Set[WebSocket]] = {}
        # user_id -> set of WebSocket connections  
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        # room_id -> set of user_ids (participants)
        self.room_participants: Dict[int, Set[int]] = {}
        # user_id -> set of room_ids
        self.user_rooms: Dict[int, Set[int]] = {}
        # WebSocket -> user_id mapping
        self.websocket_to_user: Dict[WebSocket, int] = {}
        # WebSocket -> room_id mapping
        self.websocket_to_room: Dict[WebSocket, int] = {}
        # Redis 연결
        self.redis_client: Optional[redis.Redis] = None
        # 락 (스레드 안전성)
        self.lock = asyncio.Lock()
        # 하트비트 태스크
        self.heartbeat_task: Optional[asyncio.Task] = None
        # Redis 태스크
        self.redis_task: Optional[asyncio.Task] = None

    async def initialize_redis(self):
        """Redis 연결 초기화"""
        try:
            await redis_service.initialize()
            print("✅ Redis 서비스 초기화 성공")
            
            # 채팅 메시지 채널 구독
            await redis_service.subscribe_to_channel("chat_messages", self._handle_redis_message)
            print("✅ 채팅 메시지 채널 구독 완료")
            
            # 백그라운드 메시지 수신 태스크 시작 (별도 태스크로 실행)
            self.redis_task = asyncio.create_task(redis_service.listen_for_messages())
            print("✅ Redis 메시지 수신 태스크 시작")
            
        except Exception as e:
            print(f"❌ Redis 초기화 실패: {e}")
            self.redis_client = None

    async def _handle_redis_message(self, data: Dict[str, Any]):
        """Redis에서 수신한 메시지 처리"""
        try:
            message_type = data.get("type")
            room_id = data.get("room_id")
            
            if not room_id:
                return
                
            # 해당 방의 모든 연결된 WebSocket에 메시지 전송
            if room_id in self.room_connections:
                message_json = json.dumps(data, ensure_ascii=False)
                disconnected_websockets = []
                
                for websocket in self.room_connections[room_id]:
                    try:
                        await websocket.send_text(message_json)
                    except Exception as e:
                        logger.error(f"❌ WebSocket 메시지 전송 실패: {e}")
                        disconnected_websockets.append(websocket)
                
                # 연결이 끊어진 WebSocket 정리
                for websocket in disconnected_websockets:
                    await self.disconnect(websocket)
                    
        except Exception as e:
            logger.error(f"❌ Redis 메시지 처리 실패: {e}")

    async def _redis_subscriber(self):
        """Redis Pub/Sub 구독자 (백그라운드 태스크) - 레거시"""
        if not self.redis_client:
            return
            
        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe("room:*")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await self._handle_redis_message(message)
                    
        except Exception as e:
            print(f"❌ Redis 구독자 오류: {e}")

    async def _handle_redis_message(self, message: dict):
        """Redis 메시지 처리"""
        try:
            channel = message["channel"]
            data = json.loads(message["data"])
            
            # room:{room_id} 채널에서 메시지 수신
            if channel.startswith("room:"):
                room_id = int(channel.split(":")[1])
                await self._broadcast_to_room_connections(room_id, data)
                
        except Exception as e:
            print(f"❌ Redis 메시지 처리 오류: {e}")

    async def _broadcast_to_room_connections(self, room_id: int, message_data: dict):
        """채팅방의 모든 연결에 메시지 브로드캐스트"""
        if room_id not in self.room_connections:
            return
            
        message_str = json.dumps(message_data)
        sender_id = message_data.get("sender_id")
        disconnected_websockets = []
        
        for websocket in list(self.room_connections[room_id]):
            try:
                # 발신자는 제외
                if sender_id and self.websocket_to_user.get(websocket) == sender_id:
                    continue
                    
                await websocket.send_text(message_str)
                
                # delivered 이벤트를 발신자에게 전송
                if sender_id:
                    await self._send_delivered_event(sender_id, message_data)
                    
            except Exception as e:
                print(f"❌ WebSocket 브로드캐스트 실패: {e}")
                disconnected_websockets.append(websocket)
        
        # 연결이 끊어진 WebSocket들 정리
        for websocket in disconnected_websockets:
            await self._remove_websocket(websocket)

    async def _send_delivered_event(self, sender_id: int, message_data: dict):
        """발신자에게 delivered 이벤트 전송"""
        if sender_id not in self.user_connections:
            return
            
        delivered_event = {
            "type": "delivered",
            "message_id": message_data.get("message_id"),
            "to_user_id": message_data.get("recipient_id"),
            "at": datetime.utcnow().isoformat()
        }
        
        message_str = json.dumps(delivered_event)
        await self.send_personal_message(message_str, sender_id)

    async def connect(self, websocket: WebSocket, user_id: int, room_id: int):
        """WebSocket 연결을 관리자에 추가"""
        # websocket.accept()는 이미 chat.py에서 호출됨
        
        async with self.lock:
            # 연결 정보 저장
            if room_id not in self.room_connections:
                self.room_connections[room_id] = set()
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            if room_id not in self.room_participants:
                self.room_participants[room_id] = set()
            if user_id not in self.user_rooms:
                self.user_rooms[user_id] = set()
                
            self.room_connections[room_id].add(websocket)
            self.user_connections[user_id].add(websocket)
            self.room_participants[room_id].add(user_id)
            self.user_rooms[user_id].add(room_id)
            self.websocket_to_user[websocket] = user_id
            self.websocket_to_room[websocket] = room_id
            
        print(f"✅ WebSocket 연결 추가 - 사용자: {user_id}, 채팅방: {room_id}")
        print(f"📊 현재 상태 - 채팅방 {room_id}: {len(self.room_connections[room_id])}개 연결, {len(self.room_participants[room_id])}명 참여자")

    async def disconnect(self, user_id: int):
        """사용자의 모든 WebSocket 연결 제거"""
        async with self.lock:
            if user_id in self.user_connections:
                # 해당 사용자의 모든 WebSocket 연결 제거
                for websocket in list(self.user_connections[user_id]):
                    await self._remove_websocket(websocket)
                del self.user_connections[user_id]
                
            # 사용자가 참여한 모든 채팅방에서 제거
            if user_id in self.user_rooms:
                for room_id in list(self.user_rooms[user_id]):
                    if room_id in self.room_participants:
                        self.room_participants[room_id].discard(user_id)
                        if not self.room_participants[room_id]:
                            del self.room_participants[room_id]
                del self.user_rooms[user_id]
                
        print(f"❌ 사용자 {user_id}의 모든 WebSocket 연결 제거됨")

    def is_user_in_room(self, user_id: int, room_id: int) -> bool:
        """사용자가 특정 채팅방에 WebSocket으로 연결되어 있는지 확인"""
        return (user_id in self.user_rooms and 
                room_id in self.user_rooms[user_id] and
                user_id in self.user_connections and
                len(self.user_connections[user_id]) > 0)

    async def _remove_websocket(self, websocket: WebSocket):
        """개별 WebSocket 연결 제거"""
        if websocket in self.websocket_to_user:
            user_id = self.websocket_to_user[websocket]
            room_id = self.websocket_to_room.get(websocket)
            
            # 연결 정보에서 제거
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
            if room_id and room_id in self.room_connections:
                self.room_connections[room_id].discard(websocket)
                
            # 매핑 정보 제거
            del self.websocket_to_user[websocket]
            if room_id:
                del self.websocket_to_room[websocket]

    async def join_room(self, user_id: int, room_id: int, db: Session) -> tuple[bool, str]:
        """사용자를 채팅방에 참여시킴"""
        try:
            # 채팅방 존재 확인
            room = db.query(Room).filter(Room.id == room_id, Room.status == "active").first()
            if not room:
                return False, f"채팅방 {room_id}이 존재하지 않습니다"
            
            # 멤버십 확인
            membership = db.query(Membership).filter(
                Membership.room_id == room_id,
                Membership.user_id == user_id,
                Membership.is_active == True
            ).first()
            
            if not membership:
                return False, f"사용자 {user_id}가 채팅방 {room_id}의 멤버가 아닙니다"
            
            # 참여자 목록에 추가
            async with self.lock:
                if room_id not in self.room_participants:
                    self.room_participants[room_id] = set()
                if user_id not in self.user_rooms:
                    self.user_rooms[user_id] = set()
                    
                self.room_participants[room_id].add(user_id)
                self.user_rooms[user_id].add(room_id)
            
            print(f"✅ 사용자 {user_id}가 채팅방 {room_id}에 참여함")
            return True, "참여 성공"
            
        except Exception as e:
            print(f"❌ 채팅방 참여 오류: {e}")
            return False, f"채팅방 참여 중 오류 발생: {str(e)}"

    async def send_personal_message(self, message: str, user_id: int) -> bool:
        """특정 사용자에게 메시지 전송"""
        if user_id not in self.user_connections:
            return False
            
        success_count = 0
        failed_connections = []
        
        for websocket in list(self.user_connections[user_id]):
            try:
                await websocket.send_text(message)
                success_count += 1
            except Exception as e:
                print(f"❌ 사용자 {user_id}에게 메시지 전송 실패: {e}")
                failed_connections.append(websocket)
        
        # 실패한 연결들 제거
        for websocket in failed_connections:
            await self._remove_websocket(websocket)
            
        return success_count > 0

    async def broadcast_to_room(self, room_id: int, message_data: dict, exclude_user: Optional[int] = None):
        """채팅방의 모든 참여자에게 메시지 브로드캐스트"""
        if room_id not in self.room_participants:
            return
        
        message_str = json.dumps(message_data)
        disconnected_users = []
        for user_id in self.room_participants[room_id]:
            if user_id == exclude_user:
                continue
            
            success = await self.send_personal_message(message_str, user_id)
            if not success:
                disconnected_users.append(user_id)
        
        # 연결이 끊어진 사용자들 정리
        for user_id in disconnected_users:
            await self.disconnect(user_id)

    async def publish_message(self, room_id: int, message_data: dict):
        """Redis를 통해 메시지 발행"""
        try:
            # Redis 서비스를 통한 메시지 발행
            await redis_service.publish_message("chat_messages", message_data)
            print(f"✅ Redis에 메시지 발행: room_id={room_id}")
        except Exception as e:
            print(f"❌ Redis 메시지 발행 실패: {e}")
            # Redis 실패 시 직접 브로드캐스트
            await self._broadcast_to_room_connections(room_id, message_data)

    async def start_heartbeat(self):
        """하트비트 태스크 시작"""
        if self.heartbeat_task:
            return
            
        async def heartbeat():
            while True:
                try:
                    await asyncio.sleep(25)  # 25초마다 핑
                    await self._ping_all_connections()
                except Exception as e:
                    print(f"❌ 하트비트 오류: {e}")
                    
        self.heartbeat_task = asyncio.create_task(heartbeat())
        print("✅ 하트비트 태스크 시작됨")

    async def _ping_all_connections(self):
        """모든 연결에 핑 전송"""
        ping_message = json.dumps({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
        
        for user_id in list(self.user_connections.keys()):
            await self.send_personal_message(ping_message, user_id)

    async def send_chat_notification(self, room_id: int, sender_id: int, content: str, db: Session):
        """오프라인 사용자들에게 채팅 알림 전송"""
        if room_id not in self.room_participants:
            return
        
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            return
        
        sender = db.query(User).filter(User.id == sender_id).first()
        if not sender:
            return
        
        # 채팅방 멤버 중 오프라인 사용자들에게 알림 전송
        memberships = db.query(Membership).filter(
            Membership.room_id == room_id,
            Membership.is_active == True
        ).all()
        
        for membership in memberships:
            member_id = membership.user_id
            if member_id == sender_id:  # 발신자 제외
                continue
            
            if member_id not in self.room_participants.get(room_id, set()):  # 오프라인 사용자
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
                    
                    send_fcm_to_user(db, member_id, title, body, data)
                    print(f"📱 사용자 {member_id}에게 채팅 알림 전송")
                except Exception as e:
                    print(f"❌ 사용자 {member_id}에게 알림 전송 실패: {e}")

    async def close(self):
        """연결 정리"""
        try:
            # 하트비트 태스크 정리
            if self.heartbeat_task:
                self.heartbeat_task.cancel()
                try:
                    await self.heartbeat_task
                except asyncio.CancelledError:
                    pass
                self.heartbeat_task = None
            
            # Redis 태스크 정리
            if self.redis_task:
                self.redis_task.cancel()
                try:
                    await self.redis_task
                except asyncio.CancelledError:
                    pass
                self.redis_task = None
            
            # Redis 연결 종료
            if self.redis_client:
                self.redis_client.close()
                
        except Exception as e:
            print(f"❌ 연결 정리 실패: {e}")

# 전역 연결 관리자 인스턴스
manager = ConnectionManager()