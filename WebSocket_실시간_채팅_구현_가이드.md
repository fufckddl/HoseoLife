# WebSocket 실시간 채팅 구현 가이드

## 📋 개요
FastAPI + React Native를 사용한 실시간 채팅 시스템 구현 방법

## 🏗️ 아키텍처

### 백엔드 (FastAPI)
- **WebSocket 엔드포인트**: `/chat/ws/{room_id}?token={jwt_token}`
- **메시지 전송 API**: `POST /chat/rooms/{room_id}/messages/new`
- **WebSocket 매니저**: 연결 관리 및 메시지 브로드캐스트
- **Redis**: 메시지 큐 및 Pub/Sub (선택사항)

### 프론트엔드 (React Native)
- **WebSocket 서비스**: 연결 관리 및 메시지 송수신
- **채팅방 컴포넌트**: 실시간 메시지 렌더링
- **낙관적 업데이트**: 사용자 경험 향상

## 🔧 핵심 구현 사항

### 1. WebSocket 연결 관리

#### 백엔드 (chat.py)
```python
@router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str = Query(...)):
    # 1. 토큰 검증
    payload = decode_token(token)
    user_id = int(payload.get("sub"))
    
    # 2. WebSocket 연결 수락 (한 번만!)
    await websocket.accept()
    
    # 3. 매니저에 연결 등록
    await manager.connect(websocket, user_id, room_id)
    
    # 4. 메시지 처리 루프
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # 메시지 타입별 처리
            if message_data.get("type") == "join":
                # 채팅방 참여 처리
            elif message_data.get("type") == "typing":
                # 타이핑 상태 브로드캐스트
            # ... 기타 메시지 타입들
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
```

#### 프론트엔드 (websocketService.ts)
```typescript
class WebSocketService {
  async connect(roomId: number): Promise<boolean> {
    const wsUrl = `wss://domain.com/chat/ws/${roomId}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.connected = true;
      this.notifyConnectionListeners(true);
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
  
  private handleMessage(data: any) {
    switch (data.type) {
      case 'connected':
        this.notifyConnectionListeners(true);
        break;
      case 'message':
        this.notifyMessageListeners(data);
        break;
      case 'typing':
        this.notifyTypingListeners(data.room_id, data.user_id, data.is_typing);
        break;
    }
  }
}
```

### 2. 메시지 전송 및 브로드캐스트

#### 백엔드 메시지 전송 (group_chat.py)
```python
async def send_room_message(room_id: int, message_data: dict, current_user: User, db: Session):
    # 1. 메시지 데이터베이스에 저장
    new_message = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        content=message_data["text"],
        message_type="text"
    )
    db.add(new_message)
    db.commit()
    
    # 2. WebSocket 메시지 구조 생성
    ws_message = {
        "type": "message",
        "room_id": room_id,
        "user_id": current_user.id,
        "message_id": new_message.id,
        "sender_id": new_message.sender_id,
        "content": new_message.content,
        "sent_at": new_message.sent_at.isoformat()
    }
    
    # 3. 온라인 사용자들에게 브로드캐스트
    await manager.broadcast_to_room(room_id, ws_message, exclude_user=current_user.id)
```

#### 프론트엔드 메시지 수신 (chat-room.tsx)
```typescript
const setupWebSocket = () => {
  websocketService.onMessage((message) => {
    // room_id 확인
    const messageRoomId = typeof message.room_id === 'string' ? 
      parseInt(message.room_id) : message.room_id;
    
    if (messageRoomId === roomId) {
      // 중복 메시지 확인
      const existingMessage = prev.find(msg => 
        msg.id === message.message_id || 
        msg.clientMsgId === message.client_msg_id
      );
      
      if (!existingMessage) {
        const newMessage = {
          id: message.message_id,
          room_id: roomId,
          sender_id: message.sender_id,
          content: message.content,
          sent_at: message.sent_at,
          isOptimistic: false,
          isSystemMessage: message.sender_id === null
        };
        
        setMessages(prev => [...prev, newMessage]);
      }
    }
  });
};
```

### 3. WebSocket 매니저 (websocket_manager.py)

```python
class ConnectionManager:
    def __init__(self):
        self.room_connections: Dict[int, Set[WebSocket]] = {}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.room_participants: Dict[int, Set[int]] = {}
        self.user_rooms: Dict[int, Set[int]] = {}
        self.websocket_to_user: Dict[WebSocket, int] = {}
        self.websocket_to_room: Dict[WebSocket, int] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int, room_id: int):
        # websocket.accept()는 이미 chat.py에서 호출됨
        async with self.lock:
            self.room_connections[room_id].add(websocket)
            self.user_connections[user_id].add(websocket)
            self.room_participants[room_id].add(user_id)
            self.user_rooms[user_id].add(room_id)
    
    async def broadcast_to_room(self, room_id: int, message_data: dict, exclude_user: Optional[int] = None):
        if room_id not in self.room_participants:
            return
        
        message_str = json.dumps(message_data)
        for user_id in self.room_participants[room_id]:
            if user_id == exclude_user:
                continue
            await self.send_personal_message(message_str, user_id)
```

## ⚠️ 주의사항 및 해결된 문제들

### 1. WebSocket 연결 수락 중복 호출 방지
```python
# ❌ 잘못된 방법
await websocket.accept()  # chat.py에서
await websocket.accept()  # websocket_manager.py에서 (오류!)

# ✅ 올바른 방법
await websocket.accept()  # chat.py에서만 한 번
# websocket_manager.py에서는 제거
```

### 2. WebSocket 메시지 구조 일치
```python
# 백엔드에서 보내는 메시지 구조
ws_message = {
    "type": "message",
    "room_id": room_id,
    "user_id": current_user.id,
    "message_id": new_message.id,  # 필수!
    "sender_id": new_message.sender_id,  # 필수!
    "content": new_message.content,
    "sent_at": new_message.sent_at.isoformat()
}
```

### 3. broadcast_to_room 매개변수 순서
```python
# ❌ 잘못된 순서
await manager.broadcast_to_room(message_data, room_id, exclude_user)

# ✅ 올바른 순서
await manager.broadcast_to_room(room_id, message_data, exclude_user)
```

### 4. 프론트엔드 응답 처리
```typescript
// ❌ 잘못된 방법
if (response.success) {
  // response.message.id 사용
}

// ✅ 올바른 방법
if (response && response.id) {
  // response.id 직접 사용
}
```

## 🔄 메시지 흐름

1. **사용자가 메시지 입력**
2. **프론트엔드에서 낙관적 업데이트** (즉시 UI에 표시)
3. **HTTP API로 메시지 전송** (안정성 우선)
4. **백엔드에서 데이터베이스 저장**
5. **WebSocket으로 다른 사용자들에게 브로드캐스트**
6. **프론트엔드에서 실시간 수신 및 렌더링**

## 🛠️ 디버깅 팁

### 백엔드 로깅
```python
print(f"📨 WebSocket 메시지 수신: {data}")
print(f"📨 파싱된 메시지: {message_data}")
print(f"🔍 메시지 room_id: {messageRoomId}, 현재 room_id: {roomId}")
```

### 프론트엔드 로깅
```typescript
console.log('📨 WebSocket 메시지 수신:', message);
console.log('📨 메시지 타입:', message.type);
console.log('📨 메시지 전체 구조:', JSON.stringify(message, null, 2));
```

## 📱 React Native 특별 고려사항

1. **WebSocket 연결 상태 관리**: 앱이 백그라운드로 갈 때 연결 해제
2. **메시지 중복 방지**: client_msg_id 사용
3. **낙관적 업데이트**: 사용자 경험 향상
4. **자동 스크롤**: 새 메시지 시 하단으로 스크롤

## 🔧 성능 최적화

1. **메시지 큐잉**: Redis 사용 (선택사항)
2. **연결 풀링**: WebSocket 연결 재사용
3. **메시지 압축**: 큰 메시지 압축 전송
4. **이미지 최적화**: Base64 인코딩 및 압축

이 가이드를 참고하여 안정적인 실시간 채팅 시스템을 구현하세요! 🚀
