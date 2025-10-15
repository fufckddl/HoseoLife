import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export interface PostCreateData {
  title: string;
  content: string;
  category: string;
  building_name?: string;
  building_latitude?: string;
  building_longitude?: string;
  image_urls?: string[];
}

export interface PostResponse {
  id: number;
  title: string;
  content: string;
  category: string;
  building_name?: string;
  building_latitude?: string;
  building_longitude?: string;
  author_id: number;
  author_nickname: string;
  author_profile_image_url?: string;
  image_urls?: string;
  is_active: boolean;
  view_count: number;
  heart_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostListResponse {
  id: number;
  title: string;
  content: string;
  author_id: number;
  category: string;
  board_name?: string;
  building_name?: string;
  building_latitude?: string;
  building_longitude?: string;
  author_nickname: string;
  author_profile_image_url?: string;
  view_count: number;
  heart_count: number;
  scrap_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string;
  image_urls?: string[];
}

export interface Comment {
  id: number;
  content: string;
  author_nickname: string;
  author_id: number;
  author_profile_image_url?: string;
  parent_id?: number;  // 대댓글 기능
  depth?: number;      // 댓글 깊이
  created_at: string;
}

export interface CommentCreateData {
  content: string;
}

export interface HeartResponse {
  message: string;
  is_hearted: boolean;
  heart_count: number;
}

export interface HeartStatus {
  is_hearted: boolean;
  heart_count: number;
}

export interface ScrapResponse {
  message: string;
  is_scrapped: boolean;
  scrap_count: number;
}

export interface ScrapStatus {
  is_scrapped: boolean;
  scrap_count: number;
}

class PostService {
  private async getAuthToken(): Promise<string | null> {
    try {
      // 두 가지 키 모두 시도
      let token = await AsyncStorage.getItem('access_token');
      if (!token) {
        token = await AsyncStorage.getItem('accessToken');
      }
      console.log('PostService에서 가져온 토큰:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        // 잠시 대기 후 다시 시도
        await new Promise(resolve => setTimeout(resolve, 300));
        token = await AsyncStorage.getItem('access_token');
        if (!token) {
          token = await AsyncStorage.getItem('accessToken');
        }
        console.log('PostService 토큰 재확인:', token ? '토큰 있음' : '토큰 없음');
      }
      
      return token;
    } catch (error) {
      console.error('토큰 가져오기 실패:', error);
      return null;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    console.log('=== getAuthHeaders 시작 ===');
    const token = await this.getAuthToken();
    console.log('토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
    console.log('최종 headers:', headers);
    return headers;
  }

  // 게시글 생성
  async createPost(postData: PostCreateData): Promise<PostResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      // 타임아웃을 위한 AbortController 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(postData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('게시글 생성 응답 상태:', response.status);
      console.log('게시글 생성 응답 헤더:', response.headers);
      
      if (!response.ok) {
        // 응답 텍스트를 먼저 확인
        const responseText = await response.text();
        console.log('게시글 생성 오류 응답:', responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.detail || '게시글 생성에 실패했습니다.');
        } catch (parseError) {
          throw new Error(`서버 오류 (${response.status}): ${responseText}`);
        }
      }

      const responseText = await response.text();
      console.log('게시글 생성 성공 응답:', responseText);
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError);
        throw new Error('서버 응답을 처리할 수 없습니다.');
      }
    } catch (error) {
      console.error('게시글 생성 오류:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('네트워크 연결이 불안정합니다. 다시 시도해주세요.');
        } else if (error.message.includes('Network request timed out')) {
          throw new Error('서버 응답이 지연되고 있습니다. 다시 시도해주세요.');
        }
      }
      
      throw error;
    }
  }

  // 게시글 목록 조회
  async getPosts(skip: number = 0, limit: number = 20, category?: string, building_name?: string, search?: string, after_date?: string, include_news_notices: boolean = false, board_id?: number): Promise<PostListResponse[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      let url = `${API_BASE_URL}/posts/?skip=${skip}&limit=${limit}`;
      if (category) url += `&category=${encodeURIComponent(category)}`;
      if (building_name) url += `&building_name=${encodeURIComponent(building_name)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (after_date) url += `&after_date=${encodeURIComponent(after_date)}`;
      if (include_news_notices) url += `&include_news_notices=true`;
      if (board_id) url += `&board_id=${board_id}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // 서버 오류 시 빈 배열 반환
        console.error('서버 응답 오류:', response.status, response.statusText);
        return [];
      }

      const responseText = await response.text();
      
      // 응답이 비어있거나 JSON이 아닌 경우 빈 배열 반환
      if (!responseText.trim()) {
        console.log('서버에서 빈 응답 받음');
        return [];
      }

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError);
        console.error('응답 텍스트:', responseText);
        return [];
      }
    } catch (error) {
      console.error('게시글 목록 조회 오류:', error);
      // 네트워크 오류 등 발생 시 빈 배열 반환
      return [];
    }
  }

  // 게시글 상세 조회
  async getPost(postId: number): Promise<PostResponse> {
    console.log('=== getPost 시작 ===');
    console.log('postId:', postId);
    console.log('API_BASE_URL:', API_BASE_URL);
    
    try {
      console.log('getAuthHeaders 호출 중...');
      const headers = await this.getAuthHeaders();
      console.log('headers:', headers);
      
      const url = `${API_BASE_URL}/posts/${postId}`;
      console.log('요청 URL:', url);
      
      console.log('fetch 요청 시작...');
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      console.log('fetch 응답 받음');
      console.log('응답 상태:', response.status);
      console.log('응답 상태 텍스트:', response.statusText);

      if (!response.ok) {
        console.log('응답이 성공적이지 않음, 에러 데이터 확인 중...');
        const errorData = await response.json();
        console.log('에러 데이터:', errorData);
        throw new Error(errorData.detail || '게시글 조회에 실패했습니다.');
      }

      console.log('응답이 성공적, JSON 파싱 중...');
      const result = await response.json();
      console.log('JSON 파싱 완료:', result);
      return result;
    } catch (error) {
      console.error('=== getPost 오류 ===');
      console.error('오류 타입:', typeof error);
      console.error('오류 메시지:', error);
      if (error instanceof Error) {
        console.error('오류 스택:', error.stack);
      }
      throw error;
    }
  }

  // 내 게시글 목록 조회
  async getMyPosts(): Promise<PostListResponse[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/my/posts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '내 게시글 목록 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('내 게시글 목록 조회 오류:', error);
      throw error;
    }
  }

  // 게시글 수정
  async updatePost(postId: number, postData: Partial<PostCreateData>): Promise<PostResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시글 수정에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      throw error;
    }
  }

  // 게시글 삭제
  async deletePost(postId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      throw error;
    }
  }

  // 댓글 목록 조회
  async getComments(postId: number): Promise<Comment[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '댓글 목록 조회에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('댓글 목록 조회 오류:', error);
      throw error;
    }
  }

  // 댓글 작성 (대댓글 지원)
  async createComment(postId: number, content: string, parentId?: number): Promise<Comment> {
    try {
      const headers = await this.getAuthHeaders();
      
      const requestBody: any = { content };
      if (parentId) {
        requestBody.parent_id = parentId;
      }
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '댓글 작성에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      throw error;
    }
  }

  // 댓글 삭제
  async deleteComment(commentId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/comments/${commentId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      throw error;
    }
  }

  // 하트 토글
  async toggleHeart(postId: number): Promise<HeartResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/heart`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '하트 토글에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('하트 토글 오류:', error);
      throw error;
    }
  }

  // 하트 상태 확인
  async getHeartStatus(postId: number): Promise<HeartStatus> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/heart`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '하트 상태 확인에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('하트 상태 확인 오류:', error);
      throw error;
    }
  }

  // 스크랩 토글
  async toggleScrap(postId: number): Promise<ScrapResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/scrap`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '스크랩 토글에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('스크랩 토글 오류:', error);
      throw error;
    }
  }

  // 스크랩 상태 확인
  async getScrapStatus(postId: number): Promise<ScrapStatus> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/scrap`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '스크랩 상태 확인에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('스크랩 상태 확인 오류:', error);
      throw error;
    }
  }

  // 내 스크랩 목록 조회
  async getMyScraps(skip: number = 0, limit: number = 20): Promise<PostListResponse[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/my/scraps?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // 서버 오류 시 빈 배열 반환
        console.error('스크랩 목록 서버 응답 오류:', response.status, response.statusText);
        return [];
      }

      const responseText = await response.text();
      
      // 응답이 비어있거나 JSON이 아닌 경우 빈 배열 반환
      if (!responseText.trim()) {
        console.log('스크랩 목록에서 빈 응답 받음');
        return [];
      }

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('스크랩 목록 JSON 파싱 오류:', parseError);
        console.error('응답 텍스트:', responseText);
        return [];
      }
    } catch (error) {
      console.error('스크랩 목록 조회 오류:', error);
      // 네트워크 오류 등 발생 시 빈 배열 반환
      return [];
    }
  }

  // 내 댓글 목록 조회
  async getMyComments(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/comments/my`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let errorMessage = '내 댓글 목록 조회에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('에러 응답 파싱 실패:', e);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('내 댓글 목록 조회 오류:', error);
      throw error;
    }
  }

  // 내가 좋아요한 게시글 목록 조회
  async getMyHearts(): Promise<PostListResponse[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/my-hearts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // 서버 오류 시 빈 배열 반환
        console.error('좋아요한 게시글 목록 서버 응답 오류:', response.status, response.statusText);
        return [];
      }

      const responseText = await response.text();
      
      // 응답이 비어있거나 JSON이 아닌 경우 빈 배열 반환
      if (!responseText.trim()) {
        console.log('좋아요한 게시글 목록에서 빈 응답 받음');
        return [];
      }

      try {
        const data = JSON.parse(responseText);
        // 기존 라우터는 PaginatedPostListResponse 형태로 반환하므로 items 배열을 반환
        return data.items || [];
      } catch (parseError) {
        console.error('좋아요한 게시글 목록 JSON 파싱 오류:', parseError);
        console.error('응답 텍스트:', responseText);
        return [];
      }
    } catch (error) {
      console.error('좋아요한 게시글 목록 조회 오류:', error);
      // 네트워크 오류 등 발생 시 빈 배열 반환
      return [];
    }
  }

  // 댓글 좋아요 토글
  async toggleCommentHeart(commentId: number): Promise<{ is_liked: boolean; like_count: number }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/comments/${commentId}/heart`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '댓글 좋아요 토글에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('댓글 좋아요 토글 오류:', error);
      throw error;
    }
  }
}

export const postService = new PostService(); 