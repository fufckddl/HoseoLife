import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, Alert, SafeAreaView, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { BottomBar } from '../components/layout/BottomBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { notificationsEnabled, toggleNotifications, loadNotificationSettings, deactivateAccount } = useAuth();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserInfo();
    loadNotificationSettings();
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    try {
      setUpdatingNotifications(true);
      await toggleNotifications(value);
      Alert.alert(
        '알림 설정 변경',
        `알림이 ${value ? '활성화' : '비활성화'}되었습니다.`,
        [{ text: '확인' }]
      );
    } catch (error) {
      console.error('알림 설정 변경 실패:', error);
      Alert.alert('오류', '알림 설정 변경에 실패했습니다.');
    } finally {
      setUpdatingNotifications(false);
    }
  };

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      
      // 토큰 확인 (여러 번 시도)
      let token = await AsyncStorage.getItem('access_token');
      console.log('프로필 페이지 토큰 확인 1:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        // 잠시 대기 후 다시 시도
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await AsyncStorage.getItem('access_token');
        console.log('프로필 페이지 토큰 확인 2:', token ? '토큰 있음' : '토큰 없음');
      }
      
      if (!token) {
        console.log('토큰이 없습니다. 로그인이 필요합니다.');
        Alert.alert('로그인 필요', '다시 로그인해주세요.');
        router.push('/auth/login'); // 로그인 화면으로 이동
        return;
      }
      
      const user = await userService.getCurrentUserInfo();
      if (user) {
        setUserInfo(user);
        const adminStatus = user.is_admin === true;
        setIsAdmin(adminStatus);
        console.log('프로필 정보 로드 성공:', user.nickname);
        console.log('관리자 여부:', user.is_admin);
        console.log('관리자 상태 설정:', adminStatus);
        console.log('전체 사용자 정보:', user);
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      if (error instanceof Error && error.message.includes('인증이 만료')) {
        Alert.alert('인증 만료', '다시 로그인해주세요.');
        router.push('/auth/login'); // 로그인 화면으로 이동
      } else {
        Alert.alert('오류', '사용자 정보를 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.logout();
              // 사용자 정보 초기화
              setUserInfo(null);
              setIsAdmin(false);
              // 로그인 페이지로 이동
              router.push('/auth/login');
            } catch (error) {
              console.error('로그아웃 실패:', error);
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleWithdraw = async () => {
    Alert.alert(
      '회원 탈퇴',
      '정말 회원 탈퇴를 진행하시겠습니까?\n\n⚠️ 탈퇴 후:\n• 개인정보는 삭제됩니다\n• 게시글/댓글은 "(알수없음)"으로 익명 처리됩니다\n• 채팅방에서 자동으로 나가집니다',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ 회원탈퇴 처리 시작');
              await deactivateAccount(); // 🔧 새로운 탈퇴 함수 사용
              
              Alert.alert(
                '탈퇴 완료',
                '회원 탈퇴가 완료되었습니다.\n게시글과 댓글은 익명으로 유지됩니다.',
                [
                  {
                    text: '확인',
                    onPress: () => {
                      router.push('/auth/login'); // 🔧 로그인 페이지로 이동
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('회원 탈퇴 실패:', error);
              Alert.alert('오류', '회원 탈퇴에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const requestImagePickerPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0]);
      }
    } catch (error) {
      console.error('갤러리에서 이미지 선택 실패:', error);
      Alert.alert('오류', '이미지 선택에 실패했습니다.');
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0]);
      }
    } catch (error) {
      console.error('카메라로 사진 촬영 실패:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const uploadProfileImage = async (imageAsset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingImage(true);
      setShowImagePicker(false);

      console.log('프로필 이미지 업로드 시작:', imageAsset.uri);

      const formData = new FormData();
      formData.append('file', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: 'profile_image.jpg',
      } as any);

      const token = await AsyncStorage.getItem('access_token');
      console.log('토큰 확인:', token ? '토큰 있음' : '토큰 없음');

      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      // 먼저 서버 연결 테스트
      console.log('서버 연결 테스트 시작...');
      try {
        const testResponse = await fetch('https://hoseolife.kro.kr/users/upload-profile-image', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        console.log('서버 연결 테스트 결과:', testResponse.status);
      } catch (testError) {
        console.error('서버 연결 테스트 실패:', testError);
      }

      console.log('FormData 생성 완료');

      const response = await fetch('https://hoseolife.kro.kr/users/upload-profile-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('응답 상태:', response.status);
      console.log('응답 헤더:', response.headers);

      if (!response.ok) {
        let errorMessage = '업로드에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('에러 응답 파싱 실패:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('업로드 성공 결과:', result);
      
      // 사용자 정보 업데이트
      setUserInfo((prev: any) => ({
        ...prev,
        profile_image_url: result.profile_image_url
      }));

      // 사용자 정보를 다시 로드하여 최신 상태로 업데이트
      await loadUserInfo();

      Alert.alert('성공', '프로필 이미지가 업데이트되었습니다.');
    } catch (error) {
      console.error('프로필 이미지 업로드 실패:', error);
      
      let errorMessage = '알 수 없는 오류';
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = '네트워크 연결을 확인해주세요.';
        } else if (error.message.includes('인증 토큰이 없습니다')) {
          errorMessage = '로그인이 필요합니다.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('오류', `프로필 이미지 업로드에 실패했습니다: ${errorMessage}`);
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        {/* 가운데: 타이틀 - 완전 중앙 정렬 */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>프로필</Text>
        </View>
      </View>

      {/* 메인 콘텐츠 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 프로필 정보 */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={() => setShowImagePicker(true)}
            disabled={uploadingImage}
          >
            {userInfo?.profile_image_url ? (
              <Image 
                source={{ 
                  uri: userInfo.profile_image_url,
                  cache: 'reload' // 캐시 무효화하여 최신 이미지 로드
                }} 
                style={styles.profileImage} 
              />
            ) : (
              <Image source={require('../../assets/images/camsaw_human.png')} style={styles.profileImage} />
            )}
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.nickname}>{userInfo?.nickname || '닉네임'}</Text>
          <Text style={styles.university}>{userInfo?.university || '호서대학교 아산캠퍼스'}</Text>
        </View>

        {/* 구분선 */}
        <View style={styles.separator} />

        {/* 계정 정보 */}
        <View style={styles.accountContainer}>
          <Text style={styles.sectionTitle}>계정</Text>
          <View style={styles.accountInfo}>
            <Text style={styles.label}>아이디:</Text>
            <Text style={styles.email}>{userInfo?.email || '로딩 중...'}</Text>
          </View>
                      <View style={styles.accountButtons}>
              <TouchableOpacity style={styles.accountButton} onPress={() => router.push('/pages/change-password')}>
                <Text style={styles.accountButtonText}>비밀번호 변경</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accountButton} onPress={handleLogout}>
                <Text style={styles.accountButtonText}>로그아웃</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accountButton} onPress={handleWithdraw}>
                <Text style={styles.accountButtonText}>회원탈퇴</Text>
              </TouchableOpacity>
            </View>
        </View>

        {/* 알림 설정 */}
        <View style={styles.notificationContainer}>
          <Text style={styles.sectionTitle}>알림</Text>
          <View style={styles.notificationRow}>
            <Text style={styles.notificationText}>
              {notificationsEnabled ? '알림 켜짐' : '알림 꺼짐'}
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#000000', true: '#000000' }}
              thumbColor={notificationsEnabled ? '#ffffff' : '#f4f3f4'}
              disabled={updatingNotifications}
            />
          </View>
          {updatingNotifications && (
            <Text style={styles.updatingText}>설정 변경 중...</Text>
          )}
        </View>

        {/* 추가 정보 (스크롤 후) */}
        <View style={styles.additionalSection}>
          <View style={styles.additionalItem}>
            <Text style={styles.additionalText}>이용안내</Text>
          </View>
          <View style={styles.additionalItem}>
            <Text style={styles.additionalText}>앱버전</Text>
            <Text style={styles.versionText}>
              {Constants.expoConfig?.version || '알수없음'}
            </Text>
          </View>
          <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/contact')}>
            <Text style={styles.additionalText}>문의하기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/my-contacts')}>
            <Text style={styles.additionalText}>내 문의 목록</Text>
          </TouchableOpacity>
          
                            <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/report-history')}>
                    <Text style={styles.additionalText}>신고내역</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/scrap-list')}>
                    <Text style={styles.additionalText}>스크랩 목록</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/my-posts' as any)}>
                    <Text style={styles.additionalText}>내가 작성한 게시글</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/my-comments' as any)}>
                    <Text style={styles.additionalText}>내가 작성한 댓글</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/my-hearts' as any)}>
                    <Text style={styles.additionalText}>내가 좋아요한 게시글</Text>
                  </TouchableOpacity>
          {/* 관리자 메뉴 */}
              {isAdmin && (
      <>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#E0E0E0', marginVertical: 10 }} />
        <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/admin/contact-management')}>
          <Text style={styles.additionalText}>문의 관리</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/admin/group-approval' as any)}>
          <Text style={styles.additionalText}>그룹 승인 관리</Text>
        </TouchableOpacity>
                        <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/admin/report-management')}>
                  <Text style={styles.additionalText}>신고 관리</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.additionalItem} onPress={() => router.push('/pages/admin/board-approval' as any)}>
                  <Text style={styles.additionalText}>게시판 승인</Text>
                </TouchableOpacity>
      </>
    )}
        </View>
      </ScrollView>

      {/* 이미지 선택 모달 */}
      <Modal
        visible={showImagePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>프로필 이미지 변경</Text>
              <TouchableOpacity onPress={() => setShowImagePicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={pickImageFromGallery}
              >
                <Text style={styles.modalOptionText}>갤러리에서 선택</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={takePhoto}
              >
                <Text style={styles.modalOptionText}>카메라로 촬영</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 하단 바 */}
      <BottomBar activeTab="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  topBar: {
    justifyContent: 'center', // 🔧 중앙 정렬
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 30, // 🔧 높이 유지 (8 → 30)
    borderBottomWidth: 1, // 🆕 구분선 추가
    borderBottomColor: '#E0E0E0',
  },
  titleContainer: {
    top: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8, // 🆕 하단 여백 추가
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
    textAlign: 'center', // 🆕 텍스트 중앙 정렬
  },
  topLogo: { width: 40, height: 40 },
  topTitle: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'GmarketSans',
  },
  topIcon: { marginLeft: 18 },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  profileCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 30,
    marginRight: 70,
    marginLeft: 70,
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40, // 원형으로 만들기 위해 width/height의 절반
    resizeMode: 'cover', // contain에서 cover로 변경하여 이미지가 원형 영역을 채우도록
  },
  nickname: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
    fontFamily: 'GmarketSans',
  },
  university: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  accountContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  notificationContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    fontFamily: 'GmarketSans',
  },
  accountInfo: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 5,
    fontFamily: 'GmarketSans',
  },
  email: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  accountButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  accountButton: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  accountButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  notificationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  additionalSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  additionalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  additionalText: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  versionText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    width: '80%',
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    fontSize: 24,
    color: '#666666',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  modalOption: {
    width: '100%',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40, // 프로필 이미지와 동일한 원형
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notificationText: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  updatingText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
    marginTop: 5,
  },
});