import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Linking, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postService, PostListResponse } from '../services/postService';
import { clusterMarkers, PostMarker, Cluster } from '../utils/clustering';
import { getDisplayNickname } from '../utils/userUtils';
import { CustomMarker, ClusterMarker } from '../components/CustomMarker';
import { PostListModal } from '../components/PostListModal';
import { getCurrentKoreaTime, formatKoreaTime, getTodaySixAM, debugTimeInfo } from '../utils/dateUtils';
import { TopBar } from '../components/layout/TopBar';
import { BottomBar } from '../components/layout/BottomBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildingService, Building } from '../services/buildingService';
import { userService, UserInfo } from '../services/userService';

type LocationCoords = {
  latitude: number;
  longitude: number;
};

export default function LocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 위치 상태
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null); // meters(±)
  const [loading, setLoading] = useState(true);

  // 지도 상태
  const [region, setRegion] = useState<Region>({
    latitude: 36.7789,
    longitude: 127.2835,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showBuildingsOnMap, setShowBuildingsOnMap] = useState(false);

  // 사용자 설정 저장/불러오기
  const saveBuildingSetting = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('showBuildingsOnMap', JSON.stringify(enabled));
    } catch (error) {
      console.warn('건물 표시 설정 저장 실패:', error);
    }
  };

  const loadBuildingSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('showBuildingsOnMap');
      if (saved !== null) {
        const enabled = JSON.parse(saved);
        setShowBuildingsOnMap(enabled);
      } else {
        // 저장된 설정이 없으면 기본값 false (빠른 진입을 위해)
        setShowBuildingsOnMap(false);
      }
    } catch (error) {
      console.warn('건물 표시 설정 불러오기 실패:', error);
      setShowBuildingsOnMap(false);
    }
  };

  // 게시글/클러스터
  const [posts, setPosts] = useState<PostListResponse[]>([]);
  const [clusteredMarkers, setClusteredMarkers] = useState<{ clusters: Cluster[]; individualMarkers: PostMarker[] }>({
    clusters: [],
    individualMarkers: [],
  });

  // 건물 데이터
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [showBuildingOutlines, setShowBuildingOutlines] = useState(true);
  
  // 사용자 정보 및 관리자 권한
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 모달
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  // 위치 구독 핸들러
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView | null>(null);

  // ------------------------
  // 유틸: 하버사인 거리(m)
  // ------------------------
  const haversine = (a: LocationCoords, b: LocationCoords) => {
    const R = 6371000; // m
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // ------------------------
  // 권한 및 초기 위치 + 연속 추적 설정
  // ------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1) 서비스 활성화 확인
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationEnabled) {
          Alert.alert(
            '위치 서비스 비활성화',
            '정확한 위치를 위해 기기 위치 서비스를 활성화하세요.',
            [
              { text: '설정 열기', onPress: () => Linking.openSettings() },
              { text: '닫기', style: 'cancel' },
            ]
          );
          setLoading(false);
          return;
        }

        // 2) 포그라운드 권한
        let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (canAskAgain) {
            const req = await Location.requestForegroundPermissionsAsync();
            status = req.status;
          }
        }
        if (status !== 'granted') {
          Alert.alert(
            '권한 필요',
            '주변 게시글을 보여주려면 위치 권한이 필요합니다. 설정에서 허용해주세요.',
            [{ text: '설정 열기', onPress: () => Linking.openSettings() }]
          );
          setLoading(false);
          return;
        }

        // 3) 빠른 초기 위치 설정 (안드로이드 최적화)
        // Expo Location API의 getCurrentPositionAsync는 timeout 옵션을 지원하지 않으므로 제거
        const fast = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,  // 빠른 로딩을 위해 Lowest 사용
        }).catch(() => null);

        if (fast) {
          const { latitude, longitude, accuracy } = fast.coords;
          const pos = { latitude, longitude };
          setLocation(pos);
          setLocationAccuracy(accuracy ?? null);
          const initialRegion = {
            latitude,
            longitude,
            ...accuracyToDelta(accuracy ?? 100),  // 더 넓은 초기 뷰로 빠른 로딩
          };
          setRegion(initialRegion);
          
          // 지도 애니메이션 최적화
          mapRef.current?.animateCamera({ center: pos }, { duration: 300 });
        } else {
          // 위치를 가져올 수 없는 경우 기본 위치 사용 (호서대 천안캠퍼스)
          const defaultPos = { latitude: 36.827828, longitude: 127.183290 };
          setLocation(defaultPos);
          setLocationAccuracy(null);
          const defaultRegion = {
            latitude: 36.827828,
            longitude: 127.183290,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(defaultRegion);
        }

        // 5) 고정밀 연속 추적 시작 (안드로이드 최적화)
        if (watchSubRef.current) {
          watchSubRef.current.remove();
          watchSubRef.current = null;
        }
        watchSubRef.current = await Location.watchPositionAsync(
          {
            // 안드로이드 성능 최적화를 위한 설정
            accuracy: Location.Accuracy.Lowest,  // Balanced에서 Lowest로 변경하여 빠른 로딩
            timeInterval: 30000,    // 30초마다 (10초 → 30초)
            distanceInterval: 50,   // 50m 이동 시 (15m → 50m)
            mayShowUserSettingsDialog: true,
          },
          (loc) => {
            const { latitude, longitude, accuracy } = loc.coords;
            const next = { latitude, longitude };
            setLocation(next);
            setLocationAccuracy(accuracy ?? null);

            // 의미 있는 이동일 때만 지도 갱신 (거리 임계값 증가로 성능 향상)
            if (!region || !location || haversine(location, next) >= 100) {
              const nextRegion = {
                latitude,
                longitude,
                ...accuracyToDelta(accuracy ?? 50),
              };
              setRegion(nextRegion);
              mapRef.current?.animateCamera({ center: next }, { duration: 350 });
            }
          }
        );

        setLoading(false);
      } catch (e: any) {
        console.error('위치 초기화 실패:', e?.message ?? e);
        Alert.alert('오류', '위치 서비스를 시작하는 데 실패했습니다.');
        setLoading(false);
      }
    })();

    // 언마운트 시 구독 해제
    return () => {
      if (watchSubRef.current) {
        watchSubRef.current.remove();
        watchSubRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 게시글, 건물, 사용자 정보 초기 로드 (병렬 처리)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 병렬로 데이터 로드하여 성능 향상
        await Promise.all([
          fetchPosts(),
          fetchBuildings(),
          fetchUserInfo(),
          loadBuildingSetting() // 사용자 건물 표시 설정 불러오기
        ]);
      } catch (error) {
        console.error('초기 데이터 로드 실패:', error);
      }
    };
    
    loadInitialData();
  }, []);

  // 건물 표시 설정 변경 시 저장
  useEffect(() => {
    if (mapLoaded) { // 지도가 로드된 후에만 저장
      saveBuildingSetting(showBuildingsOnMap);
    }
  }, [showBuildingsOnMap, mapLoaded]);

  // 포커스시 새로고침 (성능 최적화)
  useFocusEffect(
    React.useCallback(() => {
      // 지연 시간을 줄여서 더 빠른 반응성 제공
      const timeoutId = setTimeout(() => {
        fetchPosts();
      }, 100);  // 300ms → 100ms로 단축
      
      return () => clearTimeout(timeoutId);
    }, [])
  );

  // 게시글 → 마커 → 클러스터
  useEffect(() => {
    if (posts.length > 0) {
      const postMarkers: PostMarker[] = posts
        .filter((post) => post.building_latitude && post.building_longitude)
        .map((post) => ({
          id: post.id,
          latitude: parseFloat(post.building_latitude!),
          longitude: parseFloat(post.building_longitude!),
          title: post.title,
          category: post.category,
          building_name: post.building_name,
          author_nickname: getDisplayNickname(post.author_nickname),
          created_at: post.created_at,
          view_count: post.view_count,
          heart_count: post.heart_count,
          comment_count: post.comment_count,
        }));

      const clustered = clusterMarkers(postMarkers, 15, 50);
      setClusteredMarkers(clustered);
    } else {
      setClusteredMarkers({ clusters: [], individualMarkers: [] });
    }
  }, [posts]);

  const fetchPosts = async () => {
    try {
      debugTimeInfo();
      const todaySixAM = getTodaySixAM();
      const _afterDate = todaySixAM.toISOString(); // 현재는 전체 로드

      const postsData = await postService.getPosts(0, 100, undefined, undefined, undefined, undefined, false);
      setPosts(postsData);
    } catch (error) {
      console.error('게시글 가져오기 실패:', error);
      setPosts([]);
    }
  };

  const fetchBuildings = async () => {
    try {
      console.log('🏢 건물 데이터 가져오는 중...');
      const buildingsData = await buildingService.getAllBuildings();
      setBuildings(buildingsData);
      console.log(`✅ ${buildingsData.length}개 건물 데이터 로드 완료`);
    } catch (error) {
      console.error('건물 데이터 가져오기 실패:', error);
      setBuildings([]);
    }
  };

  const fetchUserInfo = async () => {
    try {
      console.log('👤 사용자 정보 가져오는 중...');
      const user = await userService.getCurrentUserInfo();
      setUserInfo(user);
      setIsAdmin(user?.is_admin === true);
      console.log(`✅ 사용자 정보 로드 완료 - 관리자: ${user?.is_admin ? '예' : '아니오'}`);
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      setUserInfo(null);
      setIsAdmin(false);
    }
  };

  // 마커/클러스터 이벤트
  const handlePostPress = (post: PostMarker) => {
    try {
      router.push(`/pages/post-detail?id=${post.id}`);
    } catch (error) {
      console.error('router.push 오류:', error);
    }
  };
  const handleMarkerPress = (post: PostMarker) => {
    setSelectedCluster({ latitude: post.latitude, longitude: post.longitude, posts: [post], count: 1 });
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
  const handleRegionChange = (newRegion: Region) => setRegion(newRegion);

  // 건물 경계선 토글
  const toggleBuildingOutlines = () => {
    setShowBuildingOutlines(!showBuildingOutlines);
  };

  // 캠퍼스 이동 함수들
  const moveToCheonanCampus = () => {
    const cheonanRegion = {
      latitude: 36.827828,
      longitude: 127.183290,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(cheonanRegion);
    mapRef.current?.animateCamera({ center: { latitude: 36.827828, longitude: 127.183290 } }, { duration: 1000 });
  };

  const moveToAsanCampus = () => {
    const asanRegion = {
      latitude: 36.736628,
      longitude: 127.075351,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(asanRegion);
    mapRef.current?.animateCamera({ center: { latitude: 36.736628, longitude: 127.075351 } }, { duration: 1000 });
  };

  // 정확도 → 지도 델타(줌) 변환
  function accuracyToDelta(acc: number) {
    // acc 10m → delta ~0.0015, acc 100m → delta ~0.01 근사
    const clamped = Math.min(Math.max(acc, 5), 200);
    const delta = (clamped / 1000) * 0.15 + 0.0012; // 경험적 스케일
    return { latitudeDelta: delta, longitudeDelta: delta };
    // 필요시 지역마다 종횡비 보정 가능
  }

  // 델타 → 대략적 줌(안드로이드 카메라 애니메이션용)
  function deltaToZoom(delta: number) {
    // 대략식: zoom ≈ log2(360 / delta)
    const z = Math.log2(360 / delta);
    return Math.min(Math.max(z, 3), 20);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#A9CBFA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="위치" showLogo={false} />

      {/* 위치 정확도 표시 - 관리자만 */}
      {location && isAdmin && (
        <View style={styles.locationStatus}>
          <View style={styles.locationIndicator}>
            <Ionicons
              name="location"
              size={16}
              color={locationAccuracy && locationAccuracy <= 50 ? '#4CAF50' : '#FF9800'}
            />
            <Text style={styles.locationStatusText}>
              {locationAccuracy ? `위치 정확도: ±${locationAccuracy.toFixed(0)}m` : '위치 확인됨'}
            </Text>
          </View>
          
          {/* 건물 경계선 토글 버튼 - 관리자만 */}
          <TouchableOpacity 
            style={styles.buildingToggleButton}
            onPress={toggleBuildingOutlines}
          >
            <Ionicons 
              name={showBuildingOutlines ? "eye" : "eye-off"} 
              size={20} 
              color={showBuildingOutlines ? "#4CAF50" : "#666"} 
            />
            <Text style={[
              styles.buildingToggleText,
              { color: showBuildingOutlines ? "#4CAF50" : "#666" }
            ]}>
              {showBuildingOutlines ? "건물 경계선 숨기기" : "건물 경계선 보기"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 지도 설정 버튼들 - 모든 사용자 */}
      {location && (
        <View style={styles.mapControlsContainer}>
          {/* 3D 건물 표시 토글 버튼 - 모든 사용자 */}
          <TouchableOpacity 
            style={[styles.campusButton, showBuildingsOnMap && styles.activeButton]}
            onPress={() => setShowBuildingsOnMap(!showBuildingsOnMap)}
          >
            <Ionicons 
              name={showBuildingsOnMap ? "business" : "business-outline"} 
              size={16} 
              color={showBuildingsOnMap ? "#ffffff" : "#2196F3"} 
            />
            <Text style={[
              styles.campusButtonText,
              { color: showBuildingsOnMap ? "#ffffff" : "#2196F3" }
            ]}>
              {showBuildingsOnMap ? "3D 건물 ON" : "3D 건물 OFF"}
            </Text>
          </TouchableOpacity>
          
          {/* 캠퍼스 이동 버튼들 */}
          <TouchableOpacity 
            style={styles.campusButton}
            onPress={moveToCheonanCampus}
          >
            <Ionicons name="school" size={16} color="#2196F3" />
            <Text style={styles.campusButtonText}>천안캠퍼스</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.campusButton}
            onPress={moveToAsanCampus}
          >
            <Ionicons name="school" size={16} color="#FF9800" />
            <Text style={styles.campusButtonText}>아산캠퍼스</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 지도 (안드로이드 성능 최적화) */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={handleRegionChange}
        onMapReady={() => {
          console.log('🗺️ 지도 로딩 완료!');
          // 지도 로딩 완료 후 상태 업데이트 (건물 표시는 사용자 설정에 따라)
          setTimeout(() => {
            setMapLoaded(true);
            console.log('🗺️ 지도 상태 업데이트 완료');
            // 건물 표시는 사용자가 직접 토글해야 활성화됨 (빠른 진입을 위해)
          }, 500); // 0.5초 후 지도 상태만 업데이트
        }}
        onMapLoaded={() => {
          console.log('🗺️ MapView onMapLoaded 이벤트 발생');
        }}
        showsUserLocation
        showsMyLocationButton
        mapType="standard"
        initialRegion={region}
        // 안드로이드 성능 최적화 설정
        loadingEnabled={true}
        loadingIndicatorColor="#A9CBFA"
        loadingBackgroundColor="#ffffff"
        moveOnMarkerPress={false}
        showsCompass={true}
        showsScale={false}
        showsBuildings={mapLoaded && showBuildingsOnMap}
        showsIndoors={false}
        showsTraffic={false}
        showsPointsOfInterest={false}
        maxZoomLevel={18}
        minZoomLevel={3}
      >
        {/* 정확도 원 표시 */}
        {location && locationAccuracy && locationAccuracy > 0 && (
          <Circle
            center={location}
            radius={locationAccuracy}
            strokeWidth={1}
            strokeColor="rgba(33, 150, 243, 0.5)"
            fillColor="rgba(33, 150, 243, 0.15)"
            zIndex={1}
          />
        )}

        {/* 건물 경계선 표시 - 관리자만 */}
        {isAdmin && showBuildingOutlines && buildings.map((building) => {
          if (building.building_type === 'polygon' && building.coordinates.length > 0) {
            // 폴리곤 건물: 좌표들을 선으로 연결하고 첫 번째 점으로 닫기
            const coordinates = [...building.coordinates, building.coordinates[0]];
            return (
              <Polyline
                key={`building-outline-${building.id}`}
                coordinates={coordinates}
                strokeColor="#FF6B6B"
                strokeWidth={2}
                lineDashPattern={[5, 5]}
                zIndex={2}
              />
            );
          } else if (building.building_type === 'rectangle' && building.coordinates.length >= 4) {
            // 사각형 건물: 4개 점으로 사각형 그리기 (시계방향 순서)
            const [topLeft, topRight, bottomRight, bottomLeft] = building.coordinates;
            const rectangleCoords = [
              topLeft,    // 북서쪽
              topRight,   // 북동쪽
              bottomRight, // 남동쪽
              bottomLeft,  // 남서쪽
              topLeft,    // 닫기
            ];
            return (
              <Polyline
                key={`building-outline-${building.id}`}
                coordinates={rectangleCoords}
                strokeColor="#4ECDC4"
                strokeWidth={2}
                lineDashPattern={[5, 5]}
                zIndex={2}
              />
            );
          }
          return null;
        })}

        {/* 개별 마커 */}
        {clusteredMarkers.individualMarkers.map((post) => (
          <Marker
            key={`post-${post.id}`}
            coordinate={{ latitude: post.latitude, longitude: post.longitude }}
            title={post.title}
            description={post.building_name}
            onPress={() => handleMarkerPress(post)}
          >
            <CustomMarker post={post} onPress={handleMarkerPress} />
          </Marker>
        ))}

        {/* 클러스터 */}
        {clusteredMarkers.clusters.map((cluster, index) => (
          <Marker
            key={`cluster-${index}`}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={() => handleClusterPress(cluster)}
          >
            <ClusterMarker cluster={cluster} onPress={handleClusterPress} />
          </Marker>
        ))}
      </MapView>

      <BottomBar
        activeTab="location"
        showFloatingButton
        onFloatingButtonPress={() => router.push('/pages/create-post')}
      />

      <PostListModal
        visible={modalVisible}
        posts={selectedCluster?.posts || []}
        buildingName={selectedCluster?.posts[0]?.building_name}
        onClose={handleModalClose}
        onPostPress={handlePostPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  locationStatus: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  locationIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  locationStatusText: { marginLeft: 6, fontSize: 12, color: '#666', fontWeight: '500' },
  buildingToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buildingToggleText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  mapControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  campusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  campusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  campusButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  map: { flex: 1, borderRadius: 20 },
});