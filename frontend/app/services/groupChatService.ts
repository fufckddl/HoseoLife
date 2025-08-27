// 그룹 채팅 관련 API 서비스
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupRequest, AvailableGroup, MyRooms } from '../stores/groupStore';

const API_BASE_URL = 'https://camsaw.kro.kr';

class GroupChatService {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 그룹 생성 요청
  async createGroupRequest(name: string, description?: string): Promise<GroupRequest> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/groups/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '그룹 생성 요청에 실패했습니다');
    }

    return response.json();
  }

  // 대기 중인 그룹 요청 목록 조회 (관리자 전용)
  async fetchPendingGroupRequests(): Promise<GroupRequest[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/admin/groups/pending`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '요청 목록 조회에 실패했습니다');
    }

    return response.json();
  }

  // 그룹 요청 승인 (관리자 전용)
  async approveGroupRequest(id: number): Promise<{ roomId: number; status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/admin/groups/${id}/approve`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '그룹 승인에 실패했습니다');
    }

    return response.json();
  }

  // 그룹 요청 거부 (관리자 전용)
  async rejectGroupRequest(id: number): Promise<{ status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/admin/groups/${id}/reject`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '그룹 거부에 실패했습니다');
    }

    return response.json();
  }

  // 참여 가능한 그룹 목록 조회
  async fetchAvailableGroups(): Promise<AvailableGroup[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/rooms/available?type=group`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '그룹 목록 조회에 실패했습니다');
    }

    return response.json();
  }

  // 그룹 참여
  async joinGroup(roomId: number): Promise<{ joined: boolean }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/join`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '그룹 참여에 실패했습니다');
    }

    return response.json();
  }

  // 내 채팅방 목록 조회 (DM/그룹 분리)
  async fetchMyRooms(): Promise<MyRooms> {
    const headers = await this.getAuthHeaders();
    console.log('🔄 fetchMyRooms API 요청 시작');
    console.log('📡 URL:', `${API_BASE_URL}/chat/my-rooms`);
    
    const response = await fetch(`${API_BASE_URL}/chat/my-rooms`, {
      method: 'GET',
      headers,
    });

    console.log('📊 응답 상태:', response.status);
    console.log('📊 응답 헤더:', response.headers);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API 오류:', errorData);
      throw new Error(errorData.detail || '채팅방 목록 조회에 실패했습니다');
    }

    const data = await response.json();
    console.log('📊 API 응답 데이터:', data);
    console.log('👥 그룹 수:', data?.groups?.length || 0);
    console.log('💬 DM 수:', data?.dms?.length || 0);
    
    return data;
  }
}

export const groupChatService = new GroupChatService();
