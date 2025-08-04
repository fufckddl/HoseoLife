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
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { findBuildingAtLocation, Building, isWithinHoseoCampus } from '../utils/buildingData';
import { postService, PostCreateData } from '../services/postService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://your-server-ip:5000';

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSuspended } = useAuth();
  const categoryParam = params.category as string;
  const [selectedCategory, setSelectedCategory] = useState('일상');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInCampus, setIsInCampus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const userInfoStr = await AsyncStorage.getItem('userInfo');
        console.log('userInfoStr:', userInfoStr);
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          console.log('userInfo:', userInfo);
          console.log('userInfo.is_admin:', userInfo.is_admin);
          console.log('userInfo.is_admin type:', typeof userInfo.is_admin);
          
          // 더 강력한 관리자 체크 (숫자 1, 문자열 "1", boolean true 모두 처리)
          const adminStatus = userInfo.is_admin === 1 || 
                             userInfo.is_admin === "1" || 
                             userInfo.is_admin === true ||
                             userInfo.is_admin === "true";
          
          console.log('adminStatus:', adminStatus);
          setIsAdmin(adminStatus);
        } else {
          console.log('userInfoStr이 null입니다.');
        }
      } catch (error) {
        console.error('관리자 권한 확인 실패:', error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, []);

  // URL 파라미터에서 카테고리를 받아와서 설정
  useEffect(() => {
    if (categoryParam) {
      const category = categoryParam;
      // 관리자가 아닌데 뉴스/공지 카테고리가 전달된 경우 일상으로 변경
      if (!isAdmin && (category === '뉴스' || category === '공지')) {
        setSelectedCategory('일상');
      } else {
        setSelectedCategory(category);
      }
    }
  }, [categoryParam, isAdmin]);

  // 관리자 여부에 따라 카테고리 목록 결정
  const getCategories = () => {
    console.log('getCategories 호출됨, isAdmin:', isAdmin);
    if (isAdmin) {
      console.log('관리자 카테고리 반환:', ['일상', '사람', '질문', '행사', '뉴스', '공지']);
      return ['일상', '사람', '질문', '행사', '뉴스', '공지'];
    } else {
      console.log('일반 사용자 카테고리 반환:', ['일상', '사람', '질문', '행사']);
      return ['일상', '사람', '질문', '행사'];
    }
  };

  const categories = getCategories();

  // 카테고리 변경 시 디버깅
  useEffect(() => {
    console.log('카테고리 목록 변경됨:', categories);
    console.log('현재 선택된 카테고리:', selectedCategory);
  }, [categories, selectedCategory]);

  const handleBack = () => {
    router.back();
  };

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
      
      // expo-image-picker로 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
        aspect: [4, 3],
      });

      console.log('=== 이미지 선택 결과 ===');
      console.log('결과:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('선택된 이미지 개수:', result.assets.length);
        const newImages = result.assets.map(asset => asset.uri).filter(Boolean);
        
        console.log('새로 추가할 이미지들:', newImages);
        setSelectedImages(prev => [...prev, ...newImages]);
        console.log('이미지 상태 업데이트 완료');
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
    if (!title.trim() || !content.trim() || !selectedCategory) {
      Alert.alert('오류', '제목, 내용, 카테고리를 모두 입력해주세요.');
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
        category: selectedCategory,
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
              'Authorization': `Bearer ${token}`
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
            router.push('/tabs/home');
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

  const handleCategorySelect = (category: string) => {
    // 관리자가 아닌데 뉴스/공지 카테고리를 선택하려는 경우 무시
    if (!isAdmin && (category === '뉴스' || category === '공지')) {
      return;
    }
    setSelectedCategory(category);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Image 
            source={require('../../assets/images/camsaw_back_arrow.png')} 
            style={styles.backIcon}
            defaultSource={require('../../assets/images/camsaw_back_arrow.png')}
          />
        </TouchableOpacity>
      </View>

      {/* 위치 정보 */}
      <View style={styles.locationSection}>
        <View style={styles.locationInfo}>
          <Image 
            source={require('../../assets/images/camsaw_location_pin.png')} 
            style={styles.locationIcon}
            defaultSource={require('../../assets/images/camsaw_location_pin.png')}
          />
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
            <Image source={require('../../assets/images/camsaw_refresh.png')} style={styles.refreshIcon} />
          )}
        </TouchableOpacity>
      </View>

      {/* 메인 콘텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 카테고리 선택 */}
        <View style={styles.categorySection}>
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
        </View>

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

      {/* 하단 바 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomIcon}>
          <Image source={require('../../assets/images/camsaw_post.png')} style={styles.bottomIconImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/home')}>
          <Image source={require('../../assets/images/camsaw_home.png')} style={styles.bottomIconImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/profile')}>
          <Image source={require('../../assets/images/camsaw_human.png')} style={styles.bottomIconImg} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#2D3A4A' 
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    padding: 5,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#ffffff',
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
  locationIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    tintColor: '#000000',
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
  refreshIcon: {
    width: 20,
    height: 20,
    tintColor: '#000000',
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
    backgroundColor: '#2D3A4A',
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
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    paddingTop: 5,
    justifyContent: 'space-between',
  },
  bottomIcon: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  bottomIconImg: { 
    width: 45, 
    height: 45, 
    resizeMode: 'contain' 
  },
}); 