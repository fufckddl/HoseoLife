import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService, UserInfo } from '../services/userService';
import { reportService } from '../services/reportService';
import { notificationService } from '../services/notificationService';
import * as Notifications from 'expo-notifications';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
  showPenaltyNotification: boolean;
  setShowPenaltyNotification: (show: boolean) => void;
  showSuspensionModal: boolean;
  setShowSuspensionModal: (show: boolean) => void;
  isSuspended: boolean;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  checkUserPenalties: () => Promise<void>;
  markPenaltyNotificationAsShown: () => Promise<void>;
  updateFCMToken: (token: string) => Promise<void>;
  getFCMToken: () => Promise<string | null>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  loadNotificationSettings: () => Promise<void>;
  deactivateAccount: () => Promise<void>; // 🆕 회원탈퇴 함수 추가
  testAndroidNotification: () => Promise<void>; // 🆕 Android 알림 테스트
  testIOSNotification: () => Promise<void>; // 🆕 iOS 알림 테스트
  checkNotificationPermissions: () => Promise<boolean>; // 🆕 알림 권한 확인
  sendServerTestNotification: () => Promise<boolean>; // 🆕 서버 알림 테스트
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  try {
    const context = useContext(AuthContext);
    if (!context) {
      console.error('❌ useAuth must be used within an AuthProvider');
      // 기본값 반환하여 앱 크래시 방지
      return {
        isAuthenticated: false,
        user: null,
        loading: false,
        showPenaltyNotification: false,
        setShowPenaltyNotification: () => {},
        showSuspensionModal: false,
        setShowSuspensionModal: () => {},
        isSuspended: false,
        notificationsEnabled: false,
        setNotificationsEnabled: () => {},
        login: async () => {},
        logout: async () => {},
        checkAuthStatus: async () => {},
        checkUserPenalties: async () => {},
        markPenaltyNotificationAsShown: async () => {},
        updateFCMToken: async () => {},
        getFCMToken: async () => null,
        toggleNotifications: async () => {},
        loadNotificationSettings: async () => {},
        deactivateAccount: async () => {}, // 🆕 회원탈퇴 함수 추가
        testAndroidNotification: async () => {}, // 🆕 Android 알림 테스트
        testIOSNotification: async () => {}, // 🆕 iOS 알림 테스트
        checkNotificationPermissions: async () => false, // 🆕 알림 권한 확인
        sendServerTestNotification: async () => false, // 🆕 서버 알림 테스트
      };
    }
    
    // context의 모든 속성이 정의되어 있는지 확인
    const requiredProps = [
      'isAuthenticated', 'user', 'loading', 'showPenaltyNotification',
      'setShowPenaltyNotification', 'showSuspensionModal', 'setShowSuspensionModal',
      'isSuspended', 'notificationsEnabled', 'setNotificationsEnabled',
      'login', 'logout', 'checkAuthStatus', 'checkUserPenalties',
        'markPenaltyNotificationAsShown', 'updateFCMToken', 'getFCMToken',
        'toggleNotifications', 'loadNotificationSettings', 'deactivateAccount', // 🆕 추가
        'testAndroidNotification', 'testIOSNotification', 'checkNotificationPermissions', 'sendServerTestNotification' // 🆕 추가
    ] as const;
    
    for (const prop of requiredProps) {
      if ((context as any)[prop] === undefined) {
        console.error(`❌ useAuth: ${prop} is undefined`);
      }
    }
    
    return context;
  } catch (error) {
    console.error('❌ useAuth 오류 발생:', error);
    if (error instanceof Error) {
      console.error('❌ 오류 스택:', error.stack);
    }
    // 기본값 반환
    return {
      isAuthenticated: false,
      user: null,
      loading: false,
      showPenaltyNotification: false,
      setShowPenaltyNotification: () => {},
      showSuspensionModal: false,
      setShowSuspensionModal: () => {},
      isSuspended: false,
      notificationsEnabled: false,
      setNotificationsEnabled: () => {},
      login: async () => {},
      logout: async () => {},
      checkAuthStatus: async () => {},
      checkUserPenalties: async () => {},
      markPenaltyNotificationAsShown: async () => {},
      updateFCMToken: async () => {},
      getFCMToken: async () => null,
      toggleNotifications: async () => {},
      loadNotificationSettings: async () => {},
      deactivateAccount: async () => {}, // 🆕 회원탈퇴 함수 추가
      testAndroidNotification: async () => {}, // 🆕 Android 알림 테스트
      testIOSNotification: async () => {}, // 🆕 iOS 알림 테스트
      checkNotificationPermissions: async () => false, // 🆕 알림 권한 확인
      sendServerTestNotification: async () => false, // 🆕 서버 알림 테스트
    };
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPenaltyNotification, setShowPenaltyNotification] = useState(false);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // 앱 시작 시 자동 로그인 확인
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 인증 상태가 변경될 때마다 처벌 확인 (안전하게 처리)
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('인증 상태 변경됨, 처벌 확인 시작');
      setTimeout(() => {
        try {
          checkUserPenalties();
        } catch (error) {
          console.error('❌ 처벌 확인 실패 (무시):', error);
        }
      }, 1000);
    }
  }, [isAuthenticated, user]);

  // 알림 리스너 설정 (안전하게 처리)
  useEffect(() => {
    if (isAuthenticated) {
      const setupListeners = async () => {
        try {
          console.log('🔔 알림 리스너 설정 시작');
          await notificationService.setupNotificationListeners();
          console.log('✅ 알림 리스너 설정 완료');
        } catch (error) {
          console.error('❌ 알림 리스너 설정 실패 (무시):', error);
          // 알림 리스너 설정 실패는 앱의 핵심 기능이 아니므로 무시
        }
      };
      
      setupListeners();
    }
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      console.log('자동 로그인 상태 확인 중...');
      setLoading(true);
      
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.log('저장된 토큰이 없음');
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      // 토큰이 있으면 서버에 유효성 확인
      const isValid = await userService.isAuthenticated();
      if (isValid) {
        console.log('토큰이 유효함, 사용자 정보 가져오기');
        const userInfo = await userService.getCurrentUserInfo();
              if (userInfo) {
        // 사용자 ID 저장
        await AsyncStorage.setItem('user_id', userInfo.id.toString());
        
        console.log('자동 로그인 성공:', userInfo.nickname);
        setIsAuthenticated(true);
        setUser(userInfo);
        
        // FCM 토큰 발급 및 업데이트 (안전하게 처리)
        try {
          console.log('🔔 FCM 토큰 발급 시작');
          const fcmToken = await getFCMToken();
          if (fcmToken) {
            await updateFCMToken(fcmToken);
            console.log('✅ FCM 토큰 발급 및 업데이트 완료');
          } else {
            console.log('⚠️ FCM 토큰 발급 실패 또는 권한 없음 (무시)');
          }
        } catch (fcmError) {
          console.error('❌ FCM 토큰 발급 실패 (무시):', fcmError);
          // FCM 토큰 발급 실패는 앱의 핵심 기능이 아니므로 무시
        }


        
      } else {
        console.log('사용자 정보 가져오기 실패');
        await logout();
      }
      } else {
        console.log('토큰이 유효하지 않음');
        await logout();
      }
    } catch (error) {
      console.error('자동 로그인 확인 실패:', error);
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('로그인 시도:', email);
      const loginResponse = await userService.login(email, password);
      
      // 로그인 성공 후 사용자 정보 가져오기
      const userInfo = await userService.getCurrentUserInfo();
      
      if (userInfo) {
        // 사용자 ID 저장
        await AsyncStorage.setItem('user_id', userInfo.id.toString());
        
        setIsAuthenticated(true);
        setUser(userInfo);
        console.log('로그인 성공:', userInfo.nickname);
        
        // 로그인 후 알림 권한 요청 및 토큰 등록 (안전하게 처리)
        try {
          console.log('🔔 로그인 후 알림 권한 요청 시작');
          
          // notificationService import
          const { notificationService } = await import('../services/notificationService');
          
          // 🔧 기존 권한 상태 확인 후 필요시에만 요청
          const { status } = await Notifications.getPermissionsAsync();
          console.log('🔍 로그인 시 현재 알림 권한 상태:', status);
          
          if (status === 'granted') {
            // 이미 권한이 있으면 토큰만 등록
            console.log('✅ 이미 알림 권한이 허용됨 - 토큰 등록만 진행');
            await notificationService.registerPushToken(userInfo.id.toString());
            console.log('✅ 토큰 등록 완료');
          } else {
            // 권한이 없으면 권한 요청 후 토큰 등록
            console.log('🔔 알림 권한 요청 시작');
            const token = await notificationService.requestPermissions();
            if (token) {
              // 권한 허용 시 토큰 등록
              await notificationService.registerPushToken(userInfo.id.toString());
              console.log('✅ 알림 권한 허용 및 토큰 등록 완료');
            } else {
              console.log('⚠️ 알림 권한 거부 또는 토큰 발급 실패 (무시)');
            }
          }
        } catch (notificationError) {
          console.error('❌ 알림 권한 요청 실패 (무시):', notificationError);
          // 알림 권한 요청 실패는 앱의 핵심 기능이 아니므로 무시
        }


        
      } else {
        throw new Error('사용자 정보를 가져올 수 없습니다.');
      }
    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('로그아웃 처리 중...');
      
      // 🆕 FCM 토큰 정리 (서버에서 토큰 제거)
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (token && user) {
          console.log('FCM 토큰 서버에서 제거 중...');
          await userService.clearFCMToken();
        }
      } catch (fcmError) {
        console.error('FCM 토큰 정리 실패 (무시):', fcmError);
      }
      
      await userService.logout();
      // 사용자 ID도 삭제
      await AsyncStorage.removeItem('user_id');
      
      setIsAuthenticated(false);
      setUser(null);
      setShowPenaltyNotification(false);
      console.log('로그아웃 완료');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const checkUserPenalties = async () => {
    try {
      if (!isAuthenticated || !user) {
        console.log('인증되지 않은 상태, 처벌 확인 건너뜀');
        return;
      }
      
      console.log('사용자 처벌 확인 중...');
      const penalties = await reportService.getUserActivePenalties();
      console.log('조회된 처벌:', penalties.length, '개');
      
      // 현재 시간 기준으로 유효한 처벌만 필터링
      const now = new Date();
      const validPenalties = penalties.filter(penalty => {
        // 영구정지는 항상 유효
        if (penalty.penalty_type === '영구정지') {
          return true;
        }
        
        // 임시정지는 end_date가 있고, 아직 만료되지 않은 것만
        if (penalty.penalty_type === '임시정지' && penalty.end_date) {
          const endDate = new Date(penalty.end_date);
          return endDate > now;
        }
        
        // 경고는 항상 유효 (is_active가 true인 것만)
        if (penalty.penalty_type === '경고') {
          return penalty.is_active;
        }
        
        return false;
      });
      
      console.log('유효한 처벌:', validPenalties.length, '개');
      
      // 정지 상태 확인 (임시 정지 또는 영구 정지)
      const suspensionPenalties = validPenalties.filter(penalty => 
        penalty.penalty_type === '임시정지' || penalty.penalty_type === '영구정지'
      );
      
      if (suspensionPenalties.length > 0) {
        console.log('정지 상태 발견:', suspensionPenalties.length, '개');
        setIsSuspended(true);
        
        // 이미 정지 알림을 확인했는지 확인
        const suspensionNotificationShown = await AsyncStorage.getItem(`suspension_notification_shown_${user.id}`);
        if (suspensionNotificationShown !== 'true') {
          setShowSuspensionModal(true);
        }
        return;
      } else {
        setIsSuspended(false);
      }
      
      // 일반 처벌 알림 (경고 등)
      const warningPenalties = validPenalties.filter(penalty => 
        penalty.penalty_type === '경고'
      );
      
      if (warningPenalties.length > 0) {
        // 이미 처벌 알림을 확인했는지 확인
        const penaltyNotificationShown = await AsyncStorage.getItem(`penalty_notification_shown_${user.id}`);
        if (penaltyNotificationShown !== 'true') {
          console.log('일반 처벌 발견:', warningPenalties.length, '개');
          setShowPenaltyNotification(true);
        }
      }
    } catch (error) {
      console.error('사용자 처벌 확인 실패:', error);
    }
  };

  const markPenaltyNotificationAsShown = async () => {
    try {
      if (user) {
        await AsyncStorage.setItem(`penalty_notification_shown_${user.id}`, 'true');
        console.log('처벌 알림 확인 상태 저장됨');
      }
    } catch (error) {
      console.error('처벌 알림 확인 상태 저장 실패:', error);
    }
  };

  const updateFCMToken = async (token: string) => {
    try {
      // 🔧 인증 상태와 토큰 유효성 확인
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!isAuthenticated || !user || !accessToken) {
        console.log('인증되지 않은 상태, FCM 토큰 업데이트 건너뜀');
        return;
      }

      await userService.updateFCMToken(token);
      console.log('FCM 토큰 업데이트 완료');
    } catch (error) {
      console.error('FCM 토큰 업데이트 실패:', error);
      // 401 오류인 경우 로그아웃 처리
      if (error instanceof Error && error.message.includes('401')) {
        console.log('FCM 토큰 업데이트 중 인증 오류, 로그아웃 처리');
        await logout();
      }
    }
  };

  const getFCMToken = async (): Promise<string | null> => {
    try {
      console.log('🔔 getFCMToken 호출됨');
      return await notificationService.getFCMToken();
    } catch (error) {
      console.error('FCM 토큰 발급 실패:', error);
      return null;
    }
  };



    const toggleNotifications = async (enabled: boolean) => {
      try {
        if (user) {
          if (enabled) {
            // 알림 켜기: 권한 요청 + 새 토큰 발급 및 등록
            console.log('🔔 알림 활성화: 권한 요청 및 새 토큰 발급 시작...');
            
            // 🔧 기존 권한 상태 확인
            const { status } = await Notifications.getPermissionsAsync();
            console.log('🔍 현재 알림 권한 상태:', status);
          
          if (status !== 'granted') {
            // 권한이 없으면 권한 요청
            console.log('🔔 알림 권한 요청 시작...');
            const token = await notificationService.requestPermissions();
            if (!token) {
              throw new Error('알림 권한이 거부되었습니다.');
            }
          }
          
                // 🔧 새 토큰 발급 및 등록 (기존 토큰 삭제 후)
                
                // 1. 먼저 기존 토큰 삭제
                try {
                  await notificationService.unregisterPushToken();
                  console.log('🗑️ 기존 토큰 삭제 완료');
                } catch (deleteError) {
                  console.log('⚠️ 기존 토큰 삭제 실패 (무시):', deleteError);
                }
                
                // 2. 잠시 대기 (토큰 삭제 완료 대기)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 3. 새 토큰 발급 및 등록
                const registeredToken = await notificationService.registerPushToken(user.id.toString());
                if (!registeredToken) {
                  throw new Error('Expo Push Notification 새 토큰 발급에 실패했습니다. 네트워크 연결과 Expo 서비스 상태를 확인해주세요.');
                }
                
                console.log('✅ 새 Expo Push Notification 토큰 등록 완료:', registeredToken.substring(0, 20) + '...');
        } else {
          // 알림 끄기: 토큰 삭제
          console.log('🔕 알림 비활성화: 토큰 삭제 시작...');
          await notificationService.unregisterPushToken();
          console.log('✅ 토큰 삭제 완료');
        }
        
        // 서버 설정 업데이트
        await userService.updateNotificationSettings(enabled);
        setNotificationsEnabled(enabled);
        console.log(`알림 설정이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
      }
        } catch (error) {
          console.error('알림 설정 업데이트 실패:', error);
          throw error; // 에러를 다시 던져서 UI에서 처리할 수 있도록
        }
  };

  const loadNotificationSettings = async () => {
    try {
      if (user) {
        const settings = await userService.getNotificationSettings();
        setNotificationsEnabled(settings.notifications_enabled);
        console.log(`알림 설정 로드: ${settings.notifications_enabled ? '활성화' : '비활성화'}`);
      }
    } catch (error) {
      console.error('알림 설정 로드 실패:', error);
    }
  };

  // 🆕 회원탈퇴 함수
  const deactivateAccount = async () => {
    try {
      console.log('🗑️ 회원탈퇴 처리 시작');
      
      if (!isAuthenticated || !user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      // 서버에 회원탈퇴 요청
      const result = await userService.deactivateAccount();
      console.log('✅ 회원탈퇴 서버 처리 완료:', result);
      
      // 로컬 상태 정리 (로그아웃과 동일)
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('user_id');
      
      setIsAuthenticated(false);
      setUser(null);
      setShowPenaltyNotification(false);
      setShowSuspensionModal(false);
      
      console.log('✅ 회원탈퇴 완료 - 로컬 상태 정리됨');
    } catch (error) {
      console.error('❌ 회원탈퇴 실패:', error);
      throw error;
    }
  };

  // 🆕 Android 알림 테스트 함수
  const testAndroidNotification = async () => {
    try {
      await notificationService.testAndroidNotification();
    } catch (error) {
      console.error('❌ Android 알림 테스트 실패:', error);
    }
  };

  // 🆕 iOS 알림 테스트 함수
  const testIOSNotification = async () => {
    try {
      await notificationService.testIOSNotification();
    } catch (error) {
      console.error('❌ iOS 알림 테스트 실패:', error);
    }
  };

  // 🆕 알림 권한 확인 함수
  const checkNotificationPermissions = async (): Promise<boolean> => {
    try {
      const result = await notificationService.checkNotificationPermissions();
      // result: { granted: boolean; canAskAgain: boolean; status: string; }
      return !!result.granted;
    } catch (error) {
      console.error('❌ 알림 권한 확인 실패:', error);
      return false;
    }
  };

  // 🆕 서버 알림 테스트 함수
  const sendServerTestNotification = async (): Promise<boolean> => {
    try {
      return await notificationService.sendServerTestNotification();
    } catch (error) {
      console.error('❌ 서버 알림 테스트 실패:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    showPenaltyNotification,
    setShowPenaltyNotification,
    showSuspensionModal,
    setShowSuspensionModal,
    isSuspended,
    notificationsEnabled,
    setNotificationsEnabled,
    login,
    logout,
    checkAuthStatus,
    checkUserPenalties,
    markPenaltyNotificationAsShown,
    updateFCMToken,
    getFCMToken,
    toggleNotifications,
    loadNotificationSettings,
    deactivateAccount, // 🆕 회원탈퇴 함수 추가
    testAndroidNotification, // 🆕 Android 알림 테스트
    testIOSNotification, // 🆕 iOS 알림 테스트
    checkNotificationPermissions, // 🆕 알림 권한 확인
    sendServerTestNotification, // 🆕 서버 알림 테스트
  };

  // value 객체의 모든 속성이 정의되어 있는지 확인
  console.log('🔧 AuthProvider value 생성:', {
    isAuthenticated: value.isAuthenticated,
    user: value.user ? 'defined' : 'null',
    loading: value.loading,
    login: typeof value.login,
    logout: typeof value.logout,
    updateFCMToken: typeof value.updateFCMToken,
    getFCMToken: typeof value.getFCMToken,
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 