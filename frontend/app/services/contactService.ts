import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface ContactData {
  id: number;
  user_id: number;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  admin_response?: string;
  admin_id?: number;
  created_at: string;
  updated_at?: string;
  is_read: boolean;
  is_answered: boolean;
  user_nickname?: string;
  admin_nickname?: string;
}

export interface ContactCreateData {
  subject: string;
  message: string;
  category?: string;
}

export interface ContactUpdateData {
  status?: string;
  priority?: string;
  admin_response?: string;
  is_read?: boolean;
  is_answered?: boolean;
}

export interface ContactStats {
  total: number;
  unread: number;
  pending: number;
  answered: number;
  category_stats: Record<string, number>;
}

class ContactService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('access_token');
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

  // 문의 생성
  async createContact(contactData: ContactCreateData): Promise<ContactData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/contacts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '문의 생성에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('문의 생성 오류:', error);
      throw error;
    }
  }

  // 사용자 본인 문의 목록 조회
  async getMyContacts(skip: number = 0, limit: number = 10): Promise<ContactData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/contacts/my?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '문의 목록 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('문의 목록 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 본인 문의 상세 조회
  async getMyContact(contactId: number): Promise<ContactData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/contacts/my/${contactId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '문의 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('문의 조회 오류:', error);
      throw error;
    }
  }

  // 관리자용 모든 문의 목록 조회
  async getAllContacts(
    skip: number = 0, 
    limit: number = 10,
    statusFilter?: string,
    categoryFilter?: string,
    priorityFilter?: string
  ): Promise<ContactData[]> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('관리자 문의 목록 조회 - 헤더:', headers);
      
      let url = `${API_BASE_URL}/contacts/admin?skip=${skip}&limit=${limit}`;
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      if (categoryFilter) url += `&category_filter=${categoryFilter}`;
      if (priorityFilter) url += `&priority_filter=${priorityFilter}`;
      
      console.log('관리자 문의 목록 조회 - URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('관리자 문의 목록 조회 - 응답 상태:', response.status);
      console.log('관리자 문의 목록 조회 - 응답 헤더:', response.headers);

      if (!response.ok) {
        const responseText = await response.text();
        console.log('관리자 문의 목록 조회 - 에러 응답 텍스트:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '문의 목록 조회에 실패했습니다.');
        } catch (parseError) {
          throw new Error(`문의 목록 조회 실패 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('관리자 문의 목록 조회 - 성공 응답 텍스트:', responseText);
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('문의 목록 조회 오류:', error);
      throw error;
    }
  }

  // 관리자용 문의 상세 조회
  async getContactDetail(contactId: number): Promise<ContactData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/contacts/admin/${contactId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '문의 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('문의 조회 오류:', error);
      throw error;
    }
  }

  // 관리자용 문의 업데이트/답변
  async updateContact(contactId: number, updateData: ContactUpdateData): Promise<ContactData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/contacts/admin/${contactId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '문의 업데이트에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('문의 업데이트 오류:', error);
      throw error;
    }
  }

  // 문의 통계 조회 (관리자용)
  async getContactStats(): Promise<ContactStats> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('통계 조회 - 헤더:', headers);
      
      const response = await fetch(`${API_BASE_URL}/contacts/admin/stats`, {
        method: 'GET',
        headers,
      });

      console.log('통계 조회 - 응답 상태:', response.status);
      console.log('통계 조회 - 응답 헤더:', response.headers);

      if (!response.ok) {
        const responseText = await response.text();
        console.log('통계 조회 - 에러 응답 텍스트:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '통계 조회에 실패했습니다.');
        } catch (parseError) {
          throw new Error(`통계 조회 실패 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('통계 조회 - 성공 응답 텍스트:', responseText);
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('통계 조회 오류:', error);
      throw error;
    }
  }
}

export const contactService = new ContactService(); 