import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView,
  Image,
  ScrollView,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { postService, PostCreateData } from '../services/postService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'https://hoseolife.kro.kr';

export default function CreateInfoPostScreen() {
  const router = useRouter();
  const { isSuspended } = useAuth();
  
  // 정보 게시판은 카테고리가 고정
  const [selectedCategory] = useState('정보');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const pickImages = async () => {
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

  const removeImage = (index: number) => {
    console.log('이미지 제거:', index);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const token = await userService.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      // 1. 먼저 게시글을 생성하여 post_id를 받음
      const postData = {
        title: title.trim(),
        content: content.trim(),
        category: selectedCategory, // 정보 게시판 고정
        image_urls: []  // 빈 배열로 시작
      };

      console.log('게시글 생성 시도:', postData);

      const postResponse = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      if (!postResponse.ok) {
        const errorText = await postResponse.text();
        console.error('게시글 생성 실패:', errorText);
        console.error('응답 상태:', postResponse.status);
        console.error('응답 헤더:', postResponse.headers);
        throw new Error(`게시글 생성 실패: ${postResponse.status} - ${errorText}`);
      }

      const createdPost = await postResponse.json();
      const postId = createdPost.id;
      console.log('게시글 생성 성공, ID:', postId);

      // 2. 이미지가 있으면 업로드
      const uploadedImageUrls = [];
      if (selectedImages.length > 0) {
        console.log('이미지 업로드 시작:', selectedImages.length, '개');
        
        for (let i = 0; i < selectedImages.length; i++) {
          const imageUri = selectedImages[i];
          console.log(`이미지 ${i + 1}/${selectedImages.length} 업로드 중...`);
          
          try {
            // 이미지 파일 정보 확인
            const fileInfo = await fetch(imageUri);
            const fileSize = fileInfo.headers.get('content-length');
            const fileSizeMB = fileSize ? parseInt(fileSize) / (1024 * 1024) : 0;
            
            console.log(`이미지 ${i + 1} 크기: ${fileSizeMB.toFixed(2)}MB`);
            
            // 파일 크기 경고 (1MB 초과 시)
            if (fileSizeMB > 1) {
              console.warn(`이미지 ${i + 1}이 1MB를 초과합니다: ${fileSizeMB.toFixed(2)}MB`);
            }
            
            const formData = new FormData();
            formData.append('file', {
              uri: imageUri,
              type: 'image/jpeg',
              name: 'image.jpg'
            } as any);
            formData.append('post_id', postId.toString());

            const imageResponse = await fetch(`${API_BASE_URL}/posts/upload-image`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              },
              body: formData
            });

            if (imageResponse.ok) {
              const imageResult = await imageResponse.json();
              uploadedImageUrls.push(imageResult.image_url);
              console.log(`이미지 ${i + 1} 업로드 성공:`, imageResult.image_url);
            } else {
              const errorText = await imageResponse.text();
              console.error(`이미지 ${i + 1} 업로드 실패:`, errorText);
              
              // 413 에러 (파일 크기 초과)인 경우 사용자에게 알림
              if (imageResponse.status === 413) {
                Alert.alert(
                  '이미지 크기 초과', 
                  `이미지 ${i + 1}이 너무 큽니다. 더 작은 이미지를 선택해주세요.`,
                  [{ text: '확인' }]
                );
              }
            }
          } catch (uploadError) {
            console.error(`이미지 ${i + 1} 업로드 중 네트워크 오류:`, uploadError);
          }
        }

        // 3. 이미지 URL을 게시글에 업데이트
        if (uploadedImageUrls.length > 0) {
          console.log('게시글에 이미지 URL 업데이트 중...');
          
          const updateResponse = await fetch(`${API_BASE_URL}/posts/${postId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              image_urls: uploadedImageUrls
            })
          });

          if (updateResponse.ok) {
            console.log('이미지 URL 업데이트 성공');
          } else {
            const errorText = await updateResponse.text();
            console.error('이미지 URL 업데이트 실패:', errorText);
          }
        }
      }

      Alert.alert('성공', '게시글이 작성되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            router.replace('/posts/info');
          }
        }
      ]);

    } catch (error) {
      console.error('게시글 작성 오류:', error);
      console.error('에러 타입:', typeof error);
      console.error('에러 메시지:', error instanceof Error ? error.message : String(error));
      console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음');
      Alert.alert('오류', '게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>정보 게시판 글쓰기</Text>
        <View style={{ width: 24 }} />
      </View>

      
      {/* 메인 콘텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* 정지 상태 알림 */}
        {isSuspended && (
          <View style={styles.suspensionWarning}>
            <Text style={styles.suspensionWarningText}>
              ⚠️ 계정이 정지되어 게시글 작성이 제한됩니다.
            </Text>
          </View>
        )}

        {/* 제목 입력 */}
        <View style={styles.inputSection}>
          <TextInput
            style={[styles.titleInput, isSuspended && styles.inputDisabled]}
            placeholder={isSuspended ? "계정이 정지되어 작성할 수 없습니다." : "제목을 입력해주세요."}
            placeholderTextColor="#999999"
            value={title}
            onChangeText={setTitle}
            editable={!isSuspended}
          />
        </View>

        {/* 내용 입력 */}
        <View style={styles.inputSection}>
          <TextInput
            style={[styles.contentInput, isSuspended && styles.inputDisabled]}
            placeholder={isSuspended ? "계정이 정지되어 작성할 수 없습니다." : "내용을 입력해주세요."}
            placeholderTextColor="#999999"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            editable={!isSuspended}
          />
        </View>

        {/* 사진 추가 */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={[
              styles.addPhotoButton,
              selectedImages.length >= 10 && styles.addPhotoButtonDisabled
            ]} 
            onPress={() => {
              console.log('사진 추가 버튼 클릭됨');
              pickImages();
            }}
            disabled={selectedImages.length >= 10}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.addPhotoText,
              selectedImages.length >= 10 && styles.addPhotoTextDisabled
            ]}>
              + 사진 추가 ({selectedImages.length}/10)
            </Text>
          </TouchableOpacity>
          
          {/* 선택된 이미지들 */}
          {selectedImages.length > 0 && (
            <View style={styles.selectedImagesContainer}>
              <Text style={styles.selectedImagesTitle}>선택된 이미지 ({selectedImages.length}개)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.selectedImageContainer}>
                    <Image source={{ uri }} style={styles.selectedImage} />
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

        {/* 작성하기 버튼 */}
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            (submitting || isSuspended) && styles.submitButtonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={submitting || isSuspended}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? '작성 중...' : isSuspended ? '작성 제한됨' : '작성하기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryDisplay: {
    backgroundColor: '#2D3A4A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'GmarketSans',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 20,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    fontFamily: 'GmarketSans',
    backgroundColor: '#ffffff',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    fontFamily: 'GmarketSans',
    backgroundColor: '#ffffff',
    height: 120,
  },
  photoSection: {
    marginBottom: 30,
  },
  addPhotoButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  addPhotoButtonDisabled: {
    opacity: 0.5,
  },
  addPhotoText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  addPhotoTextDisabled: {
    color: '#999999',
  },
  selectedImagesContainer: {
    marginTop: 15,
  },
  selectedImagesTitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 10,
    fontFamily: 'GmarketSans',
  },
  selectedImageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeSelectedImage: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeSelectedImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suspensionWarning: {
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  suspensionWarningText: {
    fontSize: 14,
    color: '#721C24',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999999',
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
});
