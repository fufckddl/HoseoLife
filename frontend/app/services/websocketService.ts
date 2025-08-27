import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket 메시지 타입
export interface WSMessage {
  type: 'join' | 'leave' | 'message' | 'typing' | 'read_receipt' | 'pong';
  room_id?: number;
  user_id?: number;
  content?: string;
  client_msg_id?: string;
  sent_at?: string;
  is_typing?: boolean;
  message_id?: number;
}

// 채팅 메시지 타입
export interface ChatMessage {
  id: number;
  room_id: number;
  sender_id: number | null; // 시스템 메시지는 sender_id가 null일 수 있음
  content: string;
  client_msg_id?: string;
  sent_at: string;
  is_deleted: boolean;
}

// 채팅방 타입
export interface ChatRoom {
  id: number;
  name?: string;
  type: 'dm' | 'group';
  created_by: number;
  created_at: string;
  is_active: boolean;
  members: number[];
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1초
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WSMessage[] = [];
  private isConnecting = false;
  private userId: number | null = null;
  private token: string | null = null;
  
  // 이벤트 리스너들
  private messageListeners: ((message: ChatMessage) => void)[] = [];
  private typingListeners: ((roomId: number, userId: number, isTyping: boolean) => void)[] = [];
  private readReceiptListeners: ((roomId: number, userId: number, messageId: number) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];

  // 연결 상태
  private connected = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const userIdStr = await AsyncStorage.getItem('user_id');
      const token = await AsyncStorage.getItem('access_token');
      
      console.log('WebSocket 초기화 - 저장된 user_id:', userIdStr);
      console.log('WebSocket 초기화 - 저장된 token:', token ? '토큰 있음' : '토큰 없음');
      
      this.userId = userIdStr ? parseInt(userIdStr) : null;
      this.token = token;
      
      console.log('WebSocket 초기화 완료 - userId:', this.userId, 'token:', this.token ? '있음' : '없음');
    } catch (error) {
      console.error('WebSocket 초기화 실패:', error);
    }
  }

  // 연결
  async connect(): Promise<boolean> {
    if (this.isConnecting || this.connected) {
      return this.connected;
    }

    this.isConnecting = true;

    try {
      await this.initialize();
      
      if (!this.userId || !this.token) {
        console.error('사용자 ID 또는 토큰이 없습니다');
        this.isConnecting = false;
        return false;
      }

      const wsUrl = `${process.env.EXPO_PUBLIC_WS_URL || 'wss://camsaw.kro.kr'}/chat/ws/${this.userId}?token=${this.token}`;
      console.log('WebSocket 연결 시도:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공');
        this.connected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.flushMessageQueue();
        this.notifyConnectionListeners(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('❌ WebSocket 연결 종료:', event.code, event.reason);
        this.connected = false;
        this.isConnecting = false;
        this.stopPingInterval();
        this.notifyConnectionListeners(false);
        
        // 자동 재연결
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        this.isConnecting = false;
      };

      return true;
    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
      this.isConnecting = false;
      return false;
    }
  }

  // 연결 해제
  disconnect() {
    console.log('WebSocket 연결 해제');
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.notifyConnectionListeners(false);
  }

  // 재연결 스케줄링
  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect();
      }
    }, delay);
  }

  // Ping/Pong
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.connected && this.ws) {
        this.send({
          type: 'pong'
        });
      }
    }, 30000); // 30초마다 ping
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 메시지 전송
  send(message: WSMessage): boolean {
    if (!this.connected || !this.ws) {
      // 연결이 안 되어 있으면 큐에 저장
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  // 메시지 큐 플러시
  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // 메시지 처리
  private handleMessage(data: any) {
    switch (data.type) {
      case 'message':
        this.notifyMessageListeners(data);
        break;
      case 'typing':
        this.notifyTypingListeners(data.room_id, data.user_id, data.is_typing);
        break;
      case 'read_receipt':
        this.notifyReadReceiptListeners(data.room_id, data.user_id, data.message_id);
        break;
      case 'join_response':
      case 'leave_response':
        console.log('방 참여/나가기 응답:', data);
        break;
      default:
        console.log('알 수 없는 메시지 타입:', data.type);
    }
  }

  // 채팅방 참여
  joinRoom(roomId: number): boolean {
    return this.send({
      type: 'join',
      room_id: roomId
    });
  }

  // 채팅방 나가기
  leaveRoom(roomId: number): boolean {
    return this.send({
      type: 'leave',
      room_id: roomId
    });
  }

  // 타이핑 상태 전송
  sendTyping(roomId: number, isTyping: boolean): boolean {
    return this.send({
      type: 'typing',
      room_id: roomId,
      is_typing: isTyping
    });
  }

  // 읽음 확인 전송
  sendReadReceipt(roomId: number, messageId: number): boolean {
    return this.send({
      type: 'read_receipt',
      room_id: roomId,
      message_id: messageId
    });
  }

  // 이벤트 리스너 등록
  onMessage(callback: (message: ChatMessage) => void) {
    this.messageListeners.push(callback);
  }

  onTyping(callback: (roomId: number, userId: number, isTyping: boolean) => void) {
    this.typingListeners.push(callback);
  }

  onReadReceipt(callback: (roomId: number, userId: number, messageId: number) => void) {
    this.readReceiptListeners.push(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  // 이벤트 리스너 제거
  removeMessageListener(callback: (message: ChatMessage) => void) {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  removeTypingListener(callback: (roomId: number, userId: number, isTyping: boolean) => void) {
    this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
  }

  removeReadReceiptListener(callback: (roomId: number, userId: number, messageId: number) => void) {
    this.readReceiptListeners = this.readReceiptListeners.filter(cb => cb !== callback);
  }

  removeConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
  }

  // 이벤트 알림
  private notifyMessageListeners(message: ChatMessage) {
    this.messageListeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('메시지 리스너 오류:', error);
      }
    });
  }

  private notifyTypingListeners(roomId: number, userId: number, isTyping: boolean) {
    this.typingListeners.forEach(callback => {
      try {
        callback(roomId, userId, isTyping);
      } catch (error) {
        console.error('타이핑 리스너 오류:', error);
      }
    });
  }

  private notifyReadReceiptListeners(roomId: number, userId: number, messageId: number) {
    this.readReceiptListeners.forEach(callback => {
      try {
        callback(roomId, userId, messageId);
      } catch (error) {
        console.error('읽음 확인 리스너 오류:', error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('연결 상태 리스너 오류:', error);
      }
    });
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.connected;
  }
}

// 싱글톤 인스턴스
export const websocketService = new WebSocketService();
