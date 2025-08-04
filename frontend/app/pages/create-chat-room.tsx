import * as React from 'react';
import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { chatService, CreateChatRoomData } from '../services/chatService';

export default function CreateChatRoomScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '채팅방 제목을 입력해주세요.');
      return;
    }

    if (!purpose.trim()) {
      Alert.alert('알림', '생성 목적을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      
      const chatData: CreateChatRoomData = {
        title: title.trim(),
        purpose: purpose.trim()
      };

      await chatService.createChatRoom(chatData);
      
      Alert.alert(
        '성공', 
        '채팅방 생성 요청이 완료되었습니다.\n관리자 승인 후 채팅방이 활성화됩니다.',
        [
          {
            text: '확인',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
      Alert.alert('오류', '채팅방 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (title.trim() || purpose.trim()) {
      Alert.alert(
        '작성 중단',
        '작성 중인 내용이 있습니다. 정말로 나가시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel'
          },
          {
            text: '나가기',
            style: 'destructive',
            onPress: () => router.back()
          }
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>채팅방 만들기</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 안내 메시지 */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>채팅방 생성 안내</Text>
          <Text style={styles.infoText}>
            • 채팅방 제목과 생성 목적을 작성해주세요{'\n'}
            • 관리자 검토 후 승인됩니다{'\n'}
            • 승인 후 채팅방이 활성화됩니다{'\n'}
            • 승인 여부는 채팅방 목록에서 확인할 수 있습니다
          </Text>
        </View>

        {/* 채팅방 제목 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>채팅방 제목 *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="채팅방 제목을 입력하세요"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholderTextColor="#999999"
          />
          <Text style={styles.characterCount}>{title.length}/100</Text>
        </View>

        {/* 생성 목적 입력 */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>생성 목적 *</Text>
          <TextInput
            style={styles.purposeInput}
            placeholder="채팅방을 만드는 목적을 자세히 설명해주세요"
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
            placeholderTextColor="#999999"
          />
          <Text style={styles.characterCount}>{purpose.length}/500</Text>
        </View>

        {/* 생성하기 버튼 */}
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            (!title.trim() || !purpose.trim() || submitting) && styles.submitButtonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={!title.trim() || !purpose.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>채팅방 생성 요청</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D3A4A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  infoContainer: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  purposeInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 120,
    fontFamily: 'GmarketSans',
  },
  characterCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    backgroundColor: '#2D3A4A',
    borderRadius: 8,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 