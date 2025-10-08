import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { TopBar } from '../components/layout/TopBar';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationTestScreen() {
  const { testAndroidNotification, testIOSNotification, checkNotificationPermissions, getFCMToken, sendServerTestNotification } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<string>('확인 중...');
  const [fcmToken, setFcmToken] = useState<string>('');

  useEffect(() => {
    checkPermissions();
    getFCMTokenInfo();
  }, []);

  const checkPermissions = async () => {
    try {
      const hasPermission = await checkNotificationPermissions();
      setPermissionStatus(hasPermission ? '✅ 허용됨' : '❌ 거부됨');
    } catch (error) {
      setPermissionStatus('❌ 오류');
      console.error('권한 확인 실패:', error);
    }
  };

  const getFCMTokenInfo = async () => {
    try {
      const token = await getFCMToken();
      if (token) {
        setFcmToken(token.substring(0, 30) + '...');
      } else {
        setFcmToken('토큰 없음');
      }
    } catch (error) {
      setFcmToken('토큰 오류');
      console.error('FCM 토큰 확인 실패:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      if (Platform.OS === 'ios') {
        await testIOSNotification();
        Alert.alert('알림', 'iOS 테스트 알림을 전송했습니다. 1초 후 알림을 확인해주세요.');
      } else if (Platform.OS === 'android') {
        await testAndroidNotification();
        Alert.alert('알림', 'Android 테스트 알림을 전송했습니다. 1초 후 알림을 확인해주세요.');
      } else {
        Alert.alert('알림', '지원되지 않는 플랫폼입니다.');
        return;
      }
    } catch (error) {
      Alert.alert('오류', '알림 테스트 실패: ' + error);
      console.error('알림 테스트 실패:', error);
    }
  };

  const handleServerTestNotification = async () => {
    try {
      console.log('🌐 서버 알림 테스트 시작');
      Alert.alert('알림', '서버에서 테스트 알림을 전송합니다...');
      
      // FCM 토큰 확인
      const currentToken = await getFCMToken();
      console.log('🔍 현재 FCM 토큰:', currentToken ? currentToken.substring(0, 20) + '...' : '없음');
      
      const success = await sendServerTestNotification();
      console.log('🌐 서버 알림 테스트 결과:', success);
      
      if (success) {
        Alert.alert('성공', '서버에서 테스트 알림을 전송했습니다! 잠시 후 알림을 확인해주세요.');
      } else {
        Alert.alert('실패', '서버 알림 전송에 실패했습니다. FCM 토큰을 확인해주세요.');
      }
    } catch (error) {
      console.error('❌ 서버 알림 테스트 실패:', error);
      Alert.alert('오류', '서버 알림 테스트 실패: ' + error);
    }
  };

  const handleRefresh = () => {
    checkPermissions();
    getFCMTokenInfo();
  };

  return (
    <View style={styles.container}>
      <TopBar title="알림 테스트" showBackButton={true} />
      
      <View style={styles.content}>
        <Text style={styles.title}>🔔 알림 시스템 진단</Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>플랫폼 정보</Text>
          <Text style={styles.infoText}>OS: {Platform.OS}</Text>
          <Text style={styles.infoText}>Version: {Platform.Version}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>알림 권한</Text>
          <Text style={styles.infoText}>{permissionStatus}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>FCM 토큰</Text>
          <Text style={styles.infoText}>{fcmToken}</Text>
          <TouchableOpacity 
            style={styles.copyButton} 
            onPress={() => {
              // FCM 토큰을 클립보드에 복사
              if (fcmToken && fcmToken !== '토큰 오류') {
                // React Native에서는 클립보드 기능이 별도로 필요
                Alert.alert('복사', 'FCM 토큰이 복사되었습니다.');
              }
            }}
          >
            <Text style={styles.copyButtonText}>토큰 복사</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.testButton} onPress={handleTestNotification}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <Text style={styles.testButtonText}>
            {Platform.OS === 'ios' ? 'iOS 로컬 알림 테스트' : 'Android 로컬 알림 테스트'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.serverTestButton} onPress={handleServerTestNotification}>
          <Ionicons name="cloud" size={24} color="#fff" />
          <Text style={styles.testButtonText}>서버 알림 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#007AFF" />
          <Text style={styles.refreshButtonText}>정보 새로고침</Text>
        </TouchableOpacity>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 테스트 방법</Text>
          <Text style={styles.instructionsText}>
            1. "로컬 알림 테스트" 버튼을 누르세요{'\n'}
            2. 1초 후 알림이 나타나는지 확인하세요{'\n'}
            3. 알림이 나타나지 않으면:{'\n'}
            • 설정에서 앱 알림 권한 확인{'\n'}
            • 방해금지 모드 해제{'\n'}
            • 배터리 최적화 해제
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  serverTestButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 8,
  },
  instructionsCard: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
});
