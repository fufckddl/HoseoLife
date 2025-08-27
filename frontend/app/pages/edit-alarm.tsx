import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { alarmService, Alarm } from '../services/alarmService';

export default function EditAlarmScreen() {
  const { alarmId } = useLocalSearchParams<{ alarmId: string }>();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [alarmTime, setAlarmTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isRepeated, setIsRepeated] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [vibration, setVibration] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const router = useRouter();

  const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

  useEffect(() => {
    if (alarmId) {
      loadAlarm();
    }
  }, [alarmId]);

  const loadAlarm = async () => {
    try {
      setInitialLoading(true);
      const alarmData = await alarmService.getAlarm(parseInt(alarmId));
      setAlarm(alarmData);
      setTitle(alarmData.title);
      setMessage(alarmData.message || '');
      setAlarmTime(new Date(alarmData.alarm_time));
      setIsRepeated(alarmData.is_repeated);
      setVibration(alarmData.vibration);
      
      if (alarmData.repeat_days) {
        setSelectedDays(alarmService.parseRepeatDays(alarmData.repeat_days));
      }
    } catch (error) {
      console.error('알람 로드 실패:', error);
      Alert.alert('오류', '알람 정보를 불러오는데 실패했습니다.');
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleDayToggle = (dayNumber: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayNumber)) {
        return prev.filter(day => day !== dayNumber);
      } else {
        return [...prev, dayNumber].sort();
      }
    });
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setAlarmTime(selectedTime);
    }
  };

  const handleUpdateAlarm = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '알람 제목을 입력해주세요.');
      return;
    }

    if (isRepeated && selectedDays.length === 0) {
      Alert.alert('오류', '반복 알람의 경우 요일을 선택해주세요.');
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        title: title.trim(),
        message: message.trim() || undefined,
        alarm_time: alarmTime.toISOString(),
        is_repeated: isRepeated,
        repeat_days: isRepeated ? alarmService.formatRepeatDays(selectedDays) : undefined,
        vibration: vibration,
      };

      await alarmService.updateAlarm(parseInt(alarmId), updateData);
      
      Alert.alert('성공', '알람이 수정되었습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('알람 수정 실패:', error);
      Alert.alert('오류', '알람 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.message}>알람 정보를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (!alarm) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.message}>알람을 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알람 편집</Text>
        <TouchableOpacity
          onPress={handleUpdateAlarm}
          disabled={loading}
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
            저장
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* 알람 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제목</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="알람 제목을 입력하세요"
            maxLength={50}
          />
        </View>

        {/* 알람 메시지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>메시지 (선택사항)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="알람 메시지를 입력하세요"
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        {/* 알람 시간 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시간</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.timeText}>{formatTime(alarmTime)}</Text>
            <Ionicons name="time-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* 반복 설정 */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.sectionTitle}>반복</Text>
            <Switch
              value={isRepeated}
              onValueChange={setIsRepeated}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isRepeated ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
          
          {isRepeated && (
            <View style={styles.daysContainer}>
              {dayNames.map((dayName, index) => {
                const dayNumber = index + 1;
                const isSelected = selectedDays.includes(dayNumber);
                
                return (
                  <TouchableOpacity
                    key={dayNumber}
                    style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                    onPress={() => handleDayToggle(dayNumber)}
                  >
                    <Text style={[styles.dayButtonText, isSelected && styles.dayButtonTextSelected]}>
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 진동 설정 */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.sectionTitle}>진동</Text>
            <Switch
              value={vibration}
              onValueChange={setVibration}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={vibration ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* 알람 상태 */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.sectionTitle}>알람 활성화</Text>
            <Switch
              value={alarm.is_active}
              onValueChange={async () => {
                try {
                  const updatedAlarm = await alarmService.toggleAlarm(alarm.id);
                  setAlarm(updatedAlarm);
                } catch (error) {
                  console.error('알람 토글 실패:', error);
                  Alert.alert('오류', '알람 상태 변경에 실패했습니다.');
                }
              }}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={alarm.is_active ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {showTimePicker && (
        <DateTimePicker
          value={alarmTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </ScrollView>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#8E8E93',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  dayButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
});
