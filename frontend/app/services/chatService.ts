import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatRoom, ChatMessage } from './websocketService';

const API_BASE_URL = 'https://camsaw.kro.kr';

class ChatService {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('access_token');
    console.log('ChatService - 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    if (token) {
      console.log('ChatService - 토큰 일부:', token.substring(0, 20) + '...');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 채팅방 목록 조회
  async getChatRooms(): Promise<ChatRoom[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('채팅방 목록 조회 실패:', error);
      throw error;
    }
  }

  // 채팅방 생성
  async createChatRoom(type: 'dm' | 'group', members: number[], name?: string): Promise<ChatRoom> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/chat/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type,
          members,
          name,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
      throw error;
    }
  }

  // 채팅방 메시지 조회
  async getChatMessages(roomId: number, cursor?: number, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor.toString());
      params.append('limit', limit.toString());

      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('채팅 메시지 조회 실패:', error);
      throw error;
    }
  }

  // 메시지 전송
  async sendMessage(roomId: number, content: string, clientMsgId?: string): Promise<ChatMessage> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: content,  // content를 text로 변경
          clientMsgId: clientMsgId,  // client_msg_id를 clientMsgId로 변경
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      throw error;
    }
  }

  // 푸시 토큰 등록
  async registerPushToken(expoPushToken: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/chat/push/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          expo_push_token: expoPushToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('푸시 토큰 등록 성공');
    } catch (error) {
      console.error('푸시 토큰 등록 실패:', error);
      throw error;
    }
  }

  // 1:1 채팅방 찾기 또는 생성 (새로운 Room 모델)
  async findOrCreateDirectChat(otherUserId: number): Promise<any> {
    try {
      console.log('🔍 1:1 채팅방 찾기/생성 시작 - 상대방 ID:', otherUserId);
      
      const headers = await this.getAuthHeaders();
      console.log('📡 1:1 채팅방 조회 요청 - URL:', `${API_BASE_URL}/chat/rooms/dm/new?target_user_id=${otherUserId}`);
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/dm/new?target_user_id=${otherUserId}`, {
        method: 'GET',
        headers,
      });

      console.log('📊 1:1 채팅방 조회 응답 - 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 1:1 채팅방 조회 실패 - 응답 내용:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 1:1 채팅방 조회 결과:', result);
      
      return result.room;
    } catch (error) {
      console.error('❌ 1:1 채팅방 찾기/생성 실패:', error);
      throw error;
    }
  }

  // 그룹 채팅방 메시지 조회 (새로운 Room 모델)
  async getGroupChatMessages(roomId: number, limit: number = 50): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('🔍 그룹 채팅방 메시지 조회 - Room ID:', roomId);
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages/new?limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('❌ 그룹 채팅방 메시지 조회 실패 - 상태:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 그룹 채팅방 메시지 조회 성공 - 메시지 수:', data.messages?.length || 0);
      return data;
    } catch (error) {
      console.error('❌ 그룹 채팅방 메시지 조회 실패:', error);
      throw error;
    }
  }

  // 그룹 채팅방 메시지 전송 (새로운 Room 모델)
  async sendGroupMessage(roomId: number, content: string): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('📤 그룹 채팅방 메시지 전송 - Room ID:', roomId, '내용:', content);
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages/new`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: content,
        }),
      });

      if (!response.ok) {
        console.error('❌ 그룹 채팅방 메시지 전송 실패 - 상태:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 그룹 채팅방 메시지 전송 성공 - 메시지 ID:', data.id);
      return data;
    } catch (error) {
      console.error('❌ 그룹 채팅방 메시지 전송 실패:', error);
      throw error;
    }
  }

  // 이미지 업로드 및 전송 (최대 10장)
  async sendImages(roomId: number, images: { uri: string; type?: string; base64?: string }[]): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      // base64로 변환해서 전송 (네이티브에서 FormData 문제 회피)
      const payload: any = { images: [] };
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        const img: any = images[i];
        if (img.base64) {
          payload.images.push({ content_type: img.type || 'image/jpeg', data_base64: img.base64 });
        } else {
          // 폴백: 일부 환경에서 base64가 없을 때만 네트워크로 읽기
          const res = await fetch(img.uri);
          const blob = await res.blob();
          // @ts-ignore
          const reader = new FileReader();
          const b64: string = await new Promise((resolve, reject) => {
            reader.onerror = () => reject(new Error('base64 변환 실패'));
            reader.onload = () => {
              const result = (reader.result as string) || '';
              const comma = result.indexOf(',');
              resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.readAsDataURL(blob);
          });
          payload.images.push({ content_type: img.type || blob.type || 'image/jpeg', data_base64: b64 });
        }
      }
      let response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/images`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const status = response.status;
        // 상태코드 전달을 위해 구조화된 에러를 던짐
        // 403/415/422 등인 경우 FormData 폴백 시도
        if (status === 403 || status === 415 || status === 422) {
          try {
            const token = await AsyncStorage.getItem('access_token');
            const form = new FormData();
            for (let i = 0; i < Math.min(images.length, 10); i++) {
              const img: any = images[i];
              // React Native 환경에서는 FormData에 파일을 추가할 때 아래와 같이 객체를 전달해야 함
              // 하지만 타입스크립트 타입과 웹 FormData와 달라서 lint 에러가 발생할 수 있음
              // 실제 네이티브 환경에서는 아래 방식이 동작함
              form.append(
                'files',
                {
                  uri: img.uri,
                  type: img.type || 'image/jpeg',
                  name: `image_${i}.jpg`,
                } as any
              );
            }
            response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/images`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                // Content-Type은 자동 설정되도록 비움 (boundary 포함)
              } as any,
              body: form as any,
            });
            if (!response.ok) {
              throw { __http: true, status: response.status, message: 'HTTP error (multipart fallback)', endpoint: `/chat/rooms/${roomId}/images` };
            }
          } catch (fallbackErr) {
            throw fallbackErr;
          }
        } else {
          throw { __http: true, status, message: `HTTP error`, endpoint: `/chat/rooms/${roomId}/images` };
        }
      }
      return await response.json();
    } catch (e) {
      console.error('❌ 이미지 전송 실패:', e);
      throw e;
    }
  }

  // 채팅방 참여자 목록 조회
  async getRoomParticipants(roomId: number): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('🔍 채팅방 참여자 목록 조회 - Room ID:', roomId);
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/participants`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('❌ 참여자 목록 조회 실패 - 상태:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 참여자 목록 조회 성공 - 참여자 수:', data.total_count);
      return data;
    } catch (error) {
      console.error('❌ 참여자 목록 조회 실패:', error);
      throw error;
    }
  }

  // 채팅방 나가기
  async leaveRoom(roomId: number): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('🚪 채팅방 나가기 - Room ID:', roomId);
      
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/leave`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        console.error('❌ 채팅방 나가기 실패 - 상태:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 채팅방 나가기 성공:', data.message);
      return data;
    } catch (error) {
      console.error('❌ 채팅방 나가기 실패:', error);
      throw error;
    }
  }

  // 방별 알림 설정 토글
  async toggleRoomNotifications(roomId: number, enabled: boolean): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('🔔 방 알림 토글 - Room ID:', roomId, 'enabled:', enabled);
      const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/notifications/toggle?enabled=${enabled}`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        console.error('❌ 방 알림 토글 실패 - 상태:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('✅ 방 알림 토글 성공:', data);
      return data;
    } catch (error) {
      console.error('❌ 방 알림 토글 실패:', error);
      throw error;
    }
  }

  // 방별 알림 설정 조회
  async getRoomNotifications(roomId: number): Promise<{ room_id: number; notifications_enabled: boolean }>{
    const headers = await this.getAuthHeaders();
    const resp = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/notifications`, {
      method: 'GET',
      headers,
    });
    if (!resp.ok) {
      if (resp.status === 404) {
        console.log('🔕 알림 설정 엔드포인트 404 - 기본값 true로 대체');
        return { room_id: roomId, notifications_enabled: true };
      }
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    return resp.json();
  }
}

// 싱글톤 인스턴스
export const chatService = new ChatService();
