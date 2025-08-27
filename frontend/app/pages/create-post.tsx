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
  Alert,
  BackHandler
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { findBuildingAtLocation, Building, isWithinHoseoCampus } from '../utils/buildingData';
import { postService, PostCreateData } from '../services/postService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://camsaw.kro.kr';

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSuspended } = useAuth();
  // const categoryParam = params.category as string; // 카테고리 파라미터 주석 처리
  // const [selectedCategory, setSelectedCategory] = useState('일상'); // 카테고리 상태 주석 처리
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInCampus, setIsInCampus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  // const [isAdmin, setIsAdmin] = useState(false); // 관리자 상태 주석 처리

  // 관리자 권한 확인 - 카테고리 제거로 인해 주석 처리
  // useEffect(() => {
  //   const checkAdminStatus = async () => {
  //     try {
  //       const userInfoStr = await AsyncStorage.getItem('userInfo');
  //       console.log('userInfoStr:', userInfoStr);
  //       if (userInfoStr) {
  //         const userInfo = JSON.parse(userInfoStr);
  //         console.log('userInfo:', userInfo);
  //         console.log('userInfo.is_admin:', userInfo.is_admin);
  //         console.log('userInfo.is_admin type:', typeof userInfo.is_admin);
  //         
  //         // 더 강력한 관리자 체크 (숫자 1, 문자열 "1", boolean true 모두 처리)
  //         const adminStatus = userInfo.is_admin === 1 || 
  //                            userInfo.is_admin === "1" || 
  //                            userInfo.is_admin === true ||
  //                            userInfo.is_admin === "true";
  //         
  //         console.log('adminStatus:', adminStatus);
  //         setIsAdmin(adminStatus);
  //       } else {
  //         console.log('userInfoStr이 null입니다.');
  //       }
  //     } catch (error) {
  //       console.error('관리자 권한 확인 실패:', error);
  //       setIsAdmin(false);
  //     }
  //   };
  //   checkAdminStatus();
  // }, []);

  // URL 파라미터에서 카테고리를 받아와서 설정 - 카테고리 제거로 인해 주석 처리
  // useEffect(() => {
  //   if (categoryParam) {
  //     const category = categoryParam;
  //     // 관리자가 아닌데 뉴스/공지 카테고리가 전달된 경우 일상으로 변경
  //     if (!isAdmin && (category === '뉴스' || category === '공지')) {
  //       setSelectedCategory('일상');
  //     } else {
  //       setSelectedCategory(category);
  //     }
  //   }
  // }, [categoryParam, isAdmin]);

  // 관리자 여부에 따라 카테고리 목록 결정 - 카테고리 제거로 인해 주석 처리
  // const getCategories = () => {
  //   console.log('getCategories 호출됨, isAdmin:', isAdmin);
  //   if (isAdmin) {
  //     console.log('관리자 카테고리 반환:', ['일상', '사람', '질문', '행사', '뉴스', '공지']);
  //     return ['일상', '사람', '질문', '행사', '뉴스', '공지'];
  //   } else {
  //     console.log('일반 사용자 카테고리 반환:', ['일상', '사람', '질문', '행사']);
  //     return ['일상', '사람', '질문', '행사'];
  //   }
  // };

  // const categories = getCategories();

  // 카테고리 변경 시 디버깅 - 카테고리 제거로 인해 주석 처리
  // useEffect(() => {
  //   console.log('카테고리 목록 변경됨:', categories);
  //   console.log('현재 선택된 카테고리:', selectedCategory);
  // }, [categories, selectedCategory]);

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
        return true; // 이벤트 소비하여 이전 화면으로 가지 않음
      }
      return false; // 기본 동작(뒤로가기) 수행
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [completed]);

  const handleRefreshLocation = async () => {
    setLoading(true);
    await getCurrentLocation();
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

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      // 위치 권한 확인 (이미 앱 시작 시 요청했으므로 빠르게 확인)
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('위치 권한이 거부되었습니다.');
        setLoading(false);
        return;
      }

      // 빠른 위치 가져오기 (낮은 정확도로 빠르게)
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // High 대신 Balanced 사용
        timeInterval: 5000, // 5초 타임아웃
        distanceInterval: 10, // 10미터마다 업데이트
      });

      const { latitude, longitude } = location.coords;
      const withinCampus = isWithinHoseoCampus(latitude, longitude);
      
      setIsInCampus(withinCampus);
      
      if (withinCampus) {
        const buildingAtLocation = findBuildingAtLocation(latitude, longitude);
        setCurrentBuilding(buildingAtLocation);
      } else {
        setCurrentBuilding(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('위치 정보를 가져오는데 실패했습니다:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (!currentBuilding) {
      Alert.alert('오류', '위치를 선택해주세요.');
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
        category: "위치", // 위치 기반 게시글용 카테고리
        building_name: currentBuilding.name,
        building_latitude: currentBuilding.latitude.toString(),
        building_longitude: currentBuilding.longitude.toString(),
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

      setCompleted(true);
      Alert.alert('성공', '게시글이 작성되었습니다!', [
        {
          text: '확인',
          onPress: () => {
            // 스택에 작성 페이지가 남지 않도록 replace로 목록으로 이동
            router.replace('/tabs/home');
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

  // 카테고리 선택 함수 - 카테고리 제거로 인해 주석 처리
  // const handleCategorySelect = (category: string) => {
  //   // 관리자가 아닌데 뉴스/공지 카테고리를 선택하려는 경우 무시
  //   if (!isAdmin && (category === '뉴스' || category === '공지')) {
  //     return;
  //   }
  //   setSelectedCategory(category);
  // };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>위치 게시판 글쓰기</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 위치 정보 */}
      <View style={styles.locationSection}>
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={16} color="#000000" style={{ marginRight: 8 }} />
          <Text style={styles.locationText}>
            위치: {loading ? '위치 확인 중...' : 
              isInCampus ? 
                `호서대학교 ${currentBuilding?.name || '알 수 없는 위치'}` : 
                '호서대학교 내에서만 게시글을 작성할 수 있습니다.'
            }
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.changeLocationButton} 
          onPress={handleRefreshLocation}
          disabled={loading}
        >
          {loading ? (
            <Text style={styles.changeLocationText}>새로고침 중...</Text>
          ) : (
            <Ionicons name="refresh" size={20} color="#000000" />
          )}
        </TouchableOpacity>
      </View>

      {/* 메인 콘텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 카테고리 선택 - 카테고리 제거로 인해 주석 처리 */}
        {/* <View style={styles.categorySection}>
          {categories.map((category) => {
            const isDisabled = !isAdmin && (category === '뉴스' || category === '공지');
            return (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonSelected,
                  isDisabled && styles.categoryButtonDisabled
              ]}
                onPress={() => handleCategorySelect(category)}
                disabled={isDisabled}
            >
              <Text style={[
                styles.categoryText,
                  selectedCategory === category && styles.categoryTextSelected,
                  isDisabled && styles.categoryTextDisabled
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View> */}

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
            <Ionicons name="camera" size={24} color="#000000" />
            <Text style={[
              styles.addPhotoText,
              selectedImages.length >= 10 && styles.addPhotoTextDisabled
            ]}>
              사진 추가 ({selectedImages.length}/10)
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

      {/* 하단 바 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomIcon}>
          <Ionicons name="list" size={30} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/home')}>
          <Ionicons name="home" size={30} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/profile')}>
          <Ionicons name="person" size={30} color="#000000" />
        </TouchableOpacity>
      </View>
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
    paddingVertical: 10,
  },
  backButton: {
    padding: 5,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'GmarketSans',
    flex: 1,
    textAlign: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#000000',
  },
  locationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  locationText: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  changeLocationButton: {
    padding: 5,
  },
  changeLocationText: {
    fontSize: 16,
    color: '#000000',
    fontFamily: 'GmarketSans',
  },

  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  categorySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  categoryButtonSelected: {
    backgroundColor: '#2D3A4A',
  },
  categoryButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#E0E0E0',
  },
  categoryText: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  categoryTextSelected: {
    color: '#ffffff',
  },
  categoryTextDisabled: {
    color: '#999999',
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  bottomIcon: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

}); 