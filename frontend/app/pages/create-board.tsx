import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreateBoardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [boardName, setBoardName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🆕 게시판 이름 중복 검증 관련 상태
  const [nameValidation, setNameValidation] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable';
    message: string;
  }>({ status: 'idle', message: '' });
  const [nameCheckTimeout, setNameCheckTimeout] = useState<number | null>(null);
  const [existingBoards, setExistingBoards] = useState<string[]>([]); // 기존 게시판 이름 목록

  // 🆕 기존 게시판 목록 가져오기
  const fetchExistingBoards = async () => {
    try {
      const response = await fetch('https://hoseolife.kro.kr/boards');
      if (response.ok) {
        const boards = await response.json();
        const boardNames = boards.map((board: any) => board.name.toLowerCase());
        setExistingBoards(boardNames);
        console.log('✅ 기존 게시판 목록 로드 완료:', boardNames);
      }
    } catch (error) {
      console.error('기존 게시판 목록 로드 실패:', error);
    }
  };

  // 컴포넌트 마운트 시 기존 게시판 목록 로드
  useEffect(() => {
    fetchExistingBoards();
  }, []);

  // 🆕 게시판 이름 중복 검증 함수 (클라이언트 사이드)
  const checkBoardNameAvailability = (name: string) => {
    if (!name.trim()) {
      setNameValidation({ status: 'idle', message: '' });
      return;
    }

    setNameValidation({ status: 'checking', message: '이름 확인 중...' });
    
    // 100ms 후 검증 (즉시 응답)
    setTimeout(() => {
      const trimmedName = name.trim();
      const lowerCaseName = trimmedName.toLowerCase();
      
      // 기존 게시판 이름과 중복 확인
      const isDuplicate = existingBoards.includes(lowerCaseName);
      
      // 이름 길이 검증 (2-20자)
      if (trimmedName.length < 2) {
        setNameValidation({
          status: 'unavailable',
          message: '게시판 이름은 2자 이상이어야 합니다.'
        });
        return;
      }
      
      if (trimmedName.length > 20) {
        setNameValidation({
          status: 'unavailable',
          message: '게시판 이름은 20자 이하여야 합니다.'
        });
        return;
      }
      
      // 중복 검증
      if (isDuplicate) {
        setNameValidation({
          status: 'unavailable',
          message: '이미 사용 중인 게시판 이름입니다.'
        });
      } else {
        setNameValidation({
          status: 'available',
          message: '사용 가능한 게시판 이름입니다.'
        });
      }
    }, 100);
  };

  // 🆕 게시판 이름 변경 시 디바운싱 처리
  const handleBoardNameChange = (text: string) => {
    setBoardName(text);
    
    // 이전 타이머 클리어
    if (nameCheckTimeout) {
      clearTimeout(nameCheckTimeout);
    }
    
    // 새로운 타이머 설정 (300ms 후 검증)
    const timeout = setTimeout(() => {
      checkBoardNameAvailability(text);
    }, 300);
    
    setNameCheckTimeout(timeout);
  };

  // 🆕 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (nameCheckTimeout) {
        clearTimeout(nameCheckTimeout);
      }
    };
  }, [nameCheckTimeout]);

  const handleCreateBoard = async () => {
    if (!boardName.trim()) {
      Alert.alert('오류', '게시판 이름을 입력해주세요.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('오류', '게시판 설명을 입력해주세요.');
      return;
    }

    // 🆕 게시판 이름 중복 검증 확인
    if (nameValidation.status === 'unavailable') {
      Alert.alert('오류', '이미 사용 중인 게시판 이름입니다. 다른 이름을 입력해주세요.');
      return;
    }

    if (nameValidation.status === 'checking') {
      Alert.alert('알림', '게시판 이름 확인 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      const response = await fetch('https://hoseolife.kro.kr/boards/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: boardName.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시판 생성에 실패했습니다.');
      }

      Alert.alert(
        '성공',
        '게시판 생성 요청이 완료되었습니다.\n관리자 승인 후 사용 가능합니다.',
        [
          {
            text: '확인',
            onPress: () => router.replace('/tabs/post-list'),
          },
        ]
      );
    } catch (error) {
      console.error('게시판 생성 실패:', error);
      Alert.alert('오류', error instanceof Error ? error.message : '게시판 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>게시판 생성</Text>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📋 게시판 생성 안내</Text>
            <Text style={styles.infoText}>
              • 새로운 게시판을 생성할 수 있습니다.{'\n'}
              • 생성된 게시판은 관리자 승인 후 사용 가능합니다.{'\n'}
              • 게시판 이름과 설명을 명확하게 작성해주세요.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>게시판 이름 *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    nameValidation.status === 'available' && styles.inputValid,
                    nameValidation.status === 'unavailable' && styles.inputInvalid
                  ]}
                  value={boardName}
                  onChangeText={handleBoardNameChange}
                  placeholder="게시판 이름을 입력하세요"
                  maxLength={20}
                />
                {nameValidation.status === 'checking' && (
                  <ActivityIndicator 
                    size="small" 
                    color="#007AFF" 
                    style={styles.validationSpinner}
                  />
                )}
                {nameValidation.status === 'available' && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color="#28a745" 
                    style={styles.validationIcon}
                  />
                )}
                {nameValidation.status === 'unavailable' && (
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color="#dc3545" 
                    style={styles.validationIcon}
                  />
                )}
              </View>
              <View style={styles.inputFooter}>
                <Text style={styles.characterCount}>{boardName.length}/20</Text>
              </View>
              {nameValidation.message && (
                <Text style={[
                  styles.validationMessage,
                  nameValidation.status === 'available' && styles.validationMessageSuccess,
                  nameValidation.status === 'unavailable' && styles.validationMessageError
                ]}>
                  {nameValidation.message}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>게시판 설명 *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="게시판에 대한 설명을 입력하세요"
                multiline
                numberOfLines={4}
                maxLength={200}
              />
              <Text style={styles.characterCount}>{description.length}/200</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.createButton, 
              (loading || nameValidation.status === 'unavailable' || nameValidation.status === 'checking') && styles.createButtonDisabled
            ]}
            onPress={handleCreateBoard}
            disabled={loading || nameValidation.status === 'unavailable' || nameValidation.status === 'checking'}
          >
            <Text style={styles.createButtonText}>
              {loading ? '생성 중...' : '게시판 생성 요청'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    paddingRight: 40, // 아이콘 공간 확보
  },
  inputValid: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  inputInvalid: {
    borderColor: '#dc3545',
    backgroundColor: '#fff8f8',
  },
  validationSpinner: {
    position: 'absolute',
    right: 12,
  },
  validationIcon: {
    position: 'absolute',
    right: 12,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'right',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
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
  createButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // 🆕 검증 메시지 스타일들
  validationMessage: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  validationMessageSuccess: {
    color: '#28a745',
  },
  validationMessageError: {
    color: '#dc3545',
  },
});
