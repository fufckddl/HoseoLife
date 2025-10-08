// 그룹 채팅 관련 API 서비스
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupRequest, AvailableGroup, MyRooms } from '../stores/groupStore';

const API_BASE_URL = 'https://hoseolife.kro.kr';

class GroupChatService {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 그룹 생성 요청
  async createGroupRequest(name: string, description?: string, imageUrl?: string | null): Promise<GroupRequest> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/chat/groups/requests`;
    const body = JSON.stringify({ 
      name, 
      description,
      image_url: imageUrl  // 🆕 이미지 URL 추가
    });
    
    console.log('🔗 그룹 생성 요청:', {
      url,
      method: 'POST',
      headers,
      body
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      console.log('📊 응답 상태:', response.status);
      console.log('📊 응답 헤더:', response.headers);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ API 오류 응답:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '그룹 생성 요청에 실패했습니다');
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패:', parseError);
          throw new Error(`API 오류 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('✅ API 성공 응답:', responseText);
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ 성공 응답 JSON 파싱 실패:', parseError);
        throw new Error('서버 응답을 파싱할 수 없습니다');
      }
    } catch (error) {
      console.error('❌ 그룹 생성 요청 실패:', error);
      throw error;
    }
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
    const url = `${API_BASE_URL}/chat/rooms/available?type=group`;
    
    console.log('🔗 참여 가능한 그룹 조회:', {
      url,
      method: 'GET',
      headers
    });
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📊 응답 상태:', response.status);
      console.log('📊 응답 헤더:', response.headers);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ API 오류 응답:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '그룹 목록 조회에 실패했습니다');
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패:', parseError);
          throw new Error(`API 오류 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('✅ API 성공 응답:', responseText);
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ 성공 응답 JSON 파싱 실패:', parseError);
        throw new Error('서버 응답을 파싱할 수 없습니다');
      }
    } catch (error) {
      console.error('❌ 참여 가능한 그룹 조회 실패:', error);
      throw error;
    }
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
    
    // 🆕 lastMessageTime과 memberCount 매핑
    const processedData = {
      ...data,
      dms: data?.dms?.map((dm: any) => ({
        ...dm,
        lastMessageTime: dm.lastMessageTime || null
      })) || [],
      groups: data?.groups?.map((group: any) => ({
        ...group,
        lastMessageTime: group.lastMessageTime || null,
        memberCount: group.memberCount || 0  // 🆕 memberCount 매핑
      })) || []
    };
    
    console.log('📊 처리된 데이터:', processedData);
    
    return processedData;
  }

  // 채팅방 정보 조회
  async getRoomInfo(roomId: number): Promise<{ room_id: number; name: string; type: string; description?: string }> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/chat/rooms/${roomId}/info`;
    
    console.log('🔗 채팅방 정보 조회:', {
      url,
      method: 'GET',
      headers
    });
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📊 응답 상태:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ API 오류 응답:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '채팅방 정보 조회에 실패했습니다');
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패:', parseError);
          throw new Error(`API 오류 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('✅ API 성공 응답:', responseText);
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ 성공 응답 JSON 파싱 실패:', parseError);
        throw new Error('서버 응답을 파싱할 수 없습니다');
      }
    } catch (error) {
      console.error('❌ 채팅방 정보 조회 실패:', error);
      throw error;
    }
  }
}

export const groupChatService = new GroupChatService();
