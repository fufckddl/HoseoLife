import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PenaltyNotification from './components/PenaltyNotification';
import SuspensionModal from './components/SuspensionModal';
import ErrorBoundary from './components/ErrorBoundary';
import { ErrorProvider } from './contexts/ErrorContext';
import { setupDeepLinkListener } from './utils/deepLinkUtils';

function AppContent() {
  const router = useRouter();
  const { 
    showPenaltyNotification, 
    setShowPenaltyNotification,
    showSuspensionModal,
    setShowSuspensionModal,
    updateFCMToken,
    getFCMToken,
    notificationsEnabled
  } = useAuth();

  useEffect(() => {
    // 앱 시작 시 위치 권한 요청
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          console.log('위치 권한이 허용되었습니다.');
        } else {
          console.log('위치 권한이 거부되었습니다.');
        }
      } catch (error) {
        console.error('위치 권한 요청 실패:', error);
      }
    };

    requestLocationPermission();
  }, []);

  // 앱 처음 실행 시 알림 권한 요청 및 FCM 토큰 설정
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        console.log('🔔 앱 처음 실행 - 알림 설정 시작 (_layout.tsx)');
        
        // 🔧 환경별 알림 이미지 설정 (앱 시작 시)
        const { notificationService } = await import('./services/notificationService');
        await notificationService.setupEnvironmentSpecificNotificationIcon();
        
        
        // 권한 상태 확인
        const { status } = await Notifications.getPermissionsAsync();
        console.log('🔍 현재 알림 권한 상태:', status);
        
        if (status === 'granted') {
          console.log('✅ 이미 알림 권한이 허용됨');
          
          // 알림 설정 확인
          if (!notificationsEnabled) {
            console.log('⚠️ 알림이 비활성화되어 있어 FCM 토큰 설정 건너뜀');
            return;
          }
          
          // 토큰 발급 및 등록
          const token = await getFCMToken();
          if (token) {
            await updateFCMToken(token);
            console.log('✅ FCM 토큰 설정 완료');
          }
        } else {
          // 🔧 권한이 없으면 사용자에게 권한 요청 (앱 처음 실행 시)
          console.log('🔔 앱 처음 실행 - 알림 권한 요청 시작');
          const { status: requestStatus } = await Notifications.requestPermissionsAsync();
          if (requestStatus === 'granted') {
            const token = await Notifications.getExpoPushTokenAsync({
              projectId: 'camsaw-project', // 실제 프로젝트 ID
            });
            console.log('✅ 알림 권한 허용 및 토큰 발급 완료:', token);
            // 토큰 등록 (로그인하지 않은 상태에서는 등록하지 않음)
          } else {
            console.log('⚠️ 알림 권한 거부됨');
          }
        }
      } catch (error) {
        console.error('❌ 알림 설정 실패 (무시):', error);
      }
    };

    // 앱 시작 시 알림 설정 시도
    setupNotifications();
  }, [getFCMToken, updateFCMToken, notificationsEnabled]);

  // 딥링크 리스너 설정 (안전하게 처리)
  useEffect(() => {
    try {
      console.log('🔗 딥링크 리스너 설정 시작');
      const cleanup = setupDeepLinkListener();
      
      return () => {
        try {
          console.log('🔗 딥링크 리스너 정리');
          cleanup();
        } catch (error) {
          console.error('❌ 딥링크 리스너 정리 실패 (무시):', error);
        }
      };
    } catch (error) {
      console.error('❌ 딥링크 리스너 설정 실패 (무시):', error);
      return () => {}; // 빈 정리 함수 반환
    }
  }, []);

  // 알림 클릭 시 딥링크 처리 설정
  useEffect(() => {
    const setupNotificationHandlers = async () => {
      try {
        console.log('🔔 알림 핸들러 설정 시작');
        
        // 알림 서비스 import
        
        // 포그라운드 알림 수신 핸들러
        const notificationListener = Notifications.addNotificationReceivedListener(notification => {
          console.log('🔔 포그라운드 알림 수신:', notification);
        });

        // 알림 클릭 핸들러 - notifications.tsx 방식으로 직접 처리
        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
          try {
            console.log('🔔 알림 클릭 수신:', response);
            console.log('🔔 전체 응답 구조:', JSON.stringify(response, null, 2));
            
            // 🧪 기본 테스트: 알림 클릭이 감지되는지 확인
            console.log('🧪 알림 클릭 감지됨 - 테스트 시작');
            
            const notification = response.notification;
            const content = notification.request.content;
            
            console.log('🔔 알림 컨텐츠:', content);
            console.log('🔔 알림 컨텐츠 데이터:', content.data);
            console.log('🔔 알림 컨텐츠 데이터 타입:', typeof content.data);
            
            let data: any = {};
            if (content.data) {
              try {
                data = typeof content.data === 'string' ? JSON.parse(content.data) : content.data;
                console.log('🔔 파싱된 데이터:', data);
              } catch (parseError) {
                console.error('❌ 데이터 파싱 실패:', parseError);
                data = content.data;
              }
            }
            
            console.log('🔔 최종 알림 데이터:', data);
            console.log('🔔 데이터 키들:', Object.keys(data));
            
            // 알림 타입 확인 - notifications.tsx와 동일한 우선순위
            // notifications.tsx: item.notification_type || data.type
            const notificationType = (content as any).notification_type || 
                                   data.type || 
                                   data.notification_type || 
                                   (content as any).type;
            
            console.log('🔔 알림 타입:', notificationType);
            console.log('🔔 알림 타입 체크 결과:', {
              'data.type': data.type,
              'data.notification_type': data.notification_type,
              'content.type': (content as any).type,
              'content.notification_type': (content as any).notification_type
            });
            
            // notifications.tsx와 동일한 방식으로 직접 네비게이션
            if (notificationType === 'comment' || 
                notificationType === 'heart' || 
                notificationType === 'reply' ||
                notificationType === 'my_post_comment' ||
                notificationType === 'my_post_heart' ||
                notificationType === 'my_post_hot') {
              // 게시글 관련 알림
              const postId = data.post_id || data.postId;
              if (postId) {
                let postUrl = `/pages/post-detail?id=${postId}`;
                
                // 대댓글 알림인 경우 댓글 ID도 포함
                if (notificationType === 'reply' && (data.comment_id || data.commentId)) {
                  const commentId = data.comment_id || data.commentId;
                  postUrl += `&comment_id=${commentId}`;
                }
                
                console.log('📄 게시글으로 이동:', postUrl);
                // 네비게이션 전 잠시 대기 후 replace 사용 (더 확실한 네비게이션)
                setTimeout(() => {
                  router.replace(postUrl as any);
                }, 500);
              } else {
                console.log('❌ 게시글 ID가 없음:', data);
              }
              
            } else if (notificationType === 'chat_message') {
              // 채팅 관련 알림 - notifications.tsx와 동일한 방식
              const roomId = data.room_id || data.roomId;
              if (roomId) {
                const roomType = data.room_type || data.roomType || 'dm';
                const chatUrl = `/pages/chat-room?id=${roomId}&type=${roomType}`;
                
                console.log('💬 채팅방으로 이동:', chatUrl);
                console.log('🔍 채팅 알림 상세 정보:', {
                  roomId,
                  roomType,
                  senderId: data.sender_id,
                  senderNickname: data.sender_nickname,
                  messageContent: data.message_content
                });
                
                // 네비게이션 전 잠시 대기 후 replace 사용 (더 확실한 네비게이션)
                setTimeout(() => {
                  router.replace(chatUrl as any);
                }, 500);
              } else {
                console.log('❌ 채팅방 ID가 없음:', data);
              }
            } else {
              console.log('❌ 알 수 없는 알림 타입:', notificationType);
              console.log('🔍 전체 알림 데이터:', JSON.stringify(data, null, 2));
              
              // 🧪 알 수 없는 타입이어도 홈으로 이동해보기 (테스트용)
              console.log('🧪 알 수 없는 알림 타입 - 홈으로 이동 시도');
              setTimeout(() => {
                router.replace('/' as any);
              }, 500);
            }
            
          } catch (error) {
            console.error('❌ 알림 클릭 처리 중 에러:', error);
            console.error('❌ 에러 스택:', (error as Error).stack);
          }
        });

        return () => {
          console.log('🔔 알림 핸들러 정리');
          notificationListener.remove();
          responseListener.remove();
        };
      } catch (error) {
        console.error('❌ 알림 핸들러 설정 실패:', error);
        return () => {};
      }
    };

    setupNotificationHandlers();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PenaltyNotification
        visible={showPenaltyNotification}
        onClose={() => setShowPenaltyNotification(false)}
      />
      <SuspensionModal
        visible={showSuspensionModal}
        onClose={() => setShowSuspensionModal(false)}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ErrorProvider>
          <AppContent />
        </ErrorProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
