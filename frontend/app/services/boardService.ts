import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface BoardNotice {
  id: number;
  board_id: number;
  title: string;
  content: string;
  author_id: number;
  author_nickname: string;
  author_profile_image_url?: string;  // 🆕 작성자 프로필 이미지 URL 추가
  is_active: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Board {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  creator_id?: number; // 🆕 게시판 생성자 ID
}

class BoardService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('인증 토큰이 없습니다.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 게시판 목록 조회
  async getBoards(): Promise<Board[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/boards`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 목록 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('게시판 목록 조회 오류:', error);
      throw error;
    }
  }

  // 게시판 공지사항 목록 조회
  async getBoardNotices(boardId: number): Promise<BoardNotice[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notices`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 공지사항 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('게시판 공지사항 조회 오류:', error);
      throw error;
    }
  }

  // 게시판 공지사항 생성
  async createBoardNotice(boardId: number, title: string, content: string, isPinned: boolean = true): Promise<BoardNotice> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          content,
          board_id: boardId,
          is_pinned: isPinned
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 공지사항 생성에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('게시판 공지사항 생성 오류:', error);
      throw error;
    }
  }

  // 게시판 공지사항 수정
  async updateBoardNotice(boardId: number, noticeId: number, updates: Partial<BoardNotice>): Promise<BoardNotice> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notices/${noticeId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 공지사항 수정에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('게시판 공지사항 수정 오류:', error);
      throw error;
    }
  }

  // 게시판 공지사항 삭제
  async deleteBoardNotice(boardId: number, noticeId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/notices/${noticeId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 공지사항 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('게시판 공지사항 삭제 오류:', error);
      throw error;
    }
  }
}

export const boardService = new BoardService();
