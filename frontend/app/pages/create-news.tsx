import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function CreateNewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      console.log('=== 이미지 선택 시작 ===');
      const remainingSlots = 10 - selectedImages.length;
      console.log('남은 이미지 슬롯:', remainingSlots);
      
      if (remainingSlots <= 0) {
        Alert.alert('알림', '이미지는 최대 10개까지 선택할 수 있습니다.');
        return;
      }

      // 사진 라이브러리 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('사진 라이브러리 권한 상태:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          '권한 필요',
          '사진을 선택하기 위해 사진 라이브러리 접근 권한이 필요합니다.',
          [{ text: '확인', style: 'default' }]
        );
        return;
      }

      console.log('이미지 선택기 실행 중...');
      
      // expo-image-picker로 이미지 선택 (한 번에 최대 10개까지)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.2, // 20% 압축률
        aspect: [4, 3],
        allowsEditing: false, // 편집 비활성화로 빠른 선택 가능
      });

      console.log('=== 이미지 선택 결과 ===');
      console.log('결과:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('선택된 이미지 개수:', result.assets.length);
        const newImages = result.assets.map(asset => asset.uri).filter(Boolean);
        
        console.log('새로 추가할 이미지들:', newImages);
        setSelectedImages(prev => [...prev, ...newImages]);
        console.log('이미지 상태 업데이트 완료');
        
        // 선택 완료 알림
        Alert.alert(
          '이미지 선택 완료', 
          `${result.assets.length}개의 이미지가 추가되었습니다. (총 ${selectedImages.length + result.assets.length}/10개)`
        );
      } else {
        console.log('이미지 선택 취소됨 또는 선택된 이미지 없음');
      }
      
    } catch (error) {
      console.error('=== 이미지 선택 중 오류 ===');
      console.error('오류 타입:', typeof error);
      console.error('오류 메시지:', error);
      if (error instanceof Error) {
        console.error('오류 스택:', error.stack);
      }
      Alert.alert('오류', '이미지 선택 중 오류가 발생했습니다.');
    }
  };

  const removeImage = (indexToRemove: number) => {
    setSelectedImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. 먼저 게시글을 생성하여 post_id를 받음
      const postData = {
        title: title.trim(),
        content: content.trim(),
        category: '뉴스',
        image_urls: []
      };

      const postResponse = await fetch('https://camsaw.kro.kr/posts/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(postData),
      });

      if (!postResponse.ok) {
        const errorData = await postResponse.json();
        Alert.alert('오류', errorData.detail || '새소식 등록에 실패했습니다.');
        return;
      }

      const createdPost = await postResponse.json();
      const postId = createdPost.id;

      // 2. 이미지가 있으면 업로드
      const uploadedImageUrls = [];
      if (selectedImages.length > 0) {
        for (let i = 0; i < selectedImages.length; i++) {
          const imageUri = selectedImages[i];
          
          try {
            const formData = new FormData();
            formData.append('file', {
              uri: imageUri,
              type: 'image/jpeg',
              name: 'image.jpg'
            } as any);
            formData.append('post_id', postId.toString());

            const imageResponse = await fetch('https://camsaw.kro.kr/posts/upload-image', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${await AsyncStorage.getItem('access_token')}`,
                'Content-Type': 'multipart/form-data'
              },
              body: formData
            });

            if (imageResponse.ok) {
              const imageResult = await imageResponse.json();
              uploadedImageUrls.push(imageResult.image_url);
            } else {
              console.error(`이미지 ${i + 1} 업로드 실패:`, await imageResponse.text());
            }
          } catch (uploadError) {
            console.error(`이미지 ${i + 1} 업로드 중 오류:`, uploadError);
          }
        }

        // 3. 이미지 URL을 게시글에 업데이트
        if (uploadedImageUrls.length > 0) {
          const updateResponse = await fetch(`https://camsaw.kro.kr/posts/${postId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await AsyncStorage.getItem('access_token')}`,
            },
            body: JSON.stringify({
              image_urls: uploadedImageUrls
            })
          });

          if (!updateResponse.ok) {
            console.error('이미지 URL 업데이트 실패:', await updateResponse.text());
          }
        }
      }

      Alert.alert('성공', '새소식이 등록되었습니다.', [
        {
          text: '확인',
          onPress: () => router.replace('/pages/notifications'),
        },
      ]);
    } catch (error) {
      console.error('새소식 등록 실패:', error);
      Alert.alert('오류', '새소식 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새소식 작성</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* 제목 입력 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>제목</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="제목을 입력하세요"
                placeholderTextColor="#999999"
                maxLength={100}
              />
              <Text style={styles.characterCount}>{title.length}/100</Text>
            </View>

            {/* 이미지 추가 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>이미지 추가</Text>
              <TouchableOpacity 
                style={[
                  styles.imagePickerButton,
                  selectedImages.length >= 10 && styles.imagePickerButtonDisabled
                ]} 
                onPress={pickImage}
                disabled={selectedImages.length >= 10}
                activeOpacity={0.7}
              >
                <Ionicons name="camera" size={24} color="#000000" />
                <Text style={[
                  styles.imagePickerText,
                  selectedImages.length >= 10 && styles.imagePickerTextDisabled
                ]}>
                  이미지 선택 ({selectedImages.length}/10)
                </Text>
              </TouchableOpacity>
              
              {/* 선택된 이미지 미리보기 */}
              {selectedImages.length > 0 && (
                <View style={styles.selectedImagesContainer}>
                  <Text style={styles.selectedImagesTitle}>선택된 이미지 ({selectedImages.length}개)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedImages.map((imageUri, index) => (
                      <View key={index} style={styles.selectedImageContainer}>
                        <Image source={{ uri: imageUri }} style={styles.selectedImage} />
                        <TouchableOpacity 
                          style={styles.removeSelectedImage}
                          onPress={() => removeImage(index)}
                        >
                          <Text style={styles.removeSelectedImageText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 내용 입력 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>내용</Text>
              <TextInput
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                placeholder="내용을 입력하세요"
                placeholderTextColor="#999999"
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={styles.characterCount}>{content.length}/2000</Text>
            </View>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.submitButton, (!title.trim() || !content.trim() || loading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!title.trim() || !content.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>새소식 등록</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },

  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    minHeight: 200,
  },
  characterCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    marginTop: 8,
  },
  imagePickerButtonDisabled: {
    opacity: 0.7,
  },
  imagePickerText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  imagePickerTextDisabled: {
    color: '#999999',
  },
  selectedImagesContainer: {
    marginTop: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  selectedImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  selectedImageContainer: {
    width: 100,
    height: 100,
    marginHorizontal: 8,
    position: 'relative',
  },
  removeSelectedImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  removeSelectedImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
  },
});
