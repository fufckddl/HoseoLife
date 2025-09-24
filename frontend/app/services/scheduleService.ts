import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://hoseolife.kro.kr';

// 강의 정보 타입
export interface Course {
  id: number;
  no?: string;
  college?: string; // 🆕 단과대학
  department?: string; // 🆕 학과/부
  classification?: string;
  aisw_micro_degree?: string;
  general_area?: string;
  course_code?: string;
  section?: string;
  target_grade?: string;
  name: string;
  credits: number;
  professor: string;
  lecture_time_room?: string;
  // 🆕 분리된 표시용 필드 (서버에서 제공)
  lecture_time?: string;  // 예: "화3,4 목1"
  lecture_room?: string;  // 예: "제1공학관(아산) 402"
  class_type?: string;
  teaching_method?: string;
  team_teaching_type?: string;
  
  // 파싱된 시간 정보
  day?: number; // 0: 월, 1: 화, 2: 수, 3: 목, 4: 금, 5: 토, 6: 일
  start_period?: number; // 0: 09:00, 1: 10:00, 2: 11:00...
  end_period?: number;
  classroom?: string;
  
  // 추가 필드
  is_major: boolean;
  color: string;
  user_id: number;
  user_schedule_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CourseCreate {
  no?: string;
  classification?: string;
  aisw_micro_degree?: string;
  general_area?: string;
  course_code?: string;
  section?: string;
  target_grade?: string;
  name: string;
  credits: number;
  professor: string;
  lecture_time_room?: string;
  class_type?: string;
  teaching_method?: string;
  team_teaching_type?: string;
  
  // 파싱된 시간 정보
  day?: number;
  start_period?: number;
  end_period?: number;
  classroom?: string;
  
  // 추가 필드
  is_major: boolean;
  color: string;
  user_id: number;
  user_schedule_id?: number;
}

export interface CourseUpdate {
  no?: string;
  classification?: string;
  aisw_micro_degree?: string;
  general_area?: string;
  course_code?: string;
  section?: string;
  target_grade?: string;
  name?: string;
  credits?: number;
  professor?: string;
  lecture_time_room?: string;
  class_type?: string;
  teaching_method?: string;
  team_teaching_type?: string;
  
  // 파싱된 시간 정보
  day?: number;
  start_period?: number;
  end_period?: number;
  classroom?: string;
  
  // 추가 필드
  is_major?: boolean;
  color?: string;
  user_schedule_id?: number;
}

export interface ScheduleResponse {
  courses: Course[];
  total_credits: number;
  major_credits: number;
  general_credits: number;
}

export interface ConflictCheck {
  day: number;
  start_period: number;
  end_period: number;
  user_id: number;
  exclude_course_id?: number;
}

// UserSchedule 관련 타입
export interface UserSchedule {
  id: number;
  name: string;
  description?: string;
  semester?: string;
  year?: number;
  is_active: boolean;
  is_default: boolean;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface UserScheduleCreate {
  name: string;
  description?: string;
  semester?: string;
  year?: number;
  is_active?: boolean;
  is_default?: boolean;
  user_id: number;
}

export interface UserScheduleUpdate {
  name?: string;
  description?: string;
  semester?: string;
  year?: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UserScheduleWithCourses extends UserSchedule {
  courses: Course[];
}

class ScheduleService {
  private async getAuthToken(): Promise<string | null> {
    try {
      let token = await AsyncStorage.getItem('access_token');
      console.log('ScheduleService 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        // 잠시 대기 후 다시 시도
        await new Promise(resolve => setTimeout(resolve, 300));
        token = await AsyncStorage.getItem('access_token');
        console.log('ScheduleService 토큰 재확인:', token ? '토큰 있음' : '토큰 없음');
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

  // 강의 시간표 조회
  async getSchedule(): Promise<ScheduleResponse> {
    try {
      const response = await axios.get(`${API_URL}/schedule/`, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('강의 시간표 조회 실패:', error);
      throw new Error(error.response?.data?.detail || '강의 시간표 조회에 실패했습니다.');
    }
  }

  // 강의 목록 조회
  async getCourses(): Promise<Course[]> {
    try {
      const response = await axios.get(`${API_URL}/schedule/courses`, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('강의 목록 조회 실패:', error);
      throw new Error(error.response?.data?.detail || '강의 목록 조회에 실패했습니다.');
    }
  }

  // 강의 추가
  async createCourse(courseData: CourseCreate): Promise<Course> {
    try {
      const response = await axios.post(`${API_URL}/schedule/courses`, courseData, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('강의 추가 실패:', error);
      throw new Error(error.response?.data?.detail || '강의 추가에 실패했습니다.');
    }
  }

  // 강의 수정
  async updateCourse(courseId: number, courseData: CourseUpdate): Promise<Course> {
    try {
      const response = await axios.put(`${API_URL}/schedule/courses/${courseId}`, courseData, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('강의 수정 실패:', error);
      throw new Error(error.response?.data?.detail || '강의 수정에 실패했습니다.');
    }
  }

  // 강의 삭제
  async deleteCourse(courseId: number): Promise<void> {
    try {
      await axios.delete(`${API_URL}/schedule/courses/${courseId}`, {
        headers: await this.getAuthHeaders(),
      });
    } catch (error: any) {
      console.error('강의 삭제 실패:', error);
      throw new Error(error.response?.data?.detail || '강의 삭제에 실패했습니다.');
    }
  }

  // 시간 충돌 확인
  async checkTimeConflict(conflictCheck: ConflictCheck): Promise<{has_conflict: boolean, conflict_course?: any}> {
    try {
      const response = await axios.post(`${API_URL}/schedule/check-conflict`, conflictCheck, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('시간 충돌 확인 실패:', error);
      throw new Error(error.response?.data?.detail || '시간 충돌 확인에 실패했습니다.');
    }
  }

  // UserSchedule 관련 메서드들
  async getUserSchedules(): Promise<UserSchedule[]> {
    try {
      const response = await axios.get(`${API_URL}/schedule/user-schedules`, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('시간표 목록 조회 실패:', error);
      throw new Error(error.response?.data?.detail || '시간표 목록 조회에 실패했습니다.');
    }
  }

  async getUserSchedule(scheduleId: number): Promise<UserScheduleWithCourses> {
    try {
      const response = await axios.get(`${API_URL}/schedule/user-schedules/${scheduleId}`, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('시간표 조회 실패:', error);
      throw new Error(error.response?.data?.detail || '시간표 조회에 실패했습니다.');
    }
  }

  async createUserSchedule(scheduleData: UserScheduleCreate): Promise<UserSchedule> {
    try {
      const response = await axios.post(`${API_URL}/schedule/user-schedules`, scheduleData, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('시간표 생성 실패:', error);
      throw new Error(error.response?.data?.detail || '시간표 생성에 실패했습니다.');
    }
  }

  async updateUserSchedule(scheduleId: number, scheduleData: UserScheduleUpdate): Promise<UserSchedule> {
    try {
      const response = await axios.put(`${API_URL}/schedule/user-schedules/${scheduleId}`, scheduleData, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('시간표 수정 실패:', error);
      throw new Error(error.response?.data?.detail || '시간표 수정에 실패했습니다.');
    }
  }

  async deleteUserSchedule(scheduleId: number): Promise<void> {
    try {
      await axios.delete(`${API_URL}/schedule/user-schedules/${scheduleId}`, {
        headers: await this.getAuthHeaders(),
      });
    } catch (error: any) {
      console.error('시간표 삭제 실패:', error);
      throw new Error(error.response?.data?.detail || '시간표 삭제에 실패했습니다.');
    }
  }

  async getActiveSchedule(): Promise<UserScheduleWithCourses> {
    try {
      const response = await axios.get(`${API_URL}/schedule/active-schedule`, {
        headers: await this.getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      console.error('활성 시간표 조회 실패:', error);
      throw new Error(error.response?.data?.detail || '활성 시간표 조회에 실패했습니다.');
    }
  }

         // CSV 업로드
         async uploadScheduleCSV(file: File, scheduleId?: number): Promise<{message: string, schedule_id: number, courses_created: number}> {
           try {
             const formData = new FormData();
             formData.append('file', file);
             if (scheduleId) {
               formData.append('schedule_id', scheduleId.toString());
             }

             const token = await this.getAuthToken();
             const response = await axios.post(`${API_URL}/schedule/upload-csv`, formData, {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Content-Type': 'multipart/form-data',
               },
             });
             return response.data;
           } catch (error: any) {
             console.error('CSV 업로드 실패:', error);
             throw new Error(error.response?.data?.detail || 'CSV 업로드에 실패했습니다.');
           }
         }

        // 과목 검색
        async searchCourses(
          query?: string, 
          classification?: string, 
          college?: string,
          department?: string,
          isMajor?: boolean, 
          limit: number = 50
        ): Promise<Course[]> {
          try {
            const params = new URLSearchParams();
            if (query) {
              // 한글 검색어를 명시적으로 인코딩
              params.append('q', encodeURIComponent(query));
            }
            if (classification) {
              params.append('classification', encodeURIComponent(classification));
            }
            if (college) {
              params.append('college', encodeURIComponent(college));
            }
            if (department) {
              params.append('department', encodeURIComponent(department));
            }
            if (isMajor !== undefined) params.append('is_major', isMajor.toString());
            params.append('limit', limit.toString());

            console.log('검색 파라미터:', params.toString());
            const response = await axios.get(`${API_URL}/schedule/courses/search?${params}`, {
              headers: await this.getAuthHeaders(),
            });
            console.log('검색 결과:', response.data);
            return response.data;
          } catch (error: any) {
            console.error('과목 검색 실패:', error);
            throw new Error(error.response?.data?.detail || '과목 검색에 실패했습니다.');
          }
        }

        // 이수구분 목록 조회
        async getClassifications(): Promise<string[]> {
          try {
            const response = await axios.get(`${API_URL}/schedule/courses/classifications`, {
              headers: await this.getAuthHeaders(),
            });
            return response.data;
          } catch (error: any) {
            console.error('이수구분 목록 조회 실패:', error);
            throw new Error(error.response?.data?.detail || '이수구분 목록 조회에 실패했습니다.');
          }
        }

        // 🆕 단과대학 목록 조회
        async getColleges(): Promise<string[]> {
          try {
            const response = await axios.get(`${API_URL}/schedule/courses/colleges`, {
              headers: await this.getAuthHeaders(),
            });
            return response.data;
          } catch (error: any) {
            console.error('단과대학 목록 조회 실패:', error);
            throw new Error(error.response?.data?.detail || '단과대학 목록 조회에 실패했습니다.');
          }
        }

        // 🆕 학과/부 목록 조회
        async getDepartments(college?: string): Promise<string[]> {
          try {
            const params = new URLSearchParams();
            if (college) {
              params.append('college', encodeURIComponent(college));
            }

            const response = await axios.get(`${API_URL}/schedule/courses/departments?${params}`, {
              headers: await this.getAuthHeaders(),
            });
            return response.data;
          } catch (error: any) {
            console.error('학과 목록 조회 실패:', error);
            throw new Error(error.response?.data?.detail || '학과 목록 조회에 실패했습니다.');
          }
        }

        // 개설과목을 시간표에 자동 시간 할당으로 추가
        async addCourseToSchedule(
          courseId: number, 
          scheduleId?: number
        ): Promise<Course> {
          try {
            const params = new URLSearchParams();
            if (scheduleId) params.append('schedule_id', scheduleId.toString());

            const response = await axios.post(
              `${API_URL}/schedule/courses/${courseId}/add-to-schedule?${params}`,
              {},
              {
                headers: await this.getAuthHeaders(),
              }
            );
            return response.data;
          } catch (error: any) {
            console.error('과목 추가 실패:', error);
            throw new Error(error.response?.data?.detail || '과목 추가에 실패했습니다.');
          }
        }
}

export const scheduleService = new ScheduleService();
