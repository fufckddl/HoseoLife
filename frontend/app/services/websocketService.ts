import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket 메시지 타입 (새로운 이벤트 스펙)
export interface WSMessage {
  type: 'join' | 'leave' | 'message' | 'read' | 'typing' | 'connected' | 'history' | 'ack' | 'delivered' | 'error' | 'ping' | 'pong' | 'read_receipt';
  room_id?: number;
  user_id?: number;
  content?: string;
  client_msg_id?: string;
  sent_at?: string;
  is_typing?: boolean;
  message_id?: number;
  timestamp?: number;
  data?: any;
  error?: string;
}

// 채팅 메시지 타입 (WebSocket 메시지도 포함)
export interface ChatMessage {
  id: number;
  room_id: number;
  sender_id: number | null; // 시스템 메시지는 sender_id가 null일 수 있음
  content: string;
  client_msg_id?: string;
  sent_at: string;
  is_deleted: boolean;
  // WebSocket 메시지에서 추가로 받을 수 있는 필드들
  type?: string;
  message_id?: number;
  image_urls?: string[]; // 이미지 URL 배열
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
  private lastRoomId: number | null = null;
  
  // 이벤트 리스너들
  private messageListeners: ((message: ChatMessage) => void)[] = [];
  private typingListeners: ((roomId: number, userId: number, isTyping: boolean) => void)[] = [];
  private readReceiptListeners: ((roomId: number, userId: number, messageId: number) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private historyListeners: ((messages: ChatMessage[]) => void)[] = [];
  private ackListeners: ((data: any) => void)[] = [];
  private deliveredListeners: ((data: any) => void)[] = [];
  private errorListeners: ((error: string) => void)[] = [];

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

  // 연결 (room_id 기반)
  async connect(roomId: number): Promise<boolean> {
    if (this.isConnecting || this.connected) {
      return this.connected;
    }

    this.isConnecting = true;
    this.lastRoomId = roomId; // 마지막 연결된 roomId 저장
    
    try {
      await this.initialize();
      
      if (!this.userId || !this.token) {
        console.error('사용자 ID 또는 토큰이 없습니다');
        this.isConnecting = false;
        return false;
      }

      // 새로운 스펙: /ws/{room_id}?token={token}
      const wsUrl = `${process.env.EXPO_PUBLIC_WS_URL || 'wss://hoseolife.kro.kr'}/chat/ws/${roomId}?token=${this.token}`;
      console.log('🔌 WebSocket 연결 시도:', {
        url: wsUrl,
        roomId: roomId,
        userId: this.userId,
        tokenLength: this.token?.length || 0,
        tokenPreview: this.token?.substring(0, 10) + '...' || 'None'
      });

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공');
        console.log('WebSocket 상태:', this.ws?.readyState);
        console.log('WebSocket URL:', wsUrl);
        this.connected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.flushMessageQueue();
        this.notifyConnectionListeners(true);
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('📨 WebSocket 원시 메시지 수신:', event.data);
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket 파싱된 메시지:', data);
          this.handleMessage(data);
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('❌ WebSocket 연결 종료:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: wsUrl
        });
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
        console.error('❌ WebSocket 오류:', {
          error,
          url: wsUrl,
          readyState: this.ws?.readyState,
          userId: this.userId,
          errorEvent: error
        });
        this.isConnecting = false;
        this.connected = false;
        this.notifyConnectionListeners(false);
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
        // 재연결 시도 (roomId는 마지막 연결된 roomId 사용)
        this.connect(this.lastRoomId || 1);
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
    console.log('📤 WebSocket 메시지 전송 시도:', message);
    console.log('연결 상태:', this.connected, 'WebSocket 상태:', this.ws?.readyState);
    
    if (!this.connected || !this.ws) {
      console.log('❌ WebSocket 연결되지 않음, 메시지 큐에 저장');
      // 연결이 안 되어 있으면 큐에 저장
      this.messageQueue.push(message);
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      console.log('📤 전송할 메시지:', messageStr);
      this.ws.send(messageStr);
      console.log('✅ 메시지 전송 성공');
      return true;
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
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

  // 메시지 처리 (새로운 이벤트 스펙)
  private handleMessage(data: any) {
    console.log('🔍 WebSocket 메시지 처리:', data.type, data);
    
    switch (data.type) {
      case 'connected':
        console.log('✅ WebSocket 연결 확인됨:', data);
        this.connected = true;
        this.isConnecting = false;
        this.notifyConnectionListeners(true);
        break;
        
      case 'history':
        console.log('📚 채팅 히스토리 수신:', data);
        if (data.data && Array.isArray(data.data)) {
          this.notifyHistoryListeners(data.data);
        }
        break;
        
      case 'message':
        console.log('📨 실시간 메시지 수신:', data);
        // WebSocket 메시지를 ChatMessage 형식으로 변환
        const chatMessage: ChatMessage = {
          id: data.message_id || data.id || 0,
          room_id: data.room_id || 0,
          sender_id: data.sender_id || data.user_id || null,
          content: data.content || '',
          sent_at: data.sent_at || new Date().toISOString(),
          is_deleted: false,
          type: data.type,
          message_id: data.message_id,
          image_urls: data.image_urls || []
        };
        console.log('📨 변환된 채팅 메시지:', chatMessage);
        this.notifyMessageListeners(chatMessage);
        break;
        
      case 'ack':
        console.log('✅ 메시지 전송 확인:', data);
        this.notifyAckListeners(data);
        break;
        
      case 'delivered':
        console.log('📬 메시지 전달 확인:', data);
        this.notifyDeliveredListeners(data);
        break;
        
      case 'typing':
        console.log('⌨️ 타이핑 상태:', data);
        this.notifyTypingListeners(data.room_id, data.user_id, data.is_typing);
        break;
        
      case 'read':
        console.log('👁️ 읽음 확인:', data);
        this.notifyReadReceiptListeners(data.room_id, data.user_id, data.message_id);
        break;
        
      case 'error':
        console.error('❌ WebSocket 오류:', data.error);
        this.notifyErrorListeners(data.error);
        break;
        
      case 'message_sent':
        console.log('✅ 메시지 전송 확인:', data);
        // 메시지가 성공적으로 전송되었음을 알림
        break;
        
      case 'message_error':
        console.log('❌ 메시지 전송 오류:', data.error);
        // 메시지 전송 실패 알림
        break;
        
      case 'pong':
        console.log('🏓 Pong 수신:', data.timestamp);
        // Ping/Pong 연결 유지 확인
        break;
        
      default:
        console.log('❓ 알 수 없는 메시지 타입:', data.type, data);
        // 알 수 없는 타입이지만 메시지로 보이는 경우 처리
        if (data.content && data.room_id) {
          console.log('📨 알 수 없는 타입을 메시지로 처리');
          this.notifyMessageListeners(data);
        }
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

  // 메시지 전송
  sendMessage(roomId: number, content: string): boolean {
    return this.send({
      type: 'message',
      room_id: roomId,
      content: content
    });
  }

  // Ping 전송 (연결 유지)
  sendPing(): boolean {
    return this.send({
      type: 'ping',
      timestamp: Date.now()
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

  onHistory(callback: (messages: ChatMessage[]) => void) {
    this.historyListeners.push(callback);
  }

  onAck(callback: (data: any) => void) {
    this.ackListeners.push(callback);
  }

  onDelivered(callback: (data: any) => void) {
    this.deliveredListeners.push(callback);
  }

  onError(callback: (error: string) => void) {
    this.errorListeners.push(callback);
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
    console.log('📨 메시지 리스너들에게 알림:', message);
    console.log('📨 리스너 수:', this.messageListeners.length);
    this.messageListeners.forEach((callback, index) => {
      try {
        console.log(`📨 리스너 ${index} 호출 중...`);
        callback(message);
        console.log(`📨 리스너 ${index} 호출 완료`);
      } catch (error) {
        console.error(`❌ 메시지 리스너 ${index} 오류:`, error);
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

  private notifyHistoryListeners(messages: ChatMessage[]) {
    this.historyListeners.forEach(callback => {
      try {
        callback(messages);
      } catch (error) {
        console.error('히스토리 리스너 오류:', error);
      }
    });
  }

  private notifyAckListeners(data: any) {
    this.ackListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('ACK 리스너 오류:', error);
      }
    });
  }

  private notifyDeliveredListeners(data: any) {
    this.deliveredListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('전달 확인 리스너 오류:', error);
      }
    });
  }

  private notifyErrorListeners(error: string) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('오류 리스너 오류:', error);
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
