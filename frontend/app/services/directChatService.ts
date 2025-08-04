// API 기본 URL
const API_BASE_URL = 'http://your-server-ip:5000';

export interface DirectMessageData {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_nickname: string;
  sender_profile_image_url?: string;
  receiver_nickname: string;
  receiver_profile_image_url?: string;
}

export interface DirectChatData {
  other_user_id: number;
  other_user_nickname: string;
  other_user_profile_image_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
}

class DirectChatService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async getToken(): Promise<string> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('인증 토큰이 없습니다.');
    }
    return token;
  }

  // 1:1 채팅 대화 목록 조회
  async getDirectConversations(): Promise<DirectChatData[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/direct-chat/conversations`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('1:1 채팅 대화 목록 조회 실패:', errorText);
        throw new Error('1:1 채팅 대화 목록을 가져오는데 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('1:1 채팅 대화 목록 조회 오류:', error);
      throw error;
    }
  }

  // 특정 사용자와의 1:1 메시지 조회
  async getDirectMessages(otherUserId: number, skip: number = 0, limit: number = 50): Promise<DirectMessageData[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/direct-chat/conversations/${otherUserId}/messages?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('1:1 메시지 조회 실패:', errorText);
        throw new Error('1:1 메시지를 가져오는데 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('1:1 메시지 조회 오류:', error);
      throw error;
    }
  }

  // 1:1 메시지 전송
  async sendDirectMessage(otherUserId: number, content: string): Promise<DirectMessageData> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/direct-chat/conversations/${otherUserId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('1:1 메시지 전송 실패:', errorText);
        throw new Error('1:1 메시지 전송에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('1:1 메시지 전송 오류:', error);
      throw error;
    }
  }
}

export const directChatService = new DirectChatService(); 