import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { contactService, ContactData } from '../services/contactService';
import { userService } from '../services/userService';

export default function ContactDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const contactId = Number(id);
  
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadContactDetail();
    checkAdminStatus();
  }, [contactId]);

  const loadContactDetail = async () => {
    try {
      setLoading(true);
      const contactData = await contactService.getMyContact(contactId);
      setContact(contactData);
    } catch (error) {
      console.error('문의 상세 로드 실패:', error);
      Alert.alert('오류', '문의 상세를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const userInfo = await userService.getCurrentUserInfo();
      setIsAdmin(userInfo?.is_admin === true);
    } catch (error) {
      console.error('관리자 상태 확인 실패:', error);
      setIsAdmin(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      Alert.alert('알림', '답변 내용을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      await contactService.updateContact(contactId, {
        admin_response: replyText.trim(),
        status: '답변완료',
        is_read: true,
        is_answered: true
      });
      
      Alert.alert('성공', '답변이 성공적으로 등록되었습니다.', [
        { text: '확인', onPress: () => {
          setReplyText('');
          loadContactDetail(); // 문의 정보 새로고침
        }}
      ]);
    } catch (error) {
      console.error('답변 등록 실패:', error);
      Alert.alert('오류', '답변 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '대기중': return '#FF8800';
      case '처리중': return '#007AFF';
      case '답변완료': return '#4CAF50';
      case '완료': return '#4CAF50';
      default: return '#666666';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '긴급': return '#FF4444';
      case '높음': return '#FF8800';
      case '보통': return '#007AFF';
      case '낮음': return '#4CAF50';
      default: return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>문의 상세를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>문의를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>문의 상세</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 문의 정보 */}
          <View style={styles.contactInfo}>
            <View style={styles.contactHeader}>
              <Text style={styles.contactSubject}>{contact.subject}</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contact.status) }]}>
                  <Text style={styles.statusText}>{contact.status}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(contact.priority) }]}>
                  <Text style={styles.priorityText}>{contact.priority}</Text>
                </View>
              </View>
            </View>

            <View style={styles.contactMeta}>
              <Text style={styles.contactUser}>작성자: {contact.user_nickname}</Text>
              <Text style={styles.contactDate}>{formatDate(contact.created_at)}</Text>
            </View>

            <View style={styles.categoryContainer}>
              <Text style={styles.categoryLabel}>카테고리:</Text>
              <Text style={styles.categoryText}>{contact.category}</Text>
            </View>
          </View>

          {/* 문의 내용 */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>문의 내용</Text>
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{contact.message}</Text>
            </View>
          </View>

          {/* 관리자 답변 */}
          {contact.admin_response && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseLabel}>관리자 답변</Text>
              <View style={styles.responseBox}>
                <Text style={styles.responseText}>{contact.admin_response}</Text>
                {contact.admin_nickname && (
                  <Text style={styles.responseAuthor}>- {contact.admin_nickname}</Text>
                )}
                {contact.updated_at && (
                  <Text style={styles.responseDate}>{formatDate(contact.updated_at)}</Text>
                )}
              </View>
            </View>
          )}

          {/* 관리자 답변 작성 (관리자만) */}
          {isAdmin && !contact.is_answered && (
            <View style={styles.replyContainer}>
              <Text style={styles.replyLabel}>답변 작성</Text>
              <TextInput
                style={styles.replyInput}
                placeholder="답변을 입력하세요..."
                value={replyText}
                onChangeText={setReplyText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999999"
              />
              <TouchableOpacity 
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReply}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>답변 등록</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 답변 완료 상태 (관리자만) */}
          {isAdmin && contact.is_answered && (
            <View style={styles.completedContainer}>
              <Text style={styles.completedText}>✓ 답변이 완료되었습니다</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 10,
    fontFamily: 'GmarketSans',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contactInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactSubject: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 12,
    fontFamily: 'GmarketSans',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  contactMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactUser: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  contactDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
    fontFamily: 'GmarketSans',
  },
  categoryText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  messageContainer: {
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  messageBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
  },
  messageText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  responseContainer: {
    marginBottom: 20,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  responseBox: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  responseText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  responseAuthor: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  responseDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  replyContainer: {
    marginBottom: 20,
  },
  replyLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#999999',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  completedContainer: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  completedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 