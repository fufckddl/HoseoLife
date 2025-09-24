import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { boardService } from '../services/boardService';

export default function CreateBoardNoticeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const boardId = parseInt(params.boardId as string);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '공지사항 제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('오류', '공지사항 내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      await boardService.createBoardNotice(boardId, title.trim(), content.trim(), isPinned);
      
      Alert.alert(
        '성공',
        '게시판 공지사항이 작성되었습니다.',
        [
          {
            text: '확인',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('게시판 공지사항 작성 실패:', error);
      Alert.alert('오류', error instanceof Error ? error.message : '게시판 공지사항 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>공지사항 작성</Text>
        <TouchableOpacity
          style={[styles.submitButton, (!title.trim() || !content.trim() || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!title.trim() || !content.trim() || loading}
        >
          <Text style={[styles.submitButtonText, (!title.trim() || !content.trim() || loading) && styles.submitButtonTextDisabled]}>
            {loading ? '작성 중...' : '완료'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 안내 정보 */}
          <View style={styles.infoContainer}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.infoTitle}>📢 게시판 공지사항 작성</Text>
            </View>
            <Text style={styles.infoText}>
              • 게시판 관리자만 공지사항을 작성할 수 있습니다.{'\n'}
              • 공지사항은 게시판 상단에 고정 표시됩니다.{'\n'}
              • 중요한 내용을 명확하게 작성해주세요.
            </Text>
          </View>

          {/* 상단 고정 설정 */}
          <View style={styles.settingContainer}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Ionicons name="pin" size={20} color="#FF6B6B" />
                <Text style={styles.settingLabel}>상단 고정</Text>
              </View>
              <Switch
                value={isPinned}
                onValueChange={setIsPinned}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isPinned ? '#007AFF' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 제목 입력 */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>제목 *</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="공지사항 제목을 입력하세요"
              placeholderTextColor="#999999"
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          {/* 내용 입력 */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>내용 *</Text>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="공지사항 내용을 입력하세요"
              placeholderTextColor="#999999"
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  submitButtonTextDisabled: {
    color: '#999999',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'GmarketSans',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  settingContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    height: 200,
    fontFamily: 'GmarketSans',
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
});
