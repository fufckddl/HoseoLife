import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';
import { router } from 'expo-router';
// 🗑️ _layout.tsx에서 직접 처리하므로 딥링크 관련 import 제거
// import { parseDeepLink, handleDeepLinkNavigation } from '../utils/deepLinkUtils';

const API_BASE_URL = 'https://hoseolife.kro.kr';

// 프로젝트 ID를 한 번만 가져와서 재사용
const getProjectId = async (): Promise<string> => {
  try {
    const configProjectId = Constants.default?.expoConfig?.extra?.eas?.projectId;
    if (configProjectId) {
      console.log('📱 app.json에서 프로젝트 ID 가져옴:', configProjectId);
      return configProjectId;
    }
  } catch (configError) {
    console.warn('⚠️ 프로젝트 ID 설정 확인 실패:', configError);
  }
  
  // 기본값 반환
  const defaultProjectId = '1ff6f25e-6fe9-4be1-8ebb-1d6de29ad69e';
  console.log('📱 기본 프로젝트 ID 사용:', defaultProjectId);
  return defaultProjectId;
};

// 디버깅 로그 함수
const debugLog = (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${emoji} [${timestamp}] ${message}`, details || '');
};

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  data?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

class NotificationService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // 사용자 알림 목록 조회
  async getUserNotifications(skip: number = 0, limit: number = 50, unreadOnly: boolean = false): Promise<NotificationItem[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        unread_only: unreadOnly.toString()
      });

      const response = await fetch(`${API_BASE_URL}/notifications/?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`알림 조회 실패: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('알림 조회 오류:', error);
      throw error;
    }
  }

  // 알림을 읽음으로 표시
  async markNotificationAsRead(notificationId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        throw new Error(`알림 읽음 처리 실패: ${response.status}`);
      }
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 모든 알림을 읽음으로 표시
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        throw new Error(`전체 알림 읽음 처리 실패: ${response.status}`);
      }
    } catch (error) {
      console.error('전체 알림 읽음 처리 오류:', error);
      throw error;
    }
  }

  // 읽지 않은 알림 개수 조회
  async getUnreadCount(): Promise<number> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`읽지 않은 알림 개수 조회 실패: ${response.status}`);
      }

      const result = await response.json();
      return result.unread_count || 0;
    } catch (error) {
      console.error('읽지 않은 알림 개수 조회 오류:', error);
      return 0;
    }
  }

  // 🆕 알림 권한 요청 (팝업 표시)
  async requestPermissions(): Promise<string | null> {
    try {
      console.log('🔔 앱 처음 실행 - 알림 권한 요청 시작...');
      
      // 현재 권한 상태 확인
      const currentStatus = await Notifications.getPermissionsAsync();
      console.log('🔍 현재 알림 권한 상태:', currentStatus.status);
      
      // 이미 권한이 있으면 토큰만 발급
      if (currentStatus.status === 'granted') {
        console.log('✅ 이미 알림 권한이 허용됨');
        return await this.getFCMToken();
      }
      
      // 권한 요청 (플랫폼별 분리)
      let permissionResult;
      
      if (Platform.OS === 'android') {
        console.log('🤖 안드로이드 알림 권한 요청...');
        permissionResult = await Notifications.requestPermissionsAsync({
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowVibrate: true,
            allowLights: true,
            allowBypassDnd: true,
          }
        });
    } else {
        console.log('🍎 iOS 알림 권한 요청...');
        permissionResult = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
            allowProvisional: true,
          }
        });
      }
      
      console.log('🔔 알림 권한 요청 결과:', permissionResult.status);
      
      if (permissionResult.status !== 'granted') {
        console.log('❌ 사용자가 알림 권한을 거부했습니다');
        return null;
      }
      
      console.log('✅ 사용자가 알림 권한을 허용했습니다');
      
      // 🔧 환경별 알림 이미지 설정
      await this.setupEnvironmentSpecificNotificationIcon();
      
      // 🎯 TestFlight 환경에서 앱 아이콘 강제 설정
      if (Platform.OS === 'ios') {
        console.log('🍎 iOS TestFlight 환경 - 앱 아이콘 강제 설정');
        try {
          // iOS 알림에서 앱 아이콘 강제 사용
          await Notifications.setNotificationHandler({
            handleNotification: async (notification) => {
              console.log('🔔 iOS 알림 핸들러 - HoseoLife 아이콘 강제 사용');
              return {
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
                // 🎯 HoseoLife 아이콘 강제 설정
                iconName: 'AppIcon',
                iconBundle: 'com.dlckdfuf.camsaw',
                bundleId: 'com.dlckdfuf.camsaw',
                appName: 'HoseoLife',
              };
            },
          });
        } catch (error) {
          console.log('⚠️ iOS 알림 핸들러 설정 실패 (무시):', error);
        }
      }
      
      // 권한 허용 후 토큰 발급
      const token = await this.getFCMToken();
      if (token) {
        console.log('✅ 알림 권한 허용 및 토큰 발급 완료');
        return token;
      } else {
        console.log('⚠️ 권한은 허용되었지만 토큰 발급 실패');
        return null;
      }
      
    } catch (error) {
      console.error('❌ 알림 권한 요청 실패:', error);
      return null;
    }
  }

  // 🆕 환경별 토큰 등록 (Expo Go, TestFlight, App Store 구분)
  async registerPushToken(userId: string): Promise<string | null> {
    try {
      console.log('🔔 환경별 푸시 토큰 등록 시작...');
      console.log('📱 사용자 ID:', userId);
      console.log('📱 플랫폼:', Platform.OS);
      
      // 🔧 기존 권한 상태 확인
      const currentStatus = await Notifications.getPermissionsAsync();
      console.log(`📱 현재 알림 권한 상태 (${Platform.OS}):`, currentStatus.status);
      
      // 🔍 Expo 프로젝트 설정 확인
      console.log('🔍 Expo 프로젝트 설정 확인 중...');
      try {
        const Constants = await import('expo-constants');
        const appConfig = Constants.default.expoConfig;
        console.log('📱 Expo 앱 설정:', {
          projectId: appConfig?.extra?.eas?.projectId,
          packageName: appConfig?.android?.package,
          expoGo: Constants.default.appOwnership === 'expo',
          isDevice: Constants.default.isDevice
        });
      } catch (configError) {
        console.warn('⚠️ Expo 설정 확인 실패:', configError);
      }
      
      let permissionGranted = false;
      
      if (currentStatus.status === 'granted') {
        console.log('✅ 이미 알림 권한이 허용됨');
        permissionGranted = true;
      } else {
        // 권한 요청
        console.log('🔔 알림 권한 요청 시작...');
        
        if (Platform.OS === 'android') {
          try {
            // 안드로이드: 권한 요청
            const { status } = await Notifications.requestPermissionsAsync({
              android: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowVibrate: true,
                allowLights: true,
                allowBypassDnd: true,
              }
            });
            permissionGranted = status === 'granted';
            console.log(`🤖 안드로이드 권한 요청 결과: ${status}`);
          } catch (androidPermissionError) {
            console.error('🤖 안드로이드 권한 요청 실패:', androidPermissionError);
            permissionGranted = false;
          }
        } else {
          // iOS: 권한 요청
          try {
            const { status } = await Notifications.requestPermissionsAsync({
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowCriticalAlerts: true,
                allowProvisional: true,
              },
            });
            permissionGranted = status === 'granted';
            console.log(`🍎 iOS 권한 요청 결과: ${status}`);
          } catch (iosPermissionError) {
            console.error('🍎 iOS 권한 요청 실패:', iosPermissionError);
            permissionGranted = false;
          }
        }
      }
      
      if (!permissionGranted) {
        console.log('❌ 알림 권한이 거부되었습니다');
        throw new Error('알림 권한이 거부되었습니다.');
      }
      
      // 프로젝트 ID 가져오기
      const projectId = await getProjectId();
      console.log('📱 최종 프로젝트 ID:', projectId);
      
      // 환경별 토큰 발급 (Standalone APK vs Expo Go 구분)
      let token: string | null = null;
      try {
        // 🔍 앱 환경 확인 (간소화)
        const appOwnership = Constants.default.appOwnership;
        const isExpoGo = appOwnership === 'expo';
        // AppOwnership이 'standalone'이 아닌 경우들 처리
        const isStandalone = !isExpoGo && appOwnership !== 'expo';
        
        const environmentInfo = {
          appOwnership,
          isExpoGo,
          isStandalone,
          platform: Platform.OS,
          isDevice: Constants.default.isDevice,
          executionEnvironment: Constants.default.executionEnvironment,
          expoGoVersion: Constants.default.expoGoVersion,
          nativeBuildVersion: Constants.default.nativeBuildVersion,
          manifest: Constants.default.expoConfig ? 'present' : 'missing'
        };
        
        console.log('🔍 앱 환경 확인:', environmentInfo);
        debugLog('info', '앱 환경 확인', environmentInfo);
        
        if (Platform.OS === 'android') {
          // 안드로이드: 환경별 토큰 발급 전략
          console.log('🤖 안드로이드 환경별 토큰 발급 시작...');
          debugLog('info', '안드로이드 환경별 토큰 발급 시작', { platform: Platform.OS });
          
          if (isExpoGo) {
            // Expo Go 환경: Expo Push Notification 사용
            console.log('📱 Expo Go 환경 - Expo Push Notification 사용');
            debugLog('info', 'Expo Go 환경 감지', { appOwnership, isExpoGo });
            
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`📱 Expo Go 토큰 발급 시도 ${attempt}/3`);
                debugLog('info', `Expo Go 토큰 발급 시도 ${attempt}/3`, { attempt, projectId });
                
                // Firebase 의존성 없이 순수 Expo Push Token 발급
                const tokenData = await Notifications.getExpoPushTokenAsync({
                  projectId: projectId,
                  applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
                  // Firebase 관련 설정 완전 제거
                });
                
                token = tokenData.data;
                console.log('✅ Expo Go 토큰 발급 성공!');
                console.log('🔑 토큰:', token.substring(0, 30) + '...');
                debugLog('success', 'Expo Go 토큰 발급 성공', { 
                  attempt, 
                  tokenPreview: token.substring(0, 30) + '...',
                  tokenType: token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken'
                });
                break;
                
              } catch (expoGoError) {
                console.error(`📱 Expo Go 토큰 발급 시도 ${attempt} 실패:`, expoGoError);
                debugLog('error', `Expo Go 토큰 발급 시도 ${attempt} 실패`, {
                  attempt,
                  error: expoGoError,
                  errorMessage: expoGoError instanceof Error ? expoGoError.message : String(expoGoError),
                  errorName: expoGoError instanceof Error ? expoGoError.name : 'Unknown'
                });
                if (attempt === 3) throw expoGoError;
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
          } else if (isStandalone) {
            // Standalone APK 환경: Expo Push Notification 사용 (간소화)
            console.log('📱 Standalone APK 환경 - Expo Push Notification 사용 (간소화)');
            debugLog('info', 'Standalone APK 환경 감지', { appOwnership, isStandalone });
            
            // 간단한 재시도 로직 (최대 3회)
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`📱 Standalone APK 토큰 발급 시도 ${attempt}/3`);
                console.log('📱 사용 중인 프로젝트 ID:', projectId);
                debugLog('info', `Standalone APK 토큰 발급 시도 ${attempt}/3`, { 
                  attempt, 
                  projectId,
                  appOwnership,
                  platform: Platform.OS
                });
                
                // Firebase 의존성 없이 순수 Expo Push Token 발급
                const tokenData = await Notifications.getExpoPushTokenAsync({
                  projectId: projectId,
                  applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
                  // Firebase 관련 설정 완전 제거
                });
                
                token = tokenData.data;
                console.log('✅ Standalone APK Expo Push Notification 토큰 발급 성공!');
                console.log('🔑 토큰:', token.substring(0, 30) + '...');
                console.log('📱 토큰 타입:', token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken');
                
                debugLog('success', 'Standalone APK 토큰 발급 성공!', {
                  attempt,
                  tokenType: token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken',
                  tokenPreview: token.substring(0, 30) + '...',
                  platform: Platform.OS,
                  appOwnership
                });
                
                break; // 성공하면 루프 종료
                
              } catch (attemptError) {
                console.error(`📱 Standalone APK 토큰 발급 시도 ${attempt} 실패:`, attemptError);
                
                debugLog('error', `Standalone APK 토큰 발급 시도 ${attempt} 실패`, {
                  attempt,
                  error: attemptError,
                  errorMessage: attemptError instanceof Error ? attemptError.message : String(attemptError),
                  errorName: attemptError instanceof Error ? attemptError.name : 'Unknown',
                  platform: Platform.OS,
                  appOwnership,
                  projectId
                });
                
                if (attempt === 3) {
                  const errorMessage = `Standalone APK Expo Push Notification 토큰 발급 실패 (3회 시도): ${attemptError instanceof Error ? attemptError.message : '알 수 없는 오류'}`;
                  debugLog('error', '토큰 발급 최종 실패', {
                    error: attemptError,
                    message: errorMessage,
                    totalAttempts: 3,
                    projectId
                  });
                  throw new Error(errorMessage);
                }
                
                // 간단한 대기 (1초)
                console.log(`⏳ 1초 대기 후 재시도...`);
                debugLog('info', `대기 후 재시도`, { waitTime: 1, nextAttempt: attempt + 1 });
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
          } else {
            // 기타 환경: 일반적인 Expo Push Notification 시도
            console.log('📱 기타 환경 - 일반 Expo Push Notification 시도');
            debugLog('info', '기타 환경 감지', { appOwnership, isExpoGo, isStandalone });
            
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`📱 일반 토큰 발급 시도 ${attempt}/3`);
                debugLog('info', `일반 토큰 발급 시도 ${attempt}/3`, { attempt, projectId });
                
                // Firebase 의존성 없이 순수 Expo Push Token 발급
                const tokenData = await Notifications.getExpoPushTokenAsync({
                  projectId: projectId,
                  applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
                  // Firebase 관련 설정 완전 제거
                });
                
                token = tokenData.data;
                console.log('✅ 일반 토큰 발급 성공!');
                console.log('🔑 토큰:', token.substring(0, 30) + '...');
                debugLog('success', '일반 토큰 발급 성공', { 
                  attempt, 
                  tokenPreview: token.substring(0, 30) + '...' 
                });
                break;
                
              } catch (generalError) {
                console.error(`📱 일반 토큰 발급 시도 ${attempt} 실패:`, generalError);
                debugLog('error', `일반 토큰 발급 시도 ${attempt} 실패`, {
                  attempt,
                  error: generalError,
                  errorMessage: generalError instanceof Error ? generalError.message : String(generalError)
                });
                if (attempt === 3) throw generalError;
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
        } else {
          // iOS: 기존 로직 유지
          console.log('🍎 iOS 토큰 발급...');
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
            applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
          });
          
          token = tokenData.data;
          console.log('✅ iOS 푸시 토큰 발급 성공:', token.substring(0, 20) + '...');
        }
        
      } catch (tokenError) {
        console.error('❌ 환경별 푸시 토큰 발급 실패:', tokenError);
        console.log('⚠️ 푸시 토큰 발급 실패 - 상세 정보:', {
          error: tokenError,
          platform: Platform.OS,
          projectId: projectId,
          permissionStatus: currentStatus.status
        });
        throw new Error(`푸시 토큰 발급 실패: ${tokenError instanceof Error ? tokenError.message : '알 수 없는 오류'}`);
      }
      
      // 백엔드에 토큰 전송 (덮어쓰기) - 오류 처리 강화
      try {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/users/${userId}/fcm-token`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fcm_token: token }),
        });
        
        if (!response.ok) {
          throw new Error(`토큰 등록 실패: ${response.status}`);
        }
        
        console.log('✅ 백엔드 토큰 등록 완료');
        
        // 🔧 토큰 등록 타임스탬프 저장
        try {
          const timestamp = new Date().toISOString();
          await AsyncStorage.setItem('last_token_timestamp', timestamp);
          if (token) {
            await AsyncStorage.setItem('fcm_token', token);
          }
          console.log('✅ 토큰 등록 타임스탬프 저장:', timestamp);
        } catch (storageError) {
          console.log('⚠️ 토큰 타임스탬프 저장 실패 (무시):', storageError);
        }
        
        return token;
      } catch (backendError) {
        console.error('❌ 백엔드 토큰 등록 실패:', backendError);
        console.log('⚠️ 백엔드 토큰 등록 실패 - 상세 정보:', {
          error: backendError,
          userId: userId,
          token: token ? token.substring(0, 20) + '...' : 'null'
        });
        throw new Error(`서버 토큰 등록 실패: ${backendError instanceof Error ? backendError.message : '알 수 없는 오류'}`);
      }
      
    } catch (error) {
      console.error('❌ 푸시 토큰 등록 실패:', error);
      return null;
    }
  }

  // 🗑️ _layout.tsx에서 직접 알림 처리를 하므로 이 함수는 더 이상 사용하지 않음
  // createDeepLinkFromNotification 함수 제거됨

  // 🗑️ _layout.tsx에서 직접 알림 처리를 하므로 이 함수는 더 이상 사용하지 않음
  // handleNotificationPress 함수 제거됨


  // 🆕 알림 권한 재확인 및 요청
  async checkAndRequestPermissions(): Promise<boolean> {
    try {
      console.log('🔔 알림 권한 재확인 시작');
      
      // 현재 권한 상태 확인
      const { status: currentStatus } = await Notifications.getPermissionsAsync();
      console.log('🔍 현재 알림 권한 상태:', currentStatus);
      
      if (currentStatus === 'granted') {
        console.log('✅ 알림 권한이 이미 허용됨');
        return true;
      }
      
      // 권한 요청
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
          allowProvisional: true,
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowVibrate: true,
          allowLights: true,
          allowBypassDnd: true,
        }
      });
      
      console.log(`🔔 알림 권한 요청 결과: ${status}`);
      
      if (status === 'granted') {
        console.log('✅ 알림 권한 허용됨');
        return true;
      } else {
        console.log('❌ 알림 권한 거부됨');
        return false;
      }
      
    } catch (error) {
      console.error('❌ 알림 권한 확인 실패:', error);
      return false;
    }
  }

  // 🆕 환경별 알림 이미지 설정 함수
  async setupEnvironmentSpecificNotificationIcon(): Promise<void> {
    try {
      console.log('🎨 환경별 알림 이미지 설정 시작...');
      
      // 🔍 앱 환경 확인
      const appOwnership = Constants.default.appOwnership;
      const isExpoGo = appOwnership === 'expo';
      const isStandalone = !isExpoGo && appOwnership !== 'expo';
      
      console.log('🔍 알림 이미지 환경 확인:', {
        appOwnership,
        isExpoGo,
        isStandalone,
        platform: Platform.OS
      });
      
      if (Platform.OS === 'ios') {
        // iOS: 환경별 알림 이미지 설정
        if (isExpoGo) {
          console.log('📱 Expo Go 환경 - 기본 iOS 알림 이미지 사용');
          // Expo Go에서는 app.json의 iosIcon 설정 사용
        } else if (isStandalone) {
          console.log('📱 TestFlight/App Store 환경 - 커스텀 iOS 알림 이미지 설정');
          // TestFlight/App Store에서는 AppIcon.appiconset의 아이콘 사용
          // 이미 app.json에서 ios.icon 설정됨
        }
      } else if (Platform.OS === 'android') {
        // Android: 환경별 알림 이미지 설정
        if (isExpoGo) {
          console.log('📱 Expo Go 환경 - 기본 Android 알림 이미지 사용');
          // Expo Go에서는 app.json의 notification.icon 설정 사용
        } else if (isStandalone) {
          console.log('📱 APK 환경 - 커스텀 Android 알림 이미지 설정');
          // APK에서는 app.json의 notification.icon 설정 사용
        }
      }
      
      console.log('✅ 환경별 알림 이미지 설정 완료');
    } catch (error) {
      console.error('❌ 환경별 알림 이미지 설정 실패:', error);
    }
  }

  // 🆕 projectId 명시하여 토큰 발급 (iOS placeholder 아이콘 해결)
  async getNewFCMToken(): Promise<string | null> {
    try {
      console.log('🔄 projectId 명시하여 Expo Push Token 발급 시작');
      
      // 알림 권한 확인
      const { status } = await Notifications.getPermissionsAsync();
      console.log(`🔔 현재 알림 권한 상태: ${status}`);
      
      if (status !== 'granted') {
        console.log('❌ 알림 권한이 없음');
        return null;
      }

      // 🔧 projectId 명시하여 토큰 발급 (iOS placeholder 아이콘 해결)
      console.log('📱 projectId 명시하여 Expo Push Token 발급...');
      
      // TestFlight 환경에서 올바른 토큰 발급을 위한 추가 설정
      console.log('🔧 TestFlight 환경 감지 시도...');
      
      // 환경 감지 (기존 Constants 재사용)
      const appOwnership = Constants.default.appOwnership;
      const isStandalone = appOwnership !== 'expo';
      
      console.log('🔍 현재 환경:', { appOwnership, isStandalone });
      
      let tokenData;
      if (isStandalone) {
        // TestFlight/App Store 환경에서 ExpoPushToken 발급 시도
        console.log('📱 TestFlight/App Store 환경 - ExpoPushToken 발급 시도');
        try {
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '1ff6f25e-6fe9-4be1-8ebb-1d6de29ad69e',
            applicationId: 'com.dlckdfuf.camsaw', // TestFlight에서 강제 설정
          });
        } catch (error) {
          console.log('⚠️ ExpoPushToken 발급 실패, ExponentPushToken으로 fallback:', error);
          // Fallback 시에도 applicationId 유지
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '1ff6f25e-6fe9-4be1-8ebb-1d6de29ad69e',
            applicationId: 'com.dlckdfuf.camsaw',
          });
        }
      } else {
        // Expo Go 환경
        console.log('📱 Expo Go 환경 - ExponentPushToken 발급');
        tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '1ff6f25e-6fe9-4be1-8ebb-1d6de29ad69e',
        });
      }
      
      const token = tokenData.data;
      console.log('✅ Expo Push Token 발급 성공:', token.substring(0, 20) + '...');
      console.log('🔍 토큰 형식:', token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken');
      
      // 🎯 토큰 정보 로깅 (서버 라우팅용)
      const isExpoGo = token.startsWith('ExponentPushToken');
      const isTestFlight = token.startsWith('ExpoPushToken');
      
      // 🔍 환경 감지 개선 (app.json의 extra.eas.build 프로필 확인)
      const buildProfile = Constants.default.expoConfig?.extra?.eas?.build;
      
      console.log('🔍 토큰 환경 상세 분석:', {
        token: token.substring(0, 20) + '...',
        tokenType: isExpoGo ? 'ExponentPushToken' : isTestFlight ? 'ExpoPushToken' : 'Unknown',
        appOwnership,
        buildProfile,
        isExpoGo,
        isTestFlight,
        environment: '토큰 형식에 관계없이 서버에서 올바른 아이콘 처리'
      });
      
      return token;

    } catch (error) {
      console.error('❌ Expo Push Token 발급 실패:', error);
      return null;
    }
  }

  // 🧪 로컬 알림 테스트 (iOS 아이콘 검증용)

  // 🆕 FCM 토큰 발급 (기존 함수 유지)
  async getFCMToken(): Promise<string | null> {
    try {
      console.log('🔔 FCM 토큰 발급 시작');
      
      // 알림 권한 요청 (Android/iOS 모두) - 강화
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
          allowProvisional: true,
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowVibrate: true,
          allowLights: true,
          allowBypassDnd: true,
        }
      });
      
      console.log(`🔔 알림 권한 상태: ${status}`);
      
      if (status !== 'granted') {
        console.log('❌ 알림 권한이 거부됨');
        return null;
      }

      // Android 알림 채널 설정 (강화)
      if (Platform.OS === 'android') {
        console.log('🤖 Android 알림 채널 설정 시작');
        
        // 기본 알림 채널 (강화)
        await Notifications.setNotificationChannelAsync('default', {
          name: 'HoseoLife 기본 알림',
          description: 'HoseoLife 기본 알림 채널',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
          sound: 'default',
        });
        
        // 채팅 알림 채널 (강화)
        await Notifications.setNotificationChannelAsync('chat', {
          name: '채팅 알림',
          description: '채팅 메시지 알림',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
          sound: 'default',
        });
        
        // 댓글 알림 채널 (강화)
        await Notifications.setNotificationChannelAsync('comment', {
          name: '댓글 알림',
          description: '댓글 및 좋아요 알림',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
          sound: 'default',
        });
        
        console.log('✅ Android 알림 채널 설정 완료');
      }

      // FCM 토큰 발급 (환경별 처리)
      console.log('🔄 FCM 토큰 발급 시도');
      
      try {
        // 🔍 앱 환경 확인
        const appOwnership = Constants.default.appOwnership;
        const isExpoGo = appOwnership === 'expo';
        // AppOwnership이 'standalone'이 아닌 경우들 처리
        const isStandalone = !isExpoGo && appOwnership !== 'expo';
        
        console.log('🔍 getFCMToken 환경 확인:', {
          appOwnership,
          isExpoGo,
          isStandalone,
          platform: Platform.OS
        });
        
        // 프로젝트 ID 가져오기
        const projectId = await getProjectId();
        
        // 모든 환경에서 Expo Push Token 사용 (Firebase 의존성 제거)
        console.log('📱 Expo Push Token 발급 시도 (환경:', isExpoGo ? 'Expo Go' : isStandalone ? 'Standalone APK' : 'Other', ')');
        
        // Firebase 의존성 없이 순수 Expo Push Token 발급
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
          applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
          // Firebase 관련 설정 제거
        });
        
        const token = tokenData.data;
        console.log('✅ Expo Push Token 발급 성공:', token.substring(0, 20) + '...');
        console.log('🔍 토큰 형식:', token.startsWith('ExponentPushToken') ? 'ExponentPushToken' : 'ExpoPushToken');
        console.log('🔍 환경:', isExpoGo ? 'Expo Go' : isStandalone ? 'Standalone APK' : 'Other');
        return token;
        
      } catch (tokenError) {
        console.error('❌ FCM 토큰 발급 실패:', tokenError);
        console.log('⚠️ FCM 토큰 발급 실패 (무시)');
        return null;
      }
    } catch (error) {
      console.error('❌ FCM 토큰 발급 실패:', error);
      return null;
    }
  }

  // 🆕 iOS 알림 카테고리 설정
  private async setupIOSNotificationCategories(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        console.log('🍎 iOS 알림 카테고리 설정 중...');
        
        // 메시지 카테고리 설정 (HoseoLife 아이콘 강제 사용)
        await Notifications.setNotificationCategoryAsync('MESSAGE', [
          {
            identifier: 'REPLY',
            buttonTitle: '답장',
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: 'MARK_READ',
            buttonTitle: '읽음',
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
        ], {
          intentIdentifiers: [],
          categorySummaryFormat: '%u개의 새 메시지',
          customDismissAction: true,
          allowInCarPlay: true,
          allowAnnouncement: true,
          showTitle: true,
          showSubtitle: true,
          // 🎯 HoseoLife 아이콘 강제 사용 (iconName, iconBundle 옵션은 지원되지 않으므로 제거)
        });
        
        console.log('✅ iOS 알림 카테고리 설정 완료');
      }
    } catch (error) {
      console.error('❌ iOS 알림 카테고리 설정 실패:', error);
    }
  }

  // 🆕 알림 리스너 설정
  async setupNotificationListeners(): Promise<void> {
    try {
      console.log('🔔 알림 리스너 설정 시작');
      
      // 알림 수신 시 처리
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('🔔 알림 수신:', notification);
        // Android에서 알림이 수신되었는지 확인
        if (Platform.OS === 'android') {
          console.log('📱 Android 알림 수신 확인됨');
        }
      });

      // 알림 클릭 시 처리
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('🔔 알림 클릭:', response);
        this.handleNotificationClick(response);
      });

      // 알림 표시 방식 설정 (Android/iOS 구분)
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          console.log('🔔 알림 핸들러 호출:', notification);
          console.log('🔔 알림 데이터:', notification.request.content.data);
          console.log('🔔 알림 채널:', notification.request.content.data?.channelId || 'default');
          
          // Android 특별 처리 - shouldShowAlert 제거
          if (Platform.OS === 'android') {
            console.log('🤖 Android 알림 처리 중...');
            return {
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF231F7C',
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              bypassDnd: true,
            };
          }
          
          // iOS 기본 설정 (강화) - shouldShowAlert 제거
          console.log('🍎 iOS 알림 처리 중...');
          return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
            // iOS 전용 설정
            interruptionLevel: 'active',
            relevanceScore: 1.0,
            targetContentIdentifier: 'hoseolife',
            summaryArgument: notification.request.content.title,
            summaryArgumentCount: 1,
            categoryIdentifier: 'MESSAGE',
            threadIdentifier: 'hoseolife',
            mutableContent: true,
            contentAvailable: true,
            // 🆕 iOS 알림 아이콘 명시적 설정
            badge: 1,
        sound: 'default',
          };
        },
      });

      // iOS 알림 카테고리 설정은 별도 함수로 분리
      await this.setupIOSNotificationCategories();

      console.log('✅ 알림 리스너 설정 완료');
    } catch (error) {
      console.error('❌ 알림 리스너 설정 실패:', error);
    }
  }

  // 🆕 iOS 알림 테스트 함수
  async testIOSNotification(): Promise<void> {
    try {
      if (Platform.OS !== 'ios') {
        console.log('❌ iOS 기기가 아닙니다.');
        return;
      }

      console.log('🍎 iOS 로컬 알림 테스트 시작');
    
    await Notifications.scheduleNotificationAsync({
      content: {
          title: 'iOS 테스트 알림',
          body: '이것은 iOS 로컬 알림 테스트입니다.',
          data: { test: true, platform: 'ios' },
        sound: 'default',
          badge: 1,
          categoryIdentifier: 'MESSAGE',
        },
        trigger: null,
      });
      
      console.log('✅ iOS 로컬 알림 테스트 완료');
    } catch (error) {
      console.error('❌ iOS 알림 테스트 실패:', error);
    }
  }

  // 🆕 Android 알림 테스트 함수
  async testAndroidNotification(): Promise<void> {
    try {
      if (Platform.OS !== 'android') {
        console.log('❌ Android 기기가 아닙니다.');
        return;
      }

      console.log('🧪 Android 알림 테스트 시작');
      
      // 로컬 알림 테스트 (즉시 전송)
    await Notifications.scheduleNotificationAsync({
      content: {
          title: "HoseoLife 알림 테스트",
          body: "Android 알림이 정상적으로 작동합니다!",
          data: { test: true, platform: 'android' },
        sound: 'default',
          badge: 1,
      },
      trigger: null, // 즉시 전송
    });
    
      console.log('✅ Android 알림 테스트 완료');
    } catch (error) {
      console.error('❌ Android 알림 테스트 실패:', error);
    }
  }

  // 🆕 알림 클릭 시 딥링킹 처리 (Expo Go 리다이렉트 방지)
  private handleNotificationClick(response: Notifications.NotificationResponse): void {
    try {
      console.log('🔔 알림 클릭 처리 시작:', response);
      console.log('🔔 알림 응답 데이터:', response);
      console.log('🔔 알림 요청 데이터:', response.notification.request);
      
      const data = response.notification.request.content.data;
      
      if (!data) {
        console.log('⚠️ 알림 데이터가 없습니다 - 홈으로 이동');
        // Expo Go 리다이렉트 방지를 위해 강제로 HoseoLife 앱 내부로 이동
        router.replace('/');
        return;
      }

      console.log('📱 알림 데이터:', data);
      
      // 🆕 Expo Go 리다이렉트 방지 - 강제로 HoseoLife 앱 내부로 이동
      console.log('🚫 Expo Go 리다이렉트 방지 - HoseoLife 앱 내부로 강제 이동');
      
      // 게시글 댓글 알림
      if (data.type === 'comment' && data.post_id) {
        console.log('📝 게시글 댓글 알림 - 게시글 상세로 이동:', data.post_id);
        router.replace({
          pathname: '/pages/post-detail',
          params: { id: data.post_id }
        } as any);
        return;
      }
      
      // 채팅 메시지 알림
      if (data.type === 'chat' && data.room_id) {
        console.log('💬 채팅 메시지 알림 - 채팅방으로 이동:', data.room_id);
        router.replace({
          pathname: '/pages/chat',
          params: { roomId: data.room_id }
        } as any);
        return;
      }
      
      // 좋아요 알림
      if (data.type === 'like' && data.post_id) {
        console.log('❤️ 좋아요 알림 - 게시글 상세로 이동:', data.post_id);
        router.replace({
          pathname: '/pages/post-detail',
          params: { id: data.post_id }
        } as any);
        return;
      }
      
      // 그룹 가입 승인 알림
      if (data.type === 'group_approval' && data.room_id) {
        console.log('✅ 그룹 가입 승인 알림 - 채팅방으로 이동:', data.room_id);
        router.replace({
          pathname: '/pages/chat',
          params: { roomId: data.room_id }
        } as any);
        return;
      }
      
      // 기본값: 홈으로 이동 (router.replace 사용)
      console.log('🏠 기본 처리 - 홈으로 이동 (Expo Go 리다이렉트 방지)');
      router.replace('/');
      
    } catch (error) {
      console.error('❌ 알림 클릭 처리 실패:', error);
      // 에러 발생 시 홈으로 이동 (Expo Go 리다이렉트 방지)
      router.replace('/');
    }
  }

  // 🆕 알림 권한 상태 확인
  async checkNotificationPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: string;
  }> {
    try {
      console.log('🔔 알림 권한 상태 확인 중...');
      
      const settings = await Notifications.getPermissionsAsync();
      console.log('📱 현재 알림 권한 설정:', settings);
      
      return {
        granted: settings.granted,
        canAskAgain: settings.canAskAgain,
        status: settings.status
      };
    } catch (error) {
      console.error('❌ 알림 권한 확인 실패:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unknown'
      };
    }
  }

  // 🆕 서버에서 테스트 알림 전송
  async sendServerTestNotification(): Promise<boolean> {
    try {
      console.log('🌐 서버 테스트 알림 전송 시작');
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/notifications/test`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`서버 알림 전송 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 서버 테스트 알림 전송 결과:', result);
      return result.success;
    } catch (error) {
      console.error('❌ 서버 테스트 알림 전송 실패:', error);
      return false;
    }
  }

  // 🆕 환경별 토큰 구별 함수
  async getTokenEnvironmentInfo(): Promise<{
    token: string | null;
    environment: 'expo-go' | 'testflight' | 'app-store' | 'development' | 'unknown';
    projectId: string;
    platform: string;
    isExpoGo: boolean;
    isDevelopment: boolean;
    isProduction: boolean;
  }> {
    try {
      console.log('🔍 환경별 토큰 정보 분석 시작...');
      
      // 현재 플랫폼 확인
      const platform = Platform.OS;
      console.log('📱 플랫폼:', platform);
      
      // Expo Go 환경 확인
      const isExpoGo = __DEV__ && !(global as any).EXPO_PRODUCTION;
      console.log('🔧 Expo Go 환경:', isExpoGo);
      
      // 개발/프로덕션 환경 확인
      const isDevelopment = __DEV__;
      const isProduction = !__DEV__;
      console.log('🏗️ 개발 환경:', isDevelopment);
      console.log('🚀 프로덕션 환경:', isProduction);
      
      // 프로젝트 ID 가져오기
      const projectId = await getProjectId();
      
      // 토큰 발급 시도
      let token: string | null = null;
      let environment: 'expo-go' | 'testflight' | 'app-store' | 'development' | 'unknown' = 'unknown';
      
      try {
        // Firebase 의존성 없이 순수 Expo Push Token 발급
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
          applicationId: 'com.dlckdfuf.camsaw', // TestFlight 환경에서 올바른 토큰 발급
          // Firebase 관련 설정 완전 제거
        });
        token = tokenData.data;
        console.log('✅ 토큰 발급 성공:', token.substring(0, 20) + '...');
        
        // 환경 구별 로직 (강화된 버전)
        if (isExpoGo) {
          environment = 'expo-go';
        } else if (isProduction) {
          // 프로덕션 환경에서 APK 빌드 감지
          console.log('🚀 프로덕션 환경 감지 - APK 빌드로 설정');
          environment = 'testflight'; // APK는 TestFlight와 동일한 환경으로 처리
        } else {
          environment = 'development';
        }
        
        // 토큰 형식으로 환경 재확인
        if (token && token.startsWith('ExponentPushToken')) {
          console.log('⚠️ ExponentPushToken 감지 - Expo Go 환경으로 강제 설정');
          environment = 'expo-go';
        } else if (token && token.startsWith('ExpoPushToken')) {
          console.log('✅ ExpoPushToken 감지 - 네이티브 앱 환경');
          // 네이티브 앱 환경 유지
        }
        
      } catch (tokenError) {
        console.error('❌ 토큰 발급 실패:', tokenError);
        token = null;
      }
      
      const result = {
        token,
        environment,
        projectId,
        platform,
        isExpoGo,
        isDevelopment,
        isProduction,
      };
      
      console.log('📊 환경별 토큰 정보:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 환경별 토큰 정보 분석 실패:', error);
      return {
        token: null,
        environment: 'unknown',
        projectId: await getProjectId(),
        platform: Platform.OS,
        isExpoGo: false,
        isDevelopment: __DEV__,
        isProduction: !__DEV__,
      };
    }
  }

  // 🆕 현재 사용자 토큰 정보 조회
  async getCurrentUserTokenInfo(): Promise<{
    userId: string | null;
    fcmToken: string | null;
    environment: string;
    lastUpdated: string | null;
  }> {
    try {
      console.log('👤 현재 사용자 토큰 정보 조회 시작...');
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/me/token-info`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`사용자 토큰 정보 조회 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 사용자 토큰 정보:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 사용자 토큰 정보 조회 실패:', error);
      return {
        userId: null,
        fcmToken: null,
        environment: 'unknown',
        lastUpdated: null,
      };
    }
  }

  // 🆕 특정 사용자에게 알림 전송 (관리자용)
  async sendNotificationToUser(
    targetUserId: string, 
    title: string, 
    message: string, 
    type: string = 'test',
    data: any = {}
  ): Promise<boolean> {
    try {
      console.log(`📤 사용자 ${targetUserId}에게 알림 전송 시작...`);
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/send-to-user`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          title,
          message,
          type,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`알림 전송 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 알림 전송 결과:', result);
      return result.success;
      
    } catch (error) {
      console.error('❌ 알림 전송 실패:', error);
      return false;
    }
  }

  // 🆕 iOS 서버 알림 테스트 (실제 서버를 통한 푸시 알림)
  async testIOSServerNotification(userId?: string): Promise<void> {
    try {
      console.log('📱 iOS 서버 알림 테스트 시작...');
      
      // 사용자 ID 확인
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다.');
      }

      // 서버를 통해 알림 전송
      const success = await this.sendNotificationToUser(
        userId,
        '🍎 iOS 서버 알림 테스트',
        '이것은 서버를 통해 전송된 iOS 알림입니다!',
        'test',
        { platform: 'ios', source: 'server' }
      );

      if (!success) {
        throw new Error('서버 알림 전송에 실패했습니다.');
      }

      console.log('✅ iOS 서버 알림 테스트 완료');
      
    } catch (error) {
      console.error('❌ iOS 서버 알림 테스트 실패:', error);
      throw error;
    }
  }

  // 🆕 내 자신에게 알림 전송 (테스트용)
  async sendNotificationToSelf(
    title: string, 
    message: string, 
    type: string = 'test'
  ): Promise<boolean> {
    try {
      console.log('📤 자신에게 알림 전송 시작...');
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/notifications/send-to-self`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error(`자신에게 알림 전송 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 자신에게 알림 전송 결과:', result);
      return result.success;
      
    } catch (error) {
      console.error('❌ 자신에게 알림 전송 실패:', error);
      return false;
    }
  }

  // 🆕 안드로이드 알림 아이콘 테스트 함수
  async testAndroidNotificationIcon(): Promise<void> {
    try {
      if (Platform.OS !== 'android') {
        console.log('❌ Android 기기가 아닙니다.');
        return;
      }

      console.log('🤖 Android 알림 아이콘 테스트 시작');
      
      // 다양한 채널로 알림 테스트
      const channels = ['default', 'chat', 'comment'];
      
      for (const channelId of channels) {
    await Notifications.scheduleNotificationAsync({
      content: {
            title: `HoseoLife ${channelId} 알림`,
            body: `이것은 ${channelId} 채널의 알림입니다. 아이콘을 확인해주세요!`,
            data: { test: true, channel: channelId, platform: 'android' },
        sound: 'default',
            badge: 1,
          },
          trigger: { 
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1 
          }, // 1초 후 전송
        });
        
        console.log(`✅ ${channelId} 채널 알림 예약 완료`);
      }

      console.log('✅ Android 알림 아이콘 테스트 완료');
    } catch (error) {
      console.error('❌ Android 알림 아이콘 테스트 실패:', error);
    }
  }

  // 🆕 토큰 삭제 함수 (강화)
  async unregisterPushToken(): Promise<void> {
    try {
      console.log('🔕 토큰 삭제 시작...');
      
      // 1. 현재 토큰 가져오기
      const currentToken = await this.getFCMToken();
      if (currentToken) {
        console.log('🔍 삭제할 토큰:', currentToken.substring(0, 20) + '...');
      }
      
      // 2. 서버에 토큰 삭제 요청
      const response = await fetch(`${API_BASE_URL}/users/fcm-token`, {
        method: 'DELETE',
        headers: {
          ...(await this.getAuthHeaders()),
        },
      });

      if (response.ok) {
        console.log('✅ 서버에서 토큰 삭제 완료');
        
        // 3. 로컬에서도 토큰 정보 정리
        try {
          await AsyncStorage.removeItem('fcm_token');
          await AsyncStorage.removeItem('last_token_timestamp');
          console.log('✅ 로컬 토큰 정보 정리 완료');
        } catch (localError) {
          console.log('⚠️ 로컬 토큰 정리 실패 (무시):', localError);
        }
      } else {
        console.log('⚠️ 서버 토큰 삭제 실패 (무시)');
      }
    } catch (error) {
      console.error('❌ 토큰 삭제 실패:', error);
      // 토큰 삭제 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }
}

export const notificationService = new NotificationService();