import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { userService } from '../../services/userService';
import { notificationService } from '../../services/notificationService';

export default function TestNotificationScreen() {
  const [loading, setLoading] = useState(false);

  const handleTestNotification = async () => {
    setLoading(true);
    try {
      const result = await userService.sendTestNotification();
      Alert.alert('성공', '테스트 알림이 전송되었습니다.');
      console.log('테스트 알림 결과:', result);
    } catch (error) {
      Alert.alert('오류', '테스트 알림 전송에 실패했습니다.');
      console.error('테스트 알림 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotificationToAll = async () => {
    setLoading(true);
    try {
      const result = await userService.sendTestNotificationToAll();
      Alert.alert('성공', '모든 사용자에게 테스트 알림이 전송되었습니다.');
      console.log('전체 테스트 알림 결과:', result);
    } catch (error) {
      Alert.alert('오류', '전체 테스트 알림 전송에 실패했습니다.');
      console.error('전체 테스트 알림 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalNotification = async () => {
    try {
      await notificationService.sendLocalNotification('테스트 알림', '로컬 알림이 정상적으로 작동합니다!');
      Alert.alert('성공', '로컬 알림이 전송되었습니다.');
    } catch (error) {
      Alert.alert('오류', '로컬 알림 전송에 실패했습니다.');
      console.error('로컬 알림 오류:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>알림 테스트</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          푸시 알림 기능을 테스트할 수 있습니다.
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleTestNotification}
          disabled={loading}
        >
          <Ionicons name="notifications" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>나에게 테스트 알림 보내기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleTestNotificationToAll}
          disabled={loading}
        >
          <Ionicons name="people" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>모든 사용자에게 테스트 알림 보내기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.localButton]}
          onPress={handleLocalNotification}
        >
          <Ionicons name="phone-portrait" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>로컬 알림 테스트 (백엔드 없음)</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 알림 테스트 가이드</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>로컬 알림 테스트</Text>: 백엔드 없이 즉시 테스트 가능{'\n'}
            • <Text style={styles.bold}>나에게 테스트</Text>: 현재 로그인한 사용자에게만{'\n'}
            • <Text style={styles.bold}>전체 테스트</Text>: 모든 사용자에게 전송{'\n'}
            • <Text style={styles.bold}>Android 기기</Text>에서 테스트하면 APNs 인증서 없이도 작동
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  localButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoBox: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: '#000000',
  },
});
