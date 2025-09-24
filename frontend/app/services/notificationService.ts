import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  data?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

class NotificationService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 사용자 알림 목록 조회
  async getUserNotifications(skip: number = 0, limit: number = 50, unreadOnly: boolean = false): Promise<NotificationItem[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        unread_only: unreadOnly.toString()
      });

      const response = await fetch(`${API_BASE_URL}/notifications/?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`알림 조회 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('알림 조회 오류:', error);
      throw error;
    }
  }

  // 알림을 읽음으로 표시
  async markNotificationAsRead(notificationId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        throw new Error(`알림 읽음 처리 실패: ${response.status}`);
      }
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 모든 알림을 읽음으로 표시
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        throw new Error(`전체 알림 읽음 처리 실패: ${response.status}`);
      }
    } catch (error) {
      console.error('전체 알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 읽지 않은 알림 개수 조회
  async getUnreadCount(): Promise<number> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`읽지 않은 알림 개수 조회 실패: ${response.status}`);
      }

      const result = await response.json();
      return result.unread_count || 0;
    } catch (error) {
      console.error('읽지 않은 알림 개수 조회 오류:', error);
      return 0;
    }
  }

  // 🆕 FCM 토큰 발급
  async getFCMToken(): Promise<string | null> {
    try {
      console.log('🔔 FCM 토큰 발급 시작');
      
      // 알림 권한 요청
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ 알림 권한이 거부됨');
        return null;
      }

      // FCM 토큰 발급
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'b046f9bf-ef7a-4bd4-a9d0-74602416e381', // 🔧 실제 프로젝트 ID 사용
      });
      
      const token = tokenData.data;
      console.log('✅ FCM 토큰 발급 성공:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('❌ FCM 토큰 발급 실패:', error);
      return null;
    }
  }

  // 🆕 알림 리스너 설정
  setupNotificationListeners(): void {
    try {
      console.log('🔔 알림 리스너 설정 시작');
      
      // 알림 수신 시 처리
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('🔔 알림 수신:', notification);
      });

      // 알림 클릭 시 처리
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('🔔 알림 클릭:', response);
        // 필요시 딥링크 처리 추가
      });

      // 알림 표시 방식 설정
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      console.log('✅ 알림 리스너 설정 완료');
    } catch (error) {
      console.error('❌ 알림 리스너 설정 실패:', error);
    }
  }
}

export const notificationService = new NotificationService();