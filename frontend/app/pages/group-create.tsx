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
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '../stores/groupStore';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GroupCreateScreen() {
  const router = useRouter();
  const { createGroupRequest, loading, error, clearError } = useGroupStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  
  // 🆕 이미지 관련 상태
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // 🆕 이미지 선택 함수
  const selectImage = async () => {
    try {
      // 권한 요청
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
        return;
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // 정사각형 비율
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        console.log('✅ 그룹 이미지 선택 완료:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('이미지 선택 실패:', error);
      Alert.alert('오류', '이미지 선택에 실패했습니다.');
    }
  };

  // 🆕 이미지 제거 함수
  const removeImage = () => {
    setSelectedImage(null);
  };

  // 🆕 이미지 업로드 함수
  const uploadGroupImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      setImageUploading(true);
      
      // 이미지를 FormData로 변환
      const formData = new FormData();
      const temp_id = Math.random().toString(36).substr(2, 8); // 8자리 임시 ID
      const filename = `group/temp_${temp_id}/logo.png`; // group/temp_{id}/logo.png 형식
      
      formData.append('file', {
        uri: selectedImage,
        type: 'image/png',
        name: filename,
      } as any);
      // filename을 별도의 필드로 추가하여 FastAPI에서 Form으로 받을 수 있도록 함
      formData.append('filename', filename); 
      
      console.log('🔍 그룹 이미지 업로드 시도:', filename);

      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch('https://hoseolife.kro.kr/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data', // FormData가 자동으로 설정
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ 그룹 이미지 업로드 완료:', data.url);
        return data.url;
      } else {
        throw new Error('이미지 업로드 실패');
      }
    } catch (error) {
      console.error('그룹 이미지 업로드 실패:', error);
      Alert.alert('오류', '이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

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
      // 🆕 이미지가 선택된 경우 먼저 업로드
      let imageUrl: string | null = null;
      if (selectedImage) {
        imageUrl = await uploadGroupImage();
        if (!imageUrl) {
          // 이미지 업로드 실패 시 중단
          return;
        }
      }

      // 그룹 생성 요청 (이미지 URL 포함)
      await createGroupRequest(name.trim(), description.trim() || undefined, imageUrl);
      
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
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          {/* 🆕 그룹 이미지 선택 섹션 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>그룹 대표 이미지 (선택)</Text>
            <View style={styles.imageSection}>
              {selectedImage ? (
                <View style={styles.selectedImageContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={removeImage}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.imagePlaceholder}
                  onPress={selectImage}
                  disabled={imageUploading}
                >
                  {imageUploading ? (
                    <ActivityIndicator color="#666666" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={32} color="#666666" />
                      <Text style={styles.imagePlaceholderText}>
                        그룹 대표 이미지 선택
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

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
            style={[
              styles.submitButton, 
              (loading || imageUploading) ? styles.submitButtonDisabled : null
            ]}
            onPress={handleSubmit}
            disabled={loading || imageUploading}
          >
            {loading || imageUploading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.loadingText}>
                  {imageUploading ? '이미지 업로드 중...' : '그룹 생성 중...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>그룹 생성 요청</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  // 🆕 이미지 관련 스타일들
  imageSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  selectedImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  selectedImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'GmarketSans',
  },
});
