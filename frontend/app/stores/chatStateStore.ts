// 현재 채팅방 상태 관리 스토어
import { create } from 'zustand';

interface ChatState {
  // 현재 입장한 채팅방 정보
  currentRoomId: number | null;
  currentRoomType: 'dm' | 'group' | null;
  
  // 액션
  setCurrentRoom: (roomId: number, roomType: 'dm' | 'group') => void;
  clearCurrentRoom: () => void;
  isInRoom: (roomId: number) => boolean;
}

// Zustand store 생성
const createChatStateStore = () => {
  console.log('🔧 useChatStateStore 초기화 시작');
  
  return create<ChatState>((set, get) => {
    const store = {
      // 초기 상태
      currentRoomId: null,
      currentRoomType: null,
      
      // 현재 채팅방 설정
      setCurrentRoom: (roomId: number, roomType: 'dm' | 'group') => {
        console.log(`🏠 채팅방 입장: ID ${roomId}, 타입 ${roomType}`);
        set({ currentRoomId: roomId, currentRoomType: roomType });
      },
      
      // 채팅방 나가기
      clearCurrentRoom: () => {
        console.log('🚪 채팅방 나가기');
        set({ currentRoomId: null, currentRoomType: null });
      },
      
      // 특정 채팅방에 있는지 확인
      isInRoom: (roomId: number) => {
        const state = get();
        return state.currentRoomId === roomId;
      },
    };
    
    console.log('🔧 useChatStateStore 초기화 완료:', store);
    return store;
  });
};

// Store 인스턴스 생성
export const useChatStateStore = createChatStateStore();
