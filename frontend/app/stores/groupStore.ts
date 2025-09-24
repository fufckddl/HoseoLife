// 그룹 채팅 관련 Zustand 스토어
import { create } from 'zustand';
import { groupChatService } from '../services/groupChatService';

export interface GroupRequest {
  id: number;
  name: string;
  description?: string;
  requesterId: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AvailableGroup {
  roomId: number;
  name: string;
  description?: string;
  memberCount: number;
}

export interface RoomSummary {
  roomId: number;
  name: string;
  type: 'dm' | 'group';
  imageUrl?: string;  // 🆕 채팅방 이미지 URL 추가
  lastMessage?: string;
  unread: number;
}

export interface MyRooms {
  dms: RoomSummary[];
  groups: RoomSummary[];
}

interface GroupStore {
  // 상태
  pendingRequests: GroupRequest[];
  availableGroups: AvailableGroup[];
  myRooms: MyRooms;
  loading: boolean;
  error: string | null;
  
  // 액션
  createGroupRequest: (name: string, description?: string, imageUrl?: string | null) => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  approveGroupRequest: (id: number) => Promise<void>;
  rejectGroupRequest: (id: number) => Promise<void>;
  fetchAvailableGroups: () => Promise<void>;
  joinGroup: (roomId: number) => Promise<void>;
  fetchMyRooms: () => Promise<void>;
  clearError: () => void;
  refreshMyRooms: () => Promise<void>;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  // 초기 상태
  pendingRequests: [],
  availableGroups: [],
  myRooms: { dms: [], groups: [] },
  loading: false,
  error: null,
  
  // 그룹 생성 요청
  createGroupRequest: async (name: string, description?: string, imageUrl?: string | null) => {
    set({ loading: true, error: null });
    try {
      await groupChatService.createGroupRequest(name, description, imageUrl);
      set({ loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '그룹 생성 요청에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 대기 중인 요청 목록 조회
  fetchPendingRequests: async () => {
    set({ loading: true, error: null });
    try {
      const requests = await groupChatService.fetchPendingGroupRequests();
      set({ pendingRequests: requests, loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '요청 목록 조회에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 그룹 요청 승인
  approveGroupRequest: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await groupChatService.approveGroupRequest(id);
      // 승인 후 목록 새로고침
      await get().fetchPendingRequests();
      set({ loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '그룹 승인에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 그룹 요청 거부
  rejectGroupRequest: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await groupChatService.rejectGroupRequest(id);
      // 거부 후 목록 새로고침
      await get().fetchPendingRequests();
      set({ loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '그룹 거부에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 참여 가능한 그룹 목록 조회
  fetchAvailableGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await groupChatService.fetchAvailableGroups();
      set({ availableGroups: groups, loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '그룹 목록 조회에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 그룹 참여
  joinGroup: async (roomId: number) => {
    set({ loading: true, error: null });
    try {
      await groupChatService.joinGroup(roomId);
      // 참여 후 내 방 목록 새로고침
      await get().fetchMyRooms();
      set({ loading: false });
    } catch (error) {
      set({ 
        loading: false, 
        error: error instanceof Error ? error.message : '그룹 참여에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 내 채팅방 목록 조회
  fetchMyRooms: async () => {
    set({ loading: true, error: null });
    try {
      console.log('🔄 fetchMyRooms API 호출 시작');
      const rooms = await groupChatService.fetchMyRooms();
      console.log('📊 API 응답:', rooms);
      console.log('👥 그룹 수:', rooms?.groups?.length || 0);
      console.log('💬 DM 수:', rooms?.dms?.length || 0);
      set({ myRooms: rooms || { dms: [], groups: [] }, loading: false });
      console.log('✅ fetchMyRooms 완료');
    } catch (error) {
      console.error('❌ fetchMyRooms 오류:', error);
      set({ 
        loading: false, 
        myRooms: { dms: [], groups: [] },
        error: error instanceof Error ? error.message : '채팅방 목록 조회에 실패했습니다' 
      });
      throw error;
    }
  },
  
  // 에러 초기화
  clearError: () => set({ error: null }),
  
  // 내 채팅방 목록 강제 새로고침
  refreshMyRooms: async () => {
    console.log('🔄 refreshMyRooms 강제 새로고침 시작');
    try {
      // 상태 초기화 후 새로고침
      set({ myRooms: { dms: [], groups: [] }, loading: true, error: null });
      await get().fetchMyRooms();
      console.log('✅ refreshMyRooms 강제 새로고침 완료');
    } catch (error) {
      console.error('❌ refreshMyRooms 오류:', error);
      set({ 
        loading: false, 
        myRooms: { dms: [], groups: [] },
        error: error instanceof Error ? error.message : '채팅방 목록 새로고침에 실패했습니다' 
      });
    }
  },
}));
