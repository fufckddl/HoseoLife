// 그룹 생성 요청 화면
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '../stores/groupStore';

export default function GroupCreateScreen() {
  const router = useRouter();
  const { createGroupRequest, loading, error, clearError } = useGroupStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;
    
    // 이름 검증
    if (!name.trim()) {
      setNameError('그룹명을 입력해주세요');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('그룹명은 2자 이상이어야 합니다');
      isValid = false;
    } else if (name.trim().length > 40) {
      setNameError('그룹명은 40자 이하여야 합니다');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // 설명 검증
    if (description.trim().length > 200) {
      setDescriptionError('설명은 200자 이하여야 합니다');
      isValid = false;
    } else {
      setDescriptionError('');
    }
    
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      await createGroupRequest(name.trim(), description.trim() || undefined);
      
      Alert.alert(
        '요청 완료',
        '그룹 생성 요청이 제출되었습니다. 관리자 승인 후 그룹이 생성됩니다.',
        [
          {
            text: '확인',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '그룹 생성 요청에 실패했습니다');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* 상단 바 */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.title}>그룹 생성 요청</Text>
          <View style={styles.placeholder} />
        </View>

        {/* 폼 */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>그룹명 *</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
                clearError();
              }}
              placeholder="2-40자로 입력해주세요"
              maxLength={40}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>설명 (선택)</Text>
            <TextInput
              style={[styles.textArea, descriptionError ? styles.inputError : null]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (descriptionError) setDescriptionError('');
                clearError();
              }}
              placeholder="그룹에 대한 설명을 입력해주세요 (최대 200자)"
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            {descriptionError ? <Text style={styles.errorText}>{descriptionError}</Text> : null}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, loading ? styles.submitButtonDisabled : null]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>그룹 생성 요청</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 34,
  },
  form: {
    flex: 1,
    padding: 20,
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'GmarketSans',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'GmarketSans',
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 5,
    fontFamily: 'GmarketSans',
  },
  charCount: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 5,
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    backgroundColor: '#2D3A4A',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
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
});
