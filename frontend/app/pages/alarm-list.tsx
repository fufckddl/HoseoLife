import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { alarmService, Alarm } from '../services/alarmService';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

export default function AlarmListScreen() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadAlarms();
      checkNotificationPermissions();
    }
  }, [isAuthenticated]);

  const checkNotificationPermissions = async () => {
    try {
      const hasPermission = await notificationService.requestPermissions();
      console.log('알림 권한 상태:', hasPermission);
      
      if (!hasPermission) {
        Alert.alert(
          '알림 권한 필요',
          '알람 기능을 사용하려면 알림 권한이 필요합니다. 설정에서 알림을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정으로 이동', onPress: () => {
              // 설정 앱으로 이동하는 로직 (필요시 구현)
            }}
          ]
        );
      }
    } catch (error) {
      console.error('알림 권한 확인 실패:', error);
    }
  };

  const testLocalNotification = async () => {
    try {
      await notificationService.sendLocalNotification(
        '테스트 알림',
        '로컬 알림이 정상적으로 작동합니다!'
      );
      Alert.alert('성공', '테스트 알림이 전송되었습니다.');
    } catch (error) {
      console.error('테스트 알림 실패:', error);
      Alert.alert('오류', '테스트 알림 전송에 실패했습니다.');
    }
  };

  const testServerNotification = async () => {
    try {
      const result = await alarmService.testAlarmNotification();
      Alert.alert('성공', result.message);
    } catch (error) {
      console.error('서버 알림 테스트 실패:', error);
      Alert.alert('오류', '서버 알림 테스트에 실패했습니다.');
    }
  };

  const loadAlarms = async () => {
    try {
      setLoading(true);
      const response = await alarmService.getUserAlarms();
      setAlarms(response.alarms);
    } catch (error) {
      console.error('알람 로드 실패:', error);
      Alert.alert('오류', '알람 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlarms();
    setRefreshing(false);
  };

  const handleToggleAlarm = async (alarm: Alarm) => {
    try {
      const updatedAlarm = await alarmService.toggleAlarm(alarm.id);
      setAlarms(prevAlarms =>
        prevAlarms.map(a => (a.id === alarm.id ? updatedAlarm : a))
      );
    } catch (error) {
      console.error('알람 토글 실패:', error);
      Alert.alert('오류', '알람 상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteAlarm = (alarm: Alarm) => {
    Alert.alert(
      '알람 삭제',
      `"${alarm.title}" 알람을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await alarmService.deleteAlarm(alarm.id);
              setAlarms(prevAlarms => prevAlarms.filter(a => a.id !== alarm.id));
            } catch (error) {
              console.error('알람 삭제 실패:', error);
              Alert.alert('오류', '알람 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleEditAlarm = (alarm: Alarm) => {
    router.push({
      pathname: '/pages/edit-alarm',
      params: { alarmId: alarm.id.toString() }
    });
  };

  const formatAlarmTime = (alarmTime: string) => {
    const date = new Date(alarmTime);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatRepeatDays = (repeatDays?: string) => {
    if (!repeatDays) return '일회성';
    
    const days = alarmService.parseRepeatDays(repeatDays);
    const dayNames = alarmService.getDayNames(days);
    return dayNames;
  };

  const renderAlarmItem = ({ item }: { item: Alarm }) => (
    <View style={styles.alarmItem}>
      <View style={styles.alarmInfo}>
        <View style={styles.alarmHeader}>
          <Text style={[styles.alarmTitle, !item.is_active && styles.inactiveText]}>
            {item.title}
          </Text>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggleAlarm(item)}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={item.is_active ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
        
        <Text style={[styles.alarmTime, !item.is_active && styles.inactiveText]}>
          {formatAlarmTime(item.alarm_time)}
        </Text>
        
        {item.message && (
          <Text style={[styles.alarmMessage, !item.is_active && styles.inactiveText]}>
            {item.message}
          </Text>
        )}
        
        <Text style={[styles.repeatInfo, !item.is_active && styles.inactiveText]}>
          {formatRepeatDays(item.repeat_days)}
        </Text>
      </View>
      
      <View style={styles.alarmActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditAlarm(item)}
        >
          <Ionicons name="pencil" size={20} color="#007AFF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteAlarm(item)}
        >
          <Ionicons name="trash" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>로그인이 필요합니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>알람</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testLocalNotification}
          >
            <Ionicons name="notifications" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testServerNotification}
          >
            <Ionicons name="server" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/pages/create-alarm')}
          >
            <Ionicons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.message}>알람을 불러오는 중...</Text>
        </View>
      ) : alarms.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alarm-outline" size={64} color="#8E8E93" />
          <Text style={styles.message}>설정된 알람이 없습니다.</Text>
          <TouchableOpacity
            style={styles.createFirstButton}
            onPress={() => router.push('/pages/create-alarm')}
          >
            <Text style={styles.createFirstButtonText}>첫 번째 알람 만들기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={alarms}
          renderItem={renderAlarmItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.alarmList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    padding: 8,
    marginRight: 8,
  },
  addButton: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  message: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
  },
  createFirstButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  alarmList: {
    flex: 1,
  },
  alarmItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 10,
  },
  alarmTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  alarmMessage: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  repeatInfo: {
    fontSize: 12,
    color: '#8E8E93',
  },
  inactiveText: {
    color: '#C7C7CC',
  },
  alarmActions: {
    flexDirection: 'row',
    marginLeft: 16,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
});
