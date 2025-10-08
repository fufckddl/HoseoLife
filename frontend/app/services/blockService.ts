import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface BlockedUser {
  id: number;
  blocker_id: number;
  blocked_id: number;
  blocked_user_nickname: string;
  blocked_user_profile_image: string | null;
  created_at: string;
}

class BlockService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // 사용자 차단
  async blockUser(blockedUserId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/blocks/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ blocked_user_id: blockedUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '사용자 차단에 실패했습니다.');
      }

      console.log('✅ 사용자 차단 성공:', blockedUserId);
    } catch (error) {
      console.error('사용자 차단 오류:', error);
      throw error;
    }
  }

  // 차단 해제
  async unblockUser(blockedUserId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/blocks/${blockedUserId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '차단 해제에 실패했습니다.');
      }

      console.log('✅ 차단 해제 성공:', blockedUserId);
    } catch (error) {
      console.error('차단 해제 오류:', error);
      throw error;
    }
  }

  // 내가 차단한 사용자 목록
  async getMyBlocks(): Promise<BlockedUser[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/blocks/my-blocks`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('차단 목록 조회 오류:', error);
      throw error;
    }
  }

  // 특정 사용자를 차단했는지 확인
  async checkBlockStatus(userId: number): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/blocks/check/${userId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.is_blocked;
    } catch (error) {
      console.error('차단 상태 확인 오류:', error);
      return false;
    }
  }
}

export const blockService = new BlockService();

