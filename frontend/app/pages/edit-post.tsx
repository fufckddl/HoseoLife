import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  TouchableOpacity,
  StyleSheet, 
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { postService } from '../services/postService';
import { userService } from '../services/userService';

const API_BASE_URL = 'https://camsaw.kro.kr';

export default function EditPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = params.id as string;
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('일상');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postData, setPostData] = useState<any>(null);
  const [completed, setCompleted] = useState(false);

  const categories = ['일상', '사람', '질문', '행사'];

  useEffect(() => {
    if (postId) {
      fetchPostData();
    }
  }, [postId]);

  const fetchPostData = async () => {
    try {
      setLoading(true);
      const data = await postService.getPost(parseInt(postId));
      
      setPostData(data); // postData 상태에 저장
      setTitle(data.title);
      setContent(data.content);
      setSelectedCategory(data.category);
      
      // 기존 이미지 설정
      if (data.image_urls && Array.isArray(data.image_urls)) {
        setExistingImages(data.image_urls);
      }
      
    } catch (error) {
      console.error('게시글 데이터 가져오기 실패:', error);
      Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (completed) {
      router.replace('/tabs/home');
      return;
    }
    router.back();
  };

  useEffect(() => {
    const onBackPress = () => {
      if (completed) {
        router.replace('/tabs/home');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [completed]);

  const pickImages = async () => {
    try {
      console.log('=== 이미지 선택 시작 ===');
      const remainingSlots = 10 - (existingImages.length + selectedImages.length);
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
          `${result.assets.length}개의 이미지가 추가되었습니다. (총 ${existingImages.length + selectedImages.length + result.assets.length}/10개)`
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

  const removeExistingImage = (index: number) => {
    console.log('기존 이미지 제거:', index);
    setExistingImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      console.log('기존 이미지 제거 후 남은 이미지들:', newImages);
      return newImages;
    });
  };

  const removeSelectedImage = (index: number) => {
    console.log('선택된 이미지 제거:', index);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 빠른 위치 가져오기 함수 (필요한 경우 사용)
  const getCurrentLocation = async () => {
    try {
      // 위치 권한 확인 (이미 앱 시작 시 요청했으므로 빠르게 확인)
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('위치 권한이 거부되었습니다.');
        return null;
      }

      // 빠른 위치 가져오기 (낮은 정확도로 빠르게)
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // High 대신 Balanced 사용
        timeInterval: 5000, // 5초 타임아웃
        distanceInterval: 10, // 10미터마다 업데이트
      });

      return location.coords;
    } catch (error) {
      console.error('위치 정보를 가져오는데 실패했습니다:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !selectedCategory) {
      Alert.alert('오류', '제목, 내용, 카테고리를 모두 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const token = await userService.getToken();
      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다.');
        return;
      }

      // 1. 새로 선택된 이미지 업로드
      const uploadedImageUrls = [...existingImages]; // 현재 남아있는 기존 이미지만 유지
      console.log('현재 남아있는 기존 이미지:', existingImages);
      console.log('새로 선택된 이미지:', selectedImages);
      console.log('최종 업로드할 이미지 URL들:', uploadedImageUrls);
      
      if (selectedImages.length > 0) {
        console.log('새 이미지 업로드 시작:', selectedImages.length, '개');
        
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
            formData.append('post_id', postId);

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
      }

      // 2. 게시글 업데이트
      const updateData = {
        title: title.trim(),
        content: content.trim(),
        category: selectedCategory,
        building_name: postData?.building_name || '', // 기존 building_name 유지
        building_latitude: postData?.building_latitude || '', // 기존 building_latitude 유지
        building_longitude: postData?.building_longitude || '', // 기존 building_longitude 유지
        image_urls: uploadedImageUrls // 항상 image_urls 포함 (빈 배열이어도)
      };
      
      console.log('게시글 업데이트 데이터:', updateData);
      console.log('전송할 이미지 URL들:', updateData.image_urls);

      const updateResponse = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (updateResponse.ok) {
        setCompleted(true);
        Alert.alert('성공', '게시글이 수정되었습니다!', [
          {
            text: '확인',
            onPress: () => {
              // 수정 완료 후 목록으로 이동하고 스택을 정리
              router.replace('/tabs/home');
            }
          }
        ]);
      } else {
        const errorText = await updateResponse.text();
        console.error('게시글 수정 실패:', errorText);
        throw new Error('게시글 수정 실패');
      }

    } catch (error) {
      console.error('게시글 수정 오류:', error);
      Alert.alert('오류', '게시글 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

    if (loading) {
    return (
      <View style={styles.container}>
        {/* 상단 노치 영역 */}
        <View style={[styles.topNotch, { height: insets.top }]} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
        </View>
        {/* 하단 노치 영역 */}
        <View style={[styles.bottomNotch, { height: insets.bottom }]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 노치 영역 */}
      <View style={[styles.topNotch, { height: insets.top }]} />
      
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>게시글 수정</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 메인 콘텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>


        {/* 제목 입력 */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.titleInput}
            placeholder="제목을 입력해주세요."
            placeholderTextColor="#999999"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* 내용 입력 */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.contentInput}
            placeholder="내용을 입력해주세요."
            placeholderTextColor="#999999"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* 기존 이미지들 */}
        {existingImages.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>기존 이미지</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {existingImages.map((url, index) => (
                <View key={`existing-${index}`} style={styles.imageContainer}>
                  <Image source={{ uri: url }} style={styles.image} />
                  <TouchableOpacity 
                    style={styles.removeImage}
                    onPress={() => removeExistingImage(index)}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 사진 추가 */}
        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={[
              styles.addPhotoButton,
              (existingImages.length + selectedImages.length) >= 10 && styles.addPhotoButtonDisabled
            ]} 
            onPress={pickImages}
            disabled={(existingImages.length + selectedImages.length) >= 10}
          >
            <Ionicons name="camera" size={24} color="#000000" />
            <Text style={[
              styles.addPhotoText,
              (existingImages.length + selectedImages.length) >= 10 && styles.addPhotoTextDisabled
            ]}>
              사진 추가 ({(existingImages.length + selectedImages.length)}/10)
            </Text>
          </TouchableOpacity>
          
          {/* 새로 선택된 이미지들 */}
          {selectedImages.length > 0 && (
            <View style={styles.selectedImagesContainer}>
              <Text style={styles.selectedImagesTitle}>새로 추가된 이미지 ({selectedImages.length}개)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((uri, index) => (
                  <View key={`selected-${index}`} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity 
                      style={styles.removeImage}
                      onPress={() => removeSelectedImage(index)}
                    >
                      <Text style={styles.removeImageText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 수정하기 버튼 */}
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            submitting && styles.submitButtonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? '수정 중...' : '수정하기'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* 하단 노치 영역 */}
      <View style={[styles.bottomNotch, { height: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  topNotch: {
    backgroundColor: '#ffffff', // 상단 노치 색상
  },
  bottomNotch: {
    backgroundColor: '#FFFFFF', // 하단 노치 색상
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    padding: 5,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    fontFamily: 'GmarketSans',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
  },
  addPhotoButtonDisabled: {
    opacity: 0.5,
  },
  addPhotoText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'GmarketSans',
    fontWeight: '500',
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
  imageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImage: {
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
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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