import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://camsaw.kro.kr';

export enum ReportType {
  SPAM = "스팸/광고",
  HARASSMENT = "욕설/폭력",
  SEXUAL = "음란물",
  ILLEGAL = "불법행위",
  PERSONAL_INFO = "개인정보",
  COPYRIGHT = "저작권 침해",
  MISLEADING = "허위정보",
  OTHER = "기타"
}

export enum ReportStatus {
  PENDING = "대기중",
  REVIEWED = "검토완료",
  RESOLVED = "처리완료"
}

export enum PenaltyType {
  WARNING = "경고",
  TEMPORARY_BAN = "임시정지",
  PERMANENT_BAN = "영구정지"
}

export interface ReportData {
  id: number;
  reporter_id: number;
  target_type: string;
  target_id: number;
  report_type: ReportType;
  reason: string;
  evidence?: string;
  status: ReportStatus;
  admin_response?: string;
  admin_id?: number;
  created_at: string;
  reviewed_at?: string;
  reporter_nickname?: string;
  admin_nickname?: string;
}

export interface ReportCreateData {
  target_type: string;
  target_id: number;
  report_type: ReportType;
  reason: string;
  evidence?: string;
}

export interface ReportListData {
  id: number;
  target_type: string;
  target_id: number;
  report_type: ReportType;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter_nickname: string;
  target_content?: string;
}

export interface ReportReviewData {
  status: ReportStatus;
  admin_response?: string;
  penalty_type?: PenaltyType;
  penalty_reason?: string;
  duration_days?: number;
}

export interface UserPenaltyData {
  id: number;
  user_id: number;
  penalty_type: PenaltyType;
  reason: string;
  duration_days?: number;
  start_date: string;
  end_date?: string;
  report_count: number;
  admin_id: number;
  is_active: boolean;
  user_nickname?: string;
  admin_nickname?: string;
}

export interface ReportStats {
  total_reports: number;
  pending_reports: number;
  reviewed_reports: number;
  resolved_reports: number;
  reports_by_type: Record<string, number>;
  reports_by_status: Record<string, number>;
}

class ReportService {
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

  // 신고 생성
  async createReport(reportData: ReportCreateData): Promise<ReportData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '신고 생성에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('신고 생성 오류:', error);
      throw error;
    }
  }

  // 관리자용 신고 목록 조회
  async getAllReports(
    skip: number = 0, 
    limit: number = 10,
    statusFilter?: string,
    typeFilter?: string
  ): Promise<ReportListData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      let url = `${API_BASE_URL}/reports/admin?skip=${skip}&limit=${limit}`;
      if (statusFilter) url += `&status_filter=${statusFilter}`;
      if (typeFilter) url += `&type_filter=${typeFilter}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('신고 목록 API 오류 응답:', errorText);
        throw new Error('신고 목록 조회에 실패했습니다.');
      }

      const data = await response.json();
      console.log('신고 목록 응답 데이터:', data);
      return data;
    } catch (error) {
      console.error('신고 목록 조회 오류:', error);
      return []; // 빈 배열 반환
    }
  }

  // 관리자용 신고 상세 조회
  async getReportDetail(reportId: number): Promise<ReportData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/admin/${reportId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '신고 상세 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('신고 상세 조회 오류:', error);
      throw error;
    }
  }

  // 관리자용 신고 검토 및 처벌
  async reviewReport(reportId: number, reviewData: ReportReviewData): Promise<ReportData> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/admin/${reportId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(reviewData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '신고 검토에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('신고 검토 오류:', error);
      throw error;
    }
  }

  // 관리자용 신고 통계
  async getReportStats(): Promise<ReportStats> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/admin/stats`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('신고 통계 API 오류 응답:', errorText);
        throw new Error('신고 통계 조회에 실패했습니다.');
      }

      const data = await response.json();
      console.log('신고 통계 응답 데이터:', data);
      return data;
    } catch (error) {
      console.error('신고 통계 조회 오류:', error);
      // 기본 통계 반환
      return {
        total_reports: 0,
        pending_reports: 0,
        reviewed_reports: 0,
        resolved_reports: 0,
        reports_by_type: {},
        reports_by_status: {}
      };
    }
  }

  // 관리자용 사용자 처벌 목록 조회
  async getUserPenalties(skip: number = 0, limit: number = 10): Promise<UserPenaltyData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/admin/penalties?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '사용자 처벌 목록 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('사용자 처벌 목록 조회 오류:', error);
      throw error;
    }
  }

  // 사용자 본인의 신고 내역 조회
  async getUserReports(skip: number = 0, limit: number = 10): Promise<ReportListData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/user/reports?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('사용자 신고 내역 API 오류 응답:', errorText);
        throw new Error('사용자 신고 내역 조회에 실패했습니다.');
      }

      const data = await response.json();
      console.log('사용자 신고 내역 응답 데이터:', data);
      return data;
    } catch (error) {
      console.error('사용자 신고 내역 조회 오류:', error);
      return []; // 빈 배열 반환
    }
  }

  // 사용자 본인의 활성 처벌 조회
  async getUserActivePenalties(): Promise<UserPenaltyData[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/reports/user/penalties`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('사용자 활성 처벌 API 오류 응답:', errorText);
        throw new Error('사용자 활성 처벌 조회에 실패했습니다.');
      }

      const data = await response.json();
      console.log('사용자 활성 처벌 응답 데이터:', data);
      return data;
    } catch (error) {
      console.error('사용자 활성 처벌 조회 오류:', error);
      return []; // 빈 배열 반환
    }
  }
}

export const reportService = new ReportService(); 