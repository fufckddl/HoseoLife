import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postService, PostListResponse } from '../services/postService';
import { clusterMarkers, PostMarker, Cluster } from '../utils/clustering';
import { CustomMarker, ClusterMarker } from '../components/CustomMarker';
import { PostListModal } from '../components/PostListModal';
import { getCurrentKoreaTime, formatKoreaTime, getTodaySixAM, debugTimeInfo, getCurrentKoreaTimeString } from '../utils/dateUtils';

type LocationCoords = {
  latitude: number;
  
  longitude: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostListResponse[]>([]);
  const [clusteredMarkers, setClusteredMarkers] = useState<{
    clusters: Cluster[];
    individualMarkers: PostMarker[];
  }>({ clusters: [], individualMarkers: [] });
  const [region, setRegion] = useState<Region>({
    latitude: 36.7789, // 호서대학교 천안캠퍼스 근처 기본값
    longitude: 127.2835,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  
  // 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

    // 위치 권한 요청 및 현재 위치 가져오기
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        
        // 위치 권한 확인
        let { status } = await Location.getForegroundPermissionsAsync();
        
        // 권한이 없으면 요청
        if (status !== 'granted') {
          console.log('위치 권한 요청 중...');
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          
          if (newStatus !== 'granted') {
            Alert.alert(
              '위치 권한 필요',
              '주변 게시글을 확인하기 위해 위치 권한이 필요합니다. 앱을 다시 시작하여 위치 권한을 허용해주세요.',
              [{ text: '확인', style: 'default' }]
            );
            setLoading(false);
            return;
          }
        }

        console.log('위치 권한 승인됨, 현재 위치 가져오는 중...');
        
        // 빠른 위치 가져오기 (낮은 정확도로 먼저 시도)
        const currentLocation = await getCurrentLocationFast();
        
        if (currentLocation) {
          // 현재 위치로 지도 중심 설정
          const newRegion = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          setRegion(newRegion);
          console.log('현재 위치로 지도 설정 완료:', newRegion);
          
          // 백그라운드에서 더 정확한 위치 업데이트
          updateLocationInBackground();
        } else {
          console.log('위치 정보를 가져올 수 없어 기본 위치 사용');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('위치 권한 요청 실패:', error);
        Alert.alert('오류', '위치 정보를 가져오는데 실패했습니다.');
        setLoading(false);
      }
    })();
  }, []);

  // 초기 게시글 데이터 가져오기
  useEffect(() => {
    fetchPosts();
  }, []);

  // 화면이 포커스될 때마다 게시글 목록 새로고침
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== Home 화면 포커스됨, 게시글 목록 새로고침 ===');
      
      // 약간의 지연을 두어 post-detail에서의 변경사항이 서버에 반영될 시간을 줌
      setTimeout(() => {
        console.log('Home 화면 포커스 후 지연 완료, 게시글 목록 새로고침 시작');
        fetchPosts();
      }, 300);
    }, [])
  );

  // 게시글 데이터를 마커 형태로 변환하고 클러스터링
  useEffect(() => {
    console.log(`오늘 06:00 이후 게시글: ${posts.length}개`);
    console.log('현재 한국 시간:', formatKoreaTime(getCurrentKoreaTime()));
    
    if (posts.length > 0) {
      const postMarkers: PostMarker[] = posts
        .filter(post => post.building_latitude && post.building_longitude)
        .map(post => ({
          id: post.id,
          latitude: parseFloat(post.building_latitude!),
          longitude: parseFloat(post.building_longitude!),
          title: post.title,
          category: post.category,
          building_name: post.building_name,
          author_nickname: post.author_nickname,
          created_at: post.created_at,
          view_count: post.view_count,
          heart_count: post.heart_count,
          comment_count: post.comment_count,
        }));

      console.log('필터링된 마커 데이터:', postMarkers.length, '개');
      console.log('마커 좌표 예시:', postMarkers.slice(0, 3));

      const clustered = clusterMarkers(postMarkers, 15, 50);
      console.log('클러스터링 결과:', {
        clusters: clustered.clusters.length,
        individualMarkers: clustered.individualMarkers.length
      });
      setClusteredMarkers(clustered);
    } else {
      // 게시글이 없으면 마커 초기화
      setClusteredMarkers({ clusters: [], individualMarkers: [] });
    }
  }, [posts]);

  const fetchPosts = async () => {
    try {
      console.log('게시글 목록 갱신 시작...');
      
      // 디버그 정보 출력
      debugTimeInfo();
      
      // 오늘 06:00 이후 날짜를 ISO 문자열로 변환
      const todaySixAM = getTodaySixAM();
      const afterDate = todaySixAM.toISOString();
      
      console.log('API 호출 날짜 파라미터:', afterDate);
      
      const postsData = await postService.getPosts(0, 100, undefined, undefined, undefined, undefined, false); // 날짜 필터링 제거하여 모든 게시글 가져오기 (공지/뉴스 제외)
      console.log('새로 가져온 게시글 수:', postsData.length);
      setPosts(postsData);
    } catch (error) {
      console.error('게시글 가져오기 실패:', error);
      // 오류 발생 시 빈 배열로 설정하여 앱이 계속 동작하도록 함
      setPosts([]);
    }
  };

  const handlePostPress = (post: PostMarker) => {
    console.log('=== handlePostPress 호출됨 ===');
    console.log('게시글 클릭됨:', post.id, post.title);
    console.log('router 객체:', router);
    console.log('이동할 경로:', `/pages/post-detail?id=${post.id}`);
    
    try {
      // 게시글 상세 페이지로 이동
      router.push(`/pages/post-detail?id=${post.id}`);
      console.log('router.push 호출 완료');
    } catch (error) {
      console.error('router.push 오류:', error);
    }
  };

  const handleMarkerPress = (post: PostMarker) => {
    // 마커 클릭 시 모달로 표시
    setSelectedCluster({
      latitude: post.latitude,
      longitude: post.longitude,
      posts: [post],
      count: 1
    });
    setModalVisible(true);
  };

  const handleClusterPress = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedCluster(null);
  };

  const handleRegionChange = (newRegion: any) => {
    setRegion(newRegion);
  };

    // 빠른 위치 가져오기 (낮은 정확도로 먼저 시도)
  const getCurrentLocationFast = async (): Promise<LocationCoords | null> => {
    try {
      console.log('빠른 위치 가져오는 중...');
      
      // 낮은 정확도로 빠르게 위치 정보 가져오기
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      
      const { latitude, longitude } = location.coords;
      const locationCoords = { latitude, longitude };
      
      console.log('빠른 위치 획득:', locationCoords);
      setLocation(locationCoords);
      return locationCoords;
    } catch (error) {
      console.error('빠른 위치 정보 가져오기 실패:', error);
      return null;
    }
  };

  // 정확한 위치 가져오기 (기존 함수)
  const getCurrentLocation = async (): Promise<LocationCoords | null> => {
    try {
      console.log('정확한 위치 가져오는 중...');
      
      // 고정밀도로 위치 정보 가져오기
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      
      const { latitude, longitude } = location.coords;
      const locationCoords = { latitude, longitude };
      
      console.log('정확한 위치 획득:', locationCoords);
      setLocation(locationCoords);
      return locationCoords;
    } catch (error) {
      console.error('정확한 위치 정보를 가져오는데 실패했습니다:', error);
      
      // 실패 시 더 낮은 정확도로 재시도
      try {
        console.log('중간 정확도로 위치 재시도 중...');
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        const { latitude, longitude } = location.coords;
        const locationCoords = { latitude, longitude };
        
        console.log('중간 정확도로 위치 획득:', locationCoords);
        setLocation(locationCoords);
        return locationCoords;
      } catch (retryError) {
        console.error('위치 정보 재시도 실패:', retryError);
        return null;
      }
    }
  };

  // 백그라운드에서 정확한 위치 업데이트
  const updateLocationInBackground = async () => {
    setTimeout(async () => {
      try {
        console.log('백그라운드에서 정확한 위치 업데이트 중...');
        const accurateLocation = await getCurrentLocation();
        
        if (accurateLocation) {
          // 지도 영역을 부드럽게 업데이트
          const newRegion = {
            latitude: accurateLocation.latitude,
            longitude: accurateLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          setRegion(newRegion);
          console.log('정확한 위치로 지도 업데이트 완료:', newRegion);
        }
      } catch (error) {
        console.error('백그라운드 위치 업데이트 실패:', error);
      }
    }, 2000); // 2초 후에 정확한 위치 업데이트
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#A9CBFA" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        {/* 왼쪽: 로고 */}
        <View style={styles.logoContainer}>
          <Ionicons name="school" size={30} color="#000000" />
        </View>
        {/* 가운데: 타이틀 */}
        <View style={styles.titleContainer}>
          
        </View>
        {/* 오른쪽: 알림+검색 */}
        <View style={styles.topIconsContainer}>
          <TouchableOpacity style={styles.topIcon} onPress={() => router.push('/pages/notifications')}> 
            <Ionicons name="notifications" size={30} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIcon} onPress={() => router.push('/pages/search')}> 
            <Ionicons name="search" size={30} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Google Maps */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType="standard"
        initialRegion={region}
      >
        {/* 개별 게시글 마커들 */}
        {clusteredMarkers.individualMarkers.length > 0 && (
          <>
            {console.log('개별 마커 렌더링:', clusteredMarkers.individualMarkers.length, '개')}
            {clusteredMarkers.individualMarkers.map((post) => (
              <Marker
                key={`post-${post.id}`}
                coordinate={{
                  latitude: post.latitude,
                  longitude: post.longitude,
                }}
                title={post.title}
                description={post.building_name}
                onPress={() => handleMarkerPress(post)}
              >
                <CustomMarker post={post} onPress={handleMarkerPress} />
              </Marker>
            ))}
          </>
        )}

        {/* 클러스터 마커들 */}
        {clusteredMarkers.clusters.length > 0 && (
          <>
            {console.log('클러스터 마커 렌더링:', clusteredMarkers.clusters.length, '개')}
            {clusteredMarkers.clusters.map((cluster, index) => (
              <Marker
                key={`cluster-${index}`}
                coordinate={{
                  latitude: cluster.latitude,
                  longitude: cluster.longitude,
                }}
                onPress={() => handleClusterPress(cluster)}
              >
                <ClusterMarker cluster={cluster} onPress={handleClusterPress} />
              </Marker>
            ))}
          </>
        )}
      </MapView>
      
      {/* 플로팅 액션 버튼 */}
      <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('/pages/create-post')}>
        <Ionicons name="add" size={24} color="#000000" />
      </TouchableOpacity>
      
      {/* 하단 바 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/post-list')}>
          <Ionicons name="list" size={30} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon}>
          <Ionicons name="home" size={30} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIcon} onPress={() => router.push('/tabs/profile')}>
          <Ionicons name="person" size={30} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* 게시글 목록 모달 */}
      <PostListModal
        visible={modalVisible}
        posts={selectedCluster?.posts || []}
        buildingName={selectedCluster?.posts[0]?.building_name}
        onClose={handleModalClose}
        onPostPress={handlePostPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  logoContainer: {
    width: 60,
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    marginLeft: 20,
  },
  topIconsContainer: {
    width: 100,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 50,
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
  topIcon: { 
    marginLeft: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: { 
    flex: 1,
    borderRadius: 20,
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
    justifyContent: 'center',
    paddingVertical: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 