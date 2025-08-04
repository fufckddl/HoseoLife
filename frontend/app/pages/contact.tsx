import * as React from 'react';
import { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { contactService, ContactCreateData } from '../services/contactService';

export default function ContactScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 실제 API 호출
      const contactData: ContactCreateData = {
        subject: subject.trim(),
        message: message.trim(),
        category: '일반' // 기본 카테고리
      };
      
      await contactService.createContact(contactData);
      
      Alert.alert(
        '문의 전송 완료',
        '관리자에게 문의가 전송되었습니다.\n빠른 시일 내에 답변드리겠습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('문의 전송 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '문의 전송에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>문의하기</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 메인 콘텐츠 */}
      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 안내 메시지 */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>문의사항이 있으신가요?</Text>
            <Text style={styles.infoText}>
              앱 사용 중 궁금한 점이나 개선사항이 있으시면 언제든 문의해주세요.
              빠른 시일 내에 답변드리겠습니다.
            </Text>
          </View>

          {/* 문의 폼 */}
          <View style={styles.formContainer}>
            {/* 제목 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>제목 *</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="문의 제목을 입력해주세요"
                placeholderTextColor="#999999"
                maxLength={100}
              />
            </View>

            {/* 내용 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>내용 *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="문의 내용을 자세히 입력해주세요"
                placeholderTextColor="#999999"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>

            {/* 문자 수 표시 */}
            <View style={styles.charCount}>
              <Text style={styles.charCountText}>
                {message.length}/1000
              </Text>
            </View>
          </View>

          {/* 제출 버튼 */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? '전송 중...' : '문의 전송'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: '#F5F5F5',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  formContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  charCountText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    backgroundColor: '#2D3A4A',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#999999',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 