import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from './userService';
import { router } from 'expo-router';

// 알림 데이터 타입 정의
interface NotificationData {
  type: string;
  title?: string;
  content?: string;
  post_title?: string;
  commenter?: string;
  message?: string;
  post_id?: string;  // 게시글 ID (문자열로 전송됨)
  alarm_id?: string;
  room_id?: string;  // 채팅방 ID
  room_type?: string;  // 채팅방 타입 (dm/group)
  sender_id?: string;  // 발신자 ID
  sender_nickname?: string;  // 발신자 닉네임
}

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('🔔 알림 핸들러 실행:', notification.request.content);
    
    // 중복 알림 방지를 위해 한 번만 처리
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export class NotificationService {
  private notificationIds = new Set<string>(); // 중복 알림 방지를 위한 ID 추적
  private listenersSetup = false; // 리스너 설정 상태 추적
  private foregroundSubscription: any = null;
  private backgroundSubscription: any = null;
  
  // 알림 권한 요청
  async requestPermissions(): Promise<boolean> {
    console.log('=== 알림 권한 요청 시작 ===');
    
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('기존 권한 상태:', existingStatus);
      
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('새로운 권한 상태:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ 알림 권한이 거부되었습니다.');
        return false;
      }
      
      console.log('✅ 알림 권한이 허용되었습니다.');
      return true;
    } else {
      console.log('❌ 실제 기기가 아닙니다.');
      return false;
    }
  }

  // Expo Push Token 획득
  async getFCMToken(): Promise<string | null> {
    console.log('=== Expo Push Token 획득 시작 ===');
    
    try {
      // 먼저 알림 권한 확인
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('⚠️ 알림 권한이 없어서 토큰을 발급받지 않습니다.');
        return null;
      }
      
      // Expo Push Token 획득
      const token = await this.getExpoPushToken();
      
      if (token) {
        console.log('✅ Expo Push Token 획득:', token);
        return token;
      } else {
        console.log('❌ Expo Push Token 획득 실패');
        return null;
      }
    } catch (error) {
      console.error('❌ FCM 토큰 획득 실패:', error);
      return null;
    }
  }

  // Expo Push Token 획득
  private async getExpoPushToken(): Promise<string | null> {
    try {
      console.log('Expo Push Token 획득 시도...');
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'b046f9bf-ef7a-4bd4-a9d0-74602416e381'
      });
      
      console.log('Expo Push Token 획득:', token.data);
      return token.data;
    } catch (error) {
      console.error('Expo Push Token 획득 실패:', error);
      return null;
    }
  }

  // FCM 토큰 업데이트
  async updateFCMToken(): Promise<void> {
    console.log('=== FCM 토큰 업데이트 시작 ===');
    
    try {
      const token = await this.getFCMToken();
      
      if (token) {
        console.log('✅ Expo Push Token 획득:', token);
        await userService.updateFCMToken(token);
        console.log('✅ FCM 토큰이 서버에 업데이트되었습니다.');
      } else {
        console.log('❌ Expo Push Token 획득 실패');
      }
    } catch (error) {
      console.error('❌ FCM 토큰 업데이트 실패:', error);
    }
  }

  // 알림 리스너 설정
  setupNotificationListeners(): void {
    console.log('=== Expo 알림 리스너 설정 시작 ===');
    
    // 이미 설정되어 있으면 중복 설정 방지
    if (this.listenersSetup) {
      console.log('⚠️ 알림 리스너가 이미 설정되어 있습니다.');
      return;
    }
    
    try {
      // 기존 리스너 정리
      this.cleanupListeners();
      
      // 포그라운드 알림 리스너
      this.foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('📱 Expo 포그라운드 알림 수신:', notification);
        this.handleNotification(notification.request.content.data as unknown as NotificationData);
      });

      // 백그라운드 알림 리스너
      this.backgroundSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('📱 Expo 백그라운드 알림 응답:', response);
        this.handleNotificationResponse(response.notification.request.content.data as unknown as NotificationData);
      });

      // 앱이 종료된 상태에서 알림을 탭했을 때
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) {
          console.log('📱 Expo 초기 알림:', response);
          this.handleNotificationResponse(response.notification.request.content.data as unknown as NotificationData);
        }
      });

      this.listenersSetup = true;
      console.log('✅ Expo 알림 리스너 설정 완료');
    } catch (error) {
      console.error('❌ 알림 리스너 설정 실패:', error);
    }
  }

  // 리스너 정리 함수
  cleanupListeners(): void {
    console.log('🧹 알림 리스너 정리');
    
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
    
    if (this.backgroundSubscription) {
      this.backgroundSubscription.remove();
      this.backgroundSubscription = null;
    }
    
    this.listenersSetup = false;
  }

  // 알림 수신 처리 (포그라운드에서 알림이 울렸을 때)
  private async handleNotification(data: NotificationData): Promise<void> {
    console.log('포그라운드 알림 데이터 처리:', data);
    
    // 중복 알림 방지 - 더 정확한 ID 생성
    const notificationId = `${data.type}_${data.alarm_id || data.title || Date.now()}`;
    console.log('알림 ID:', notificationId);
    
    if (this.notificationIds.has(notificationId)) {
      console.log('⚠️ 중복 알림 감지, 무시:', notificationId);
      return;
    }
    
    this.notificationIds.add(notificationId);
    console.log('✅ 새로운 알림 등록:', notificationId);
    
    // 10초 후 ID 제거 (메모리 정리)
    setTimeout(() => {
      this.notificationIds.delete(notificationId);
      console.log('🧹 알림 ID 정리:', notificationId);
    }, 10000);
    
    // 포그라운드에서는 알림만 표시하고 자동 네비게이션하지 않음
    // 사용자가 알림을 탭했을 때만 네비게이션하도록 함
    console.log('📱 포그라운드 알림 표시 완료 - 사용자가 알림을 탭할 때까지 대기');
  }

  // 데이터로부터 로컬 알림 생성
  private async createLocalNotificationFromData(data: NotificationData): Promise<void> {
    try {
      console.log('🔔 로컬 알림 생성 시작:', data);
      
      let title = '';
      let body = '';

      switch (data.type) {
        case 'alarm':
          title = data.title || '알람';
          body = data.message || '알람 시간입니다!';
          break;
        case 'my_post_comment':
          title = '내 게시글에 댓글이 달렸습니다';
          body = `'${data.post_title}'에 새로운 댓글이 달렸습니다.`;
          break;
        case 'my_post_heart':
          title = '내 게시글에 좋아요가 달렸습니다';
          body = `'${data.post_title}'에 좋아요가 달렸습니다.`;
          break;
        

        case 'news':
          title = data.title || '새로운 공지사항';
          body = data.content || '';
          break;
        case 'test':
          title = data.title || '테스트 알림';
          body = data.message || '테스트 메시지입니다.';
          break;
        default:
          title = data.title || '새로운 알림';
          body = data.message || '';
      }

      console.log('📝 알림 내용:', { title, body });

      const notificationContent = {
        content: {
          title: title,
          body: body,
          sound: 'default',
          data: data as unknown as Record<string, unknown>,
        },
        trigger: null, // 즉시 전송
      };

      console.log('📤 알림 전송:', notificationContent);

      await Notifications.scheduleNotificationAsync(notificationContent);

      console.log('✅ 로컬 알림 생성 완료:', title);
    } catch (error) {
      console.error('❌ 로컬 알림 생성 실패:', error);
      console.error('❌ 오류 상세:', error);
    }
  }



  // 알림 응답 처리 (사용자가 알림을 탭했을 때)
  private async handleNotificationResponse(data: NotificationData): Promise<void> {
    console.log('🔔 사용자가 알림을 탭함 - 네비게이션 시작:', data);
    
    // 여기서 알림 타입에 따라 적절한 화면으로 네비게이션
    switch (data.type) {
      case 'alarm':
        // 알람 목록 화면으로 이동
        console.log('📱 알람 목록 화면으로 이동');
        router.push('/pages/alarm-list' as any);
        break;
      case 'test':
        // 테스트 알림 - 특별한 처리 없음
        console.log('📱 테스트 알림을 탭했습니다.');
        break;
      case 'news':
        // 뉴스/공지사항 화면으로 이동
        console.log('📱 뉴스/공지사항 화면으로 이동');
        router.push('/pages/notifications' as any);
        break;
              case 'my_post_comment':
        case 'my_post_heart':
        case 'my_post_hot':
        case 'hot_post':
          // 내 게시글 화면으로 이동
          if (data.post_id) {
            console.log(`📱 내 게시글 화면으로 이동: 게시글 ID ${data.post_id}`);
            // post_id가 문자열로 전송되므로 그대로 사용
            router.push(`/pages/post-detail?id=${data.post_id}` as any);
          } else {
            console.log('📱 내 게시글 목록 화면으로 이동');
            router.push('/pages/my-posts' as any);
          }
          break;
        case 'chat_message':
          // 채팅방으로 이동
          if (data.room_id && data.room_type) {
            console.log(`📱 채팅방으로 이동: 방 ID ${data.room_id}, 타입 ${data.room_type}`);
            router.push(`/pages/chat-room?id=${data.room_id}&type=${data.room_type}` as any);
          } else {
            console.log('📱 채팅방 목록으로 이동 (room_id 또는 room_type 없음)');
            router.push('/pages/my-chats' as any);
          }
          break;



      default:
        console.log('📱 알 수 없는 알림 응답 타입:', data.type);
        // 기본적으로 알림 목록으로 이동
        console.log('📱 기본 알림 목록 화면으로 이동');
        router.push('/pages/notifications' as any);
    }
  }

  // 로컬 알림 전송 (테스트용)
  async sendLocalNotification(title: string, body: string): Promise<void> {
    console.log('=== 로컬 알림 전송 시작 ===');
    console.log('제목:', title);
    console.log('내용:', body);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        data: { type: 'test' },
      },
      trigger: null, // 즉시 전송
    });
    
    console.log('✅ 로컬 알림 전송 완료');
  }

  // 댓글 알림 시뮬레이션 (테스트용)
  async simulateCommentNotification(): Promise<void> {
    console.log('=== 댓글 알림 시뮬레이션 시작 ===');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '내 게시글에 댓글이 달렸습니다',
        body: "'테스트 게시글'에 새로운 댓글이 달렸습니다.",
        sound: 'default',
        data: { 
          type: 'my_post_comment',
          post_title: '테스트 게시글',
          post_id: '123'  // 테스트용 게시글 ID
        },
      },
      trigger: null, // 즉시 전송
    });
    
    console.log('✅ 댓글 알림 시뮬레이션 완료');
  }

  // 채팅 알림 시뮬레이션 (테스트용)
  async simulateChatNotification(): Promise<void> {
    console.log('=== 채팅 알림 시뮬레이션 시작 ===');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '테스트 사용자님의 메시지',
        body: '안녕하세요! 테스트 메시지입니다.',
        sound: 'default',
        data: { 
          type: 'chat_message',
          room_id: '3',
          room_type: 'dm',
          sender_id: '1',
          sender_nickname: '테스트 사용자',
          message_content: '안녕하세요! 테스트 메시지입니다.'
        },
      },
      trigger: null, // 즉시 전송
    });
    
    console.log('✅ 채팅 알림 시뮬레이션 완료');
  }

  // 좋아요 알림 시뮬레이션 (테스트용)
  async simulateHeartNotification(): Promise<void> {
    console.log('=== 좋아요 알림 시뮬레이션 시작 ===');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '내 게시글에 좋아요가 달렸습니다',
        body: "'테스트 게시글'에 좋아요가 달렸습니다.",
        sound: 'default',
        data: { 
          type: 'my_post_heart',
          post_title: '테스트 게시글',
          post_id: '123'  // 테스트용 게시글 ID
        },
      },
      trigger: null, // 즉시 전송
    });
    
    console.log('✅ 좋아요 알림 시뮬레이션 완료');
  }

  // 배지 카운트 초기화
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
    console.log('✅ 배지 카운트 초기화 완료');
  }
}

// 싱글톤 인스턴스 생성
export const notificationService = new NotificationService();
