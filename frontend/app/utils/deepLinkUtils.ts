import { Linking } from 'react-native';
import { router } from 'expo-router';

export interface DeepLinkData {
  type: 'post' | 'chat';
  id: string;
  roomId?: string;
  chatType?: string; // 채팅방 타입 (dm, group)
  commentId?: string; // 대댓글 ID (선택사항)
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
      const commentId = searchParams.get('comment_id');
      if (postId) {
        console.log('✅ 게시글 딥링크 파싱 성공:', postId, commentId ? `(댓글: ${commentId})` : '');
        return {
          type: 'post',
          id: postId,
          commentId: commentId || undefined
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


// 🗑️ _layout.tsx에서 직접 알림 처리를 하므로 이 함수들은 더 이상 사용하지 않음
// handleChatNavigation, handleDeepLinkNavigation 함수 제거됨r

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
        // 🔧 _layout.tsx에서 직접 처리하므로 여기서는 로그만 남김
        console.log('🔗 파싱된 딥링크 데이터:', deepLinkData);
        console.log('ℹ️ 실제 네비게이션은 _layout.tsx에서 처리됨');
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
            // 🔧 _layout.tsx에서 직접 처리하므로 여기서는 로그만 남김
            console.log('🔗 초기 딥링크 파싱 성공:', deepLinkData);
            console.log('ℹ️ 실제 네비게이션은 _layout.tsx에서 처리됨');
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
