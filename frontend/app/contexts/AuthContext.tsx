import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService, UserInfo } from '../services/userService';
import { reportService } from '../services/reportService';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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

  // 인증 상태가 변경될 때마다 처벌 확인
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('인증 상태 변경됨, 처벌 확인 시작');
      setTimeout(() => checkUserPenalties(), 1000);
    }
  }, [isAuthenticated, user]);

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
        console.log('자동 로그인 성공:', userInfo.nickname);
        setIsAuthenticated(true);
        setUser(userInfo);
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
        setIsAuthenticated(true);
        setUser(userInfo);
        console.log('로그인 성공:', userInfo.nickname);
        
        // FCM 토큰 발급 및 업데이트
        try {
          const fcmToken = await getFCMToken();
          if (fcmToken) {
            await updateFCMToken(fcmToken);
            console.log('FCM 토큰 발급 및 업데이트 완료');
          }
        } catch (fcmError) {
          console.error('FCM 토큰 발급 실패:', fcmError);
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
      await userService.logout();
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
      
      // 정지 상태 확인 (임시 정지 또는 영구 정지)
      const suspensionPenalties = penalties.filter(penalty => 
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
      const warningPenalties = penalties.filter(penalty => 
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
      if (user) {
        await userService.updateFCMToken(token);
        console.log('FCM 토큰 업데이트 완료');
      }
    } catch (error) {
      console.error('FCM 토큰 업데이트 실패:', error);
    }
  };

  const getFCMToken = async (): Promise<string | null> => {
    try {
      // 알림 권한 요청
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('알림 권한이 거부되었습니다.');
        return null;
      }

      // Expo Push Token 발급
      const expoToken = await Notifications.getExpoPushTokenAsync({
        projectId: 'b046f9bf-ef7a-4bd4-a9d0-74602416e381', // Expo 프로젝트 ID
      });
      
      console.log('Expo Push Token 발급 성공:', expoToken.data);
      
      // Expo Push Token을 FCM 토큰으로 변환
      const fcmToken = await convertExpoTokenToFCM(expoToken.data);
      
      if (fcmToken) {
        console.log('FCM 토큰 변환 성공:', fcmToken);
        return fcmToken;
      } else {
        console.log('FCM 토큰 변환 실패, Expo Push Token 사용');
        return expoToken.data;
      }
    } catch (error) {
      console.error('FCM 토큰 발급 실패:', error);
      return null;
    }
  };

  const convertExpoTokenToFCM = async (expoToken: string): Promise<string | null> => {
    try {
      // Expo 서버를 통해 FCM 토큰으로 변환
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: expoToken,
          title: '토큰 변환 테스트',
          body: 'FCM 토큰 변환을 위한 테스트 메시지',
        }),
      });

      if (response.ok) {
        // Expo Push Token을 그대로 사용 (FCM 토큰으로 자동 변환됨)
        return expoToken;
      } else {
        console.log('Expo 토큰 변환 실패, 원본 토큰 사용');
        return expoToken;
      }
    } catch (error) {
      console.error('토큰 변환 중 오류:', error);
      return expoToken; // 실패 시 원본 토큰 사용
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    try {
      if (user) {
        await userService.updateNotificationSettings(enabled);
        setNotificationsEnabled(enabled);
        console.log(`알림 설정이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
      }
    } catch (error) {
      console.error('알림 설정 업데이트 실패:', error);
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 