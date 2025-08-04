import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://your-server-ip:5000';

// 타입 정의
export interface ChatRoomData {
  id: number;
  title: string;
  purpose: string;
  created_by: number;
  created_at: string;
  is_active: boolean;
  is_approved: boolean;
  approved_by?: number;
  approved_at?: string;
  creator_nickname: string;
  creator_profile_image_url?: string;  // 생성자 프로필 이미지 URL
  member_count: number;
  last_message?: string;
  last_message_time?: string;
}

export interface ChatRoomDetailData {
  id: number;
  title: string;
  purpose: string;
  created_by: number;
  created_at: string;
  is_active: boolean;
  is_approved: boolean;
  approved_by?: number;
  approved_at?: string;
  creator_nickname: string;
  creator_profile_image_url?: string;  // 생성자 프로필 이미지 URL
  members: Array<{
    id: number;
    nickname: string;
    joined_at: string;
  }>;
}

export interface ChatMessageData {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  sender_nickname: string;
  sender_profile_image_url?: string;  // 발신자 프로필 이미지 URL
}

export interface ChatRoomListData {
  pending_rooms: ChatRoomData[];
  approved_rooms: ChatRoomData[];
  total_pending: number;
  total_approved: number;
}

export interface CreateChatRoomData {
  title: string;
  purpose: string;
}

export interface SendMessageData {
  content: string;
}

export interface ApprovalData {
  is_approved: boolean;
  admin_response?: string;
}

class ChatService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    console.log('ChatService - 토큰:', token ? '존재함' : '없음');
    
    if (!token) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 채팅방 생성 요청
  async createChatRoom(data: CreateChatRoomData): Promise<ChatRoomData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('채팅방 생성 API 오류 응답:', errorText);
        throw new Error('채팅방 생성에 실패했습니다.');
      }

      const result = await response.json();
      console.log('채팅방 생성 응답:', result);
      return result;
    } catch (error) {
      console.error('채팅방 생성 오류:', error);
      throw error;
    }
  }

  // 사용자의 채팅방 목록 조회
  async getUserChatRooms(skip: number = 0, limit: number = 20): Promise<ChatRoomListData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('채팅방 목록 API 오류 응답:', errorText);
        throw new Error('채팅방 목록 조회에 실패했습니다.');
      }

      const result = await response.json();
      console.log('채팅방 목록 응답:', result);
      return result;
    } catch (error) {
      console.error('채팅방 목록 조회 오류:', error);
      throw error;
    }
  }

  // 채팅방 상세 정보 조회
  async getChatRoomDetail(roomId: number): Promise<ChatRoomDetailData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('채팅방 상세 API 오류 응답:', errorText);
        throw new Error('채팅방 상세 정보 조회에 실패했습니다.');
      }

      const result = await response.json();
      console.log('채팅방 상세 응답:', result);
      return result;
    } catch (error) {
      console.error('채팅방 상세 조회 오류:', error);
      throw error;
    }
  }

  // 채팅방 메시지 목록 조회
  async getChatMessages(roomId: number, skip: number = 0, limit: number = 50): Promise<ChatMessageData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('메시지 목록 API 오류 응답:', errorText);
        throw new Error('메시지 목록 조회에 실패했습니다.');
      }

      const result = await response.json();
      console.log('메시지 목록 응답:', result);
      return result;
    } catch (error) {
      console.error('메시지 목록 조회 오류:', error);
      throw error;
    }
  }

  // 메시지 전송
  async sendMessage(roomId: number, data: SendMessageData): Promise<ChatMessageData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('메시지 전송 API 오류 응답:', errorText);
        throw new Error('메시지 전송에 실패했습니다.');
      }

      const result = await response.json();
      console.log('메시지 전송 응답:', result);
      return result;
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      throw error;
    }
  }

  // 관리자용 채팅방 승인/거부
  async approveChatRoom(roomId: number, data: ApprovalData): Promise<ChatRoomData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/approve`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('채팅방 승인 API 오류 응답:', errorText);
        throw new Error('채팅방 승인 처리에 실패했습니다.');
      }

      const result = await response.json();
      console.log('채팅방 승인 응답:', result);
      return result;
    } catch (error) {
      console.error('채팅방 승인 오류:', error);
      throw error;
    }
  }

  // 전체 채팅방 목록 조회
  async getAllChatRooms(skip: number = 0, limit: number = 20): Promise<ChatRoomData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/all?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('전체 채팅방 목록 API 오류 응답:', errorText);
        throw new Error('전체 채팅방 목록 조회에 실패했습니다.');
      }

      const result = await response.json();
      console.log('전체 채팅방 목록 응답:', result);
      return result;
    } catch (error) {
      console.error('전체 채팅방 목록 조회 오류:', error);
      throw error;
    }
  }

  // 채팅방 참여
  async joinChatRoom(roomId: number): Promise<ChatRoomData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/join`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('채팅방 참여 API 오류 응답:', errorText);
        throw new Error('채팅방 참여에 실패했습니다.');
      }

      const result = await response.json();
      console.log('채팅방 참여 응답:', result);
      return result;
    } catch (error) {
      console.error('채팅방 참여 오류:', error);
      throw error;
    }
  }

  // 관리자용 대기 중인 채팅방 목록 조회
  async getPendingChatRooms(skip: number = 0, limit: number = 20): Promise<ChatRoomData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/chat/admin/pending?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('대기 중인 채팅방 목록 API 오류 응답:', errorText);
        throw new Error('대기 중인 채팅방 목록 조회에 실패했습니다.');
      }

      const result = await response.json();
      console.log('대기 중인 채팅방 목록 응답:', result);
      return result;
    } catch (error) {
      console.error('대기 중인 채팅방 목록 조회 오류:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService(); 