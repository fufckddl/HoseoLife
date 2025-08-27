import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://camsaw.kro.kr';

// 알람 데이터 타입 정의
export interface Alarm {
  id: number;
  user_id: number;
  title: string;
  message?: string;
  alarm_time: string;
  is_active: boolean;
  is_repeated: boolean;
  repeat_days?: string;
  sound: string;
  vibration: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateAlarmData {
  title: string;
  message?: string;
  alarm_time: string;
  is_repeated?: boolean;
  repeat_days?: string;
  sound?: string;
  vibration?: boolean;
}

export interface UpdateAlarmData {
  title?: string;
  message?: string;
  alarm_time?: string;
  is_active?: boolean;
  is_repeated?: boolean;
  repeat_days?: string;
  sound?: string;
  vibration?: boolean;
}

class AlarmService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // 알람 생성
  async createAlarm(alarmData: CreateAlarmData): Promise<Alarm> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/alarms/`,
        alarmData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 생성 실패:', error);
      throw error;
    }
  }

  // 사용자의 모든 알람 조회
  async getUserAlarms(): Promise<{ alarms: Alarm[]; total: number }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/alarms/`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 조회 실패:', error);
      throw error;
    }
  }

  // 특정 알람 조회
  async getAlarm(alarmId: number): Promise<Alarm> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `${API_BASE_URL}/alarms/${alarmId}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 조회 실패:', error);
      throw error;
    }
  }

  // 알람 수정
  async updateAlarm(alarmId: number, updateData: UpdateAlarmData): Promise<Alarm> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.put(
        `${API_BASE_URL}/alarms/${alarmId}`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 수정 실패:', error);
      throw error;
    }
  }

  // 알람 삭제
  async deleteAlarm(alarmId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      await axios.delete(
        `${API_BASE_URL}/alarms/${alarmId}`,
        { headers }
      );
    } catch (error) {
      console.error('알람 삭제 실패:', error);
      throw error;
    }
  }

  // 알람 활성화/비활성화 토글
  async toggleAlarm(alarmId: number): Promise<Alarm> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/alarms/${alarmId}/toggle`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 토글 실패:', error);
      throw error;
    }
  }

  // 알람 테스트 알림 전송
  async testAlarmNotification(): Promise<{ message: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.post(
        `${API_BASE_URL}/alarms/test`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('알람 테스트 실패:', error);
      throw error;
    }
  }

  // 요일 문자열을 배열로 변환
  parseRepeatDays(repeatDays: string): number[] {
    if (!repeatDays) return [];
    return repeatDays.split(',').map(day => parseInt(day.trim()));
  }

  // 요일 배열을 문자열로 변환
  formatRepeatDays(days: number[]): string {
    return days.sort().join(',');
  }

  // 요일 번호를 한글 이름으로 변환
  getDayName(dayNumber: number): string {
    const dayNames = ['', '월', '화', '수', '목', '금', '토', '일'];
    return dayNames[dayNumber] || '';
  }

  // 요일 번호들을 한글 이름으로 변환
  getDayNames(dayNumbers: number[]): string {
    return dayNumbers.map(day => this.getDayName(day)).join(', ');
  }
}

export const alarmService = new AlarmService();
