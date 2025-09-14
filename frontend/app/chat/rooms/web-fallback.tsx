import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function WebFallback() {
  const { shareCode } = useLocalSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [roomInfo, setRoomInfo] = useState<{
    name: string;
    description?: string;
    member_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 채팅방 정보 가져오기
    const fetchRoomInfo = async () => {
      try {
        if (!shareCode || typeof shareCode !== 'string') {
          setError('유효하지 않은 공유 링크입니다');
          setLoading(false);
          return;
        }

        const response = await fetch(`https://hoseolife.kro.kr/chat/rooms/share/${shareCode}/info`);
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || '채팅방 정보를 가져올 수 없습니다');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setRoomInfo(data);
      } catch (error) {
        console.error('채팅방 정보 조회 실패:', error);
        setError('채팅방 정보를 가져올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomInfo();

    // 카운트다운 타이머
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 5초 후 네이버로 이동
          Linking.openURL('https://naver.com');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [shareCode]);

  const handleAppStoreRedirect = () => {
    // 앱스토어 링크 (현재는 네이버로 대체)
    Linking.openURL('https://naver.com');
  };

  const handleRetryApp = async () => {
    try {
      // 앱이 설치되어 있는지 확인
      const canOpenApp = await Linking.canOpenURL('camsaw://');
      
      if (canOpenApp) {
        // 앱으로 이동
        const appUrl = `camsaw://chat/rooms/${shareCode}`;
        Linking.openURL(appUrl);
      } else {
        // 앱이 설치되어 있지 않음 - 네이버로 이동
        Linking.openURL('https://naver.com');
      }
    } catch (error) {
      console.error('앱 확인 실패:', error);
      // 오류 발생 시 네이버로 이동
      Linking.openURL('https://naver.com');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubbles" size={80} color="#007AFF" />
          </View>
          <Text style={styles.title}>호서라이프</Text>
          <Text style={styles.subtitle}>채팅방 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" size={80} color="#FF6B6B" />
          </View>
          <Text style={styles.title}>오류 발생</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAppStoreRedirect}>
            <Ionicons name="storefront" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>앱 설치하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubbles" size={80} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>호서라이프</Text>
        <Text style={styles.subtitle}>그룹 채팅방에 초대되었습니다</Text>
        
        {/* 채팅방 정보 표시 */}
        {roomInfo && (
          <View style={styles.roomInfoContainer}>
            <Text style={styles.roomName}>{roomInfo.name}</Text>
            {roomInfo.description && (
              <Text style={styles.roomDescription}>{roomInfo.description}</Text>
            )}
            <View style={styles.memberCountContainer}>
              <Ionicons name="people" size={16} color="#666" />
              <Text style={styles.memberCountText}>{roomInfo.member_count}명 참여 중</Text>
            </View>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRetryApp}>
            <Ionicons name="phone-portrait" size={20} color="white" />
            <Text style={styles.primaryButtonText}>앱에서 열기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAppStoreRedirect}>
            <Ionicons name="storefront" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>앱 설치하기</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.countdownText}>
          {countdown}초 후 네이버로 이동합니다
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  countdownText: {
    marginTop: 32,
    fontSize: 14,
    color: '#999',
  },
  roomInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roomName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  roomDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  memberCountText: {
    fontSize: 14,
    color: '#666',
  },
});
