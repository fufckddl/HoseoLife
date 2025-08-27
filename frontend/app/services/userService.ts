import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "https://camsaw.kro.kr";

export interface UserInfo {
  id: number;
  email: string;
  nickname: string;
  university: string;
  is_premium: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

class UserService {
  private async getAuthToken(): Promise<string | null> {
    try {
      let token = await AsyncStorage.getItem('access_token');
      console.log('UserService 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        // 잠시 대기 후 다시 시도
        await new Promise(resolve => setTimeout(resolve, 300));
        token = await AsyncStorage.getItem('access_token');
        console.log('UserService 토큰 재확인:', token ? '토큰 있음' : '토큰 없음');
      }
      
      return token;
    } catch (error) {
      console.error('토큰 가져오기 실패:', error);
      return null;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  // 현재 사용자 정보 조회
  async getCurrentUserInfo(): Promise<UserInfo | null> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 인증 실패 시 토큰 삭제
          await AsyncStorage.removeItem('access_token');
          throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || '사용자 정보 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      throw error;
    }
  }

  // 로그인
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      console.log('로그인 요청 시작:', email);
      
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('로그인 응답 상태:', response.status);
      console.log('로그인 응답 헤더:', response.headers);

      // 응답 텍스트를 먼저 확인
      const responseText = await response.text();
      console.log('로그인 응답 텍스트:', responseText);

      if (!response.ok) {
        // 상태코드 기반의 안전한 메시지로 치환 (HTML 본문 노출 금지)
        if (response.status === 401) {
          throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
        if (response.status >= 500) {
          throw new Error('서버 오류로 로그인에 실패했습니다. 잠시 후 다시 시도하세요.');
        }
        throw new Error('로그인에 실패했습니다.');
      }

      // 성공 응답 JSON 파싱
      let loginData;
      try {
        loginData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('성공 응답 JSON 파싱 실패:', parseError);
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }

      // 토큰 유효성 검사
      if (!loginData.access_token) {
        throw new Error('토큰이 응답에 포함되지 않았습니다.');
      }

      // 토큰 저장
      await AsyncStorage.setItem('access_token', loginData.access_token);
      console.log('토큰 저장 완료');
      
      return loginData;
    } catch (error) {
      console.error('로그인 오류:', error);
      throw error;
    }
  }

  // 회원가입
  async register(email: string, password: string, nickname: string, university: string): Promise<UserInfo> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password, 
          nickname, 
          university 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '회원가입에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('회원가입 오류:', error);
      throw error;
    }
  }

  // 로그아웃
  async logout(): Promise<void> {
    try {
      // 토큰 삭제
      await AsyncStorage.removeItem('access_token');
      console.log('로그아웃 완료: 토큰 삭제됨');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      throw error;
    }
  }

  // 프로필 업데이트
  async updateProfile(nickname?: string, university?: string): Promise<UserInfo> {
    try {
      const headers = await this.getAuthHeaders();
      
      const updateData: any = {};
      if (nickname) updateData.nickname = nickname;
      if (university) updateData.university = university;

      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '프로필 업데이트에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      throw error;
    }
  }

  // 토큰 유효성 확인
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return false;

      // 토큰이 있으면 서버에 유효성 확인 요청
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'GET',
        headers,
      });

      return response.ok;
    } catch (error) {
      console.error('인증 확인 오류:', error);
      return false;
    }
  }

  // 토큰 가져오기 (public 메서드)
  async getToken(): Promise<string | null> {
    return await this.getAuthToken();
  }

  // 비밀번호 변경
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      console.log('비밀번호 변경 요청 시작');
      const headers = await this.getAuthHeaders();
      
      const requestBody = {
        current_password: currentPassword,
        new_password: newPassword
      };
      console.log('비밀번호 변경 요청 본문:', { ...requestBody, current_password: '***', new_password: '***' });
      
      const response = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('비밀번호 변경 응답 상태:', response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.log('비밀번호 변경 오류 응답:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '비밀번호 변경에 실패했습니다.');
        } catch (parseError) {
          console.error('비밀번호 변경 오류 JSON 파싱 실패:', parseError);
          throw new Error(`비밀번호 변경 실패 (${response.status}): ${responseText}`);
        }
      }

      const result = await response.json();
      console.log('비밀번호 변경 성공:', result);
      return result;
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      throw error;
    }
  }

  // FCM 토큰 업데이트
  async updateFCMToken(fcmToken: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/update-fcm-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fcm_token: fcmToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'FCM 토큰 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('FCM 토큰 업데이트 오류:', error);
      throw error;
    }
  }

  // 알림 설정 조회
  async getNotificationSettings(): Promise<{ notifications_enabled: boolean }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/notification-settings`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '알림 설정 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('알림 설정 조회 오류:', error);
      throw error;
    }
  }

  // 알림 설정 업데이트
  async updateNotificationSettings(enabled: boolean): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/notification-settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ notifications_enabled: enabled }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '알림 설정 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('알림 설정 업데이트 오류:', error);
      throw error;
    }
  }

  // 테스트 알림 전송
  async sendTestNotification(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/test-notification`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '테스트 알림 전송에 실패했습니다.');
      }

      const result = await response.json();
      console.log('테스트 알림 전송 결과:', result);
    } catch (error) {
      console.error('테스트 알림 전송 오류:', error);
      throw error;
    }
  }

  // 모든 사용자에게 테스트 알림 전송 (관리자만)
  async sendTestNotificationToAll(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/users/test-notification-all`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '전체 테스트 알림 전송에 실패했습니다.');
      }

      const result = await response.json();
      console.log('전체 테스트 알림 전송 결과:', result);
    } catch (error) {
      console.error('전체 테스트 알림 전송 오류:', error);
      throw error;
    }
  }

  // 회원 탈퇴
  async withdraw(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await fetch(`${API_BASE_URL}/users/withdraw`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '회원 탈퇴에 실패했습니다.');
      }

      // 로컬 저장소 정리
      await AsyncStorage.multiRemove([
        'access_token',
        'refresh_token',
        'user_info'
      ]);

      console.log('회원 탈퇴 완료');
    } catch (error) {
      console.error('회원 탈퇴 실패:', error);
      throw error;
    }
  }

  // 사용자 목록 조회 (채팅용)
  async getUsers(skip: number = 0, limit: number = 50, search?: string): Promise<UserInfo[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams();
      params.append('skip', skip.toString());
      params.append('limit', limit.toString());
      if (search) params.append('search', search);

      const response = await fetch(`${API_BASE_URL}/users/list?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      throw error;
    }
  }
}

export const userService = new UserService(); 