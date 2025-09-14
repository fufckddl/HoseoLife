import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PenaltyNotification from './components/PenaltyNotification';
import SuspensionModal from './components/SuspensionModal';
import ErrorBoundary from './components/ErrorBoundary';
import { ErrorProvider } from './contexts/ErrorContext';
import { setupDeepLinkListener } from './utils/deepLinkUtils';

function AppContent() {
  const { 
    showPenaltyNotification, 
    setShowPenaltyNotification,
    showSuspensionModal,
    setShowSuspensionModal,
    updateFCMToken,
    getFCMToken
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

  // FCM 토큰 설정
  useEffect(() => {
    const setupFCMToken = async () => {
      try {
        // 실제 FCM 토큰 발급
        const token = await getFCMToken();
        if (token) {
          await updateFCMToken(token);
          console.log('FCM 토큰 설정 완료');
        } else {
          console.log('FCM 토큰 발급 실패');
        }
      } catch (error) {
        console.error('FCM 토큰 설정 실패:', error);
      }
    };

    setupFCMToken();
  }, [getFCMToken, updateFCMToken]);

  // 딥링크 리스너 설정
  useEffect(() => {
    console.log('🔗 딥링크 리스너 설정 시작');
    const cleanup = setupDeepLinkListener();
    
    return () => {
      console.log('🔗 딥링크 리스너 정리');
      cleanup();
    };
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
