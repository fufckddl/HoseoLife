import { Linking } from 'react-native';
import { router } from 'expo-router';

export interface DeepLinkData {
  type: 'post' | 'chat';
  id: string;
  roomId?: string;
  chatType?: string; // 채팅방 타입 (dm, group)
}

/**
 * 딥링크 URL을 파싱하여 데이터를 추출합니다
 * @param url 딥링크 URL (예: hoseolife://post?id=123)
 * @returns 파싱된 딥링크 데이터
 */
export function parseDeepLink(url: string): DeepLinkData | null {
  try {
    console.log('🔗 딥링크 파싱 시작:', url);
    
    // URL 파싱
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const searchParams = parsedUrl.searchParams;
    
    console.log('🔗 파싱된 호스트:', hostname);
    console.log('🔗 파라미터:', Object.fromEntries(searchParams.entries()));
    
    // 게시글 딥링크 처리
    if (hostname === 'post') {
      const postId = searchParams.get('id');
      if (postId) {
        console.log('✅ 게시글 딥링크 파싱 성공:', postId);
        return {
          type: 'post',
          id: postId
        };
      }
    }
    
    // 채팅방 딥링크 처리 (향후 확장용)
    if (hostname === 'chat') {
      const roomId = searchParams.get('id');
      const chatType = searchParams.get('type');
      if (roomId) {
        console.log('✅ 채팅방 딥링크 파싱 성공:', roomId);
        return {
          type: 'chat',
          id: roomId,
          roomId: roomId,
          chatType: chatType || 'dm'
        };
      }
    }
    
    console.log('❌ 알 수 없는 딥링크 형식');
    return null;
    
  } catch (error) {
    console.error('❌ 딥링크 파싱 오류:', error);
    return null;
  }
}

/**
 * 딥링크 데이터를 기반으로 적절한 화면으로 이동합니다
 * @param data 딥링크 데이터
 */
export function handleDeepLinkNavigation(data: DeepLinkData): void {
  try {
    console.log('🧭 딥링크 네비게이션 시작:', data);
    
    switch (data.type) {
      case 'post':
        console.log('📄 게시글 페이지로 이동:', data.id);
        router.push(`/pages/post-detail?id=${data.id}`);
        break;
        
      case 'chat':
        console.log('💬 채팅방으로 이동:', data.roomId, data.chatType);
        router.push(`/pages/chat-room?id=${data.roomId}&type=${data.chatType}`);
        break;
        
      default:
        console.log('❌ 알 수 없는 딥링크 타입:', data.type);
        break;
    }
    
  } catch (error) {
    console.error('❌ 딥링크 네비게이션 오류:', error);
  }
}

/**
 * 딥링크 이벤트 리스너를 설정합니다
 */
export function setupDeepLinkListener(): () => void {
  console.log('🔗 딥링크 리스너 설정 시작');
  
  // 앱이 실행 중일 때 받는 딥링크 처리 (안전하게)
  const linkingSubscription = Linking.addEventListener('url', (event) => {
    try {
      console.log('🔗 딥링크 수신:', event.url);
      
      const deepLinkData = parseDeepLink(event.url);
      if (deepLinkData) {
        handleDeepLinkNavigation(deepLinkData);
      }
    } catch (error) {
      console.error('❌ 딥링크 처리 실패 (무시):', error);
    }
  });
  
  // 앱이 종료된 상태에서 딥링크로 실행될 때 처리 (안전하게)
  Linking.getInitialURL().then((url) => {
    if (url) {
      console.log('🔗 초기 딥링크:', url);
      
      // 앱이 완전히 로드될 때까지 잠시 대기
      setTimeout(() => {
        try {
          const deepLinkData = parseDeepLink(url);
          if (deepLinkData) {
            handleDeepLinkNavigation(deepLinkData);
          }
        } catch (deepLinkError) {
          console.error('❌ 초기 딥링크 처리 실패 (무시):', deepLinkError);
        }
      }, 2000); // 2초 대기
    }
  }).catch((error) => {
    console.error('❌ 초기 딥링크 URL 조회 실패 (무시):', error);
  });
  
  // 리스너 정리 함수 반환
  return () => {
    console.log('🔗 딥링크 리스너 정리');
    linkingSubscription?.remove();
  };
}
