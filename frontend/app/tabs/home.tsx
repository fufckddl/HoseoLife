import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, Alert, Image, Linking, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postService, PostListResponse } from '../services/postService';
import { TopBar } from '../components/layout/TopBar';
import { BottomBar } from '../components/layout/BottomBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import
import { notificationService } from '../services/notificationService'; // 🆕 알림 서비스 import
import { useAuth } from '../contexts/AuthContext'; // 🆕 인증 컨텍스트 import
import { blockService } from '../services/blockService'; // 🆕 차단 서비스 import

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth(); // 🆕 사용자 정보 가져오기
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<PostListResponse[]>([]);
  const [popularPosts, setPopularPosts] = useState<PostListResponse[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([]); // 🆕 차단된 사용자 ID 목록
  const insets = useSafeAreaInsets();
  const isLoadingRef = useRef(false);
  

  const fetchHomeData = useCallback(async () => {
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      setLoading(true);
      
      // 🆕 차단 목록 가져오기
      const blockedUsers = await blockService.getMyBlocks();
      const blockedIds = blockedUsers.map(b => b.blocked_id);
      setBlockedUserIds(blockedIds);
      
      // 한 번의 API 호출로 모든 게시글 가져오기
      const allPosts = await postService.getPosts(0, 100, undefined, undefined, undefined, undefined, false);
      
      // 🆕 차단된 사용자의 게시글 제외
      const filteredPosts = allPosts.filter(post => !blockedIds.includes(post.author_id));
      
      // 최신 게시글 (최대 5개)
      const recent = filteredPosts.slice(0, 5);
      setRecentPosts(recent);
      
      // 인기 게시글 (좋아요 수가 많은 순, 최대 5개)
      const popular = filteredPosts
        .filter(post => post.heart_count >= 5)
        .sort((a, b) => b.heart_count - a.heart_count)
        .slice(0, 5);
      setPopularPosts(popular);
      
    } catch (error) {
      console.error('홈 데이터 가져오기 실패:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // 초기 데이터 가져오기
  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData, user?.id]);



  const handlePostPress = (postId: number) => {
    router.push(`/pages/post-detail?id=${postId}`);
  };

  const handleSchoolPress = async () => {
    const url = 'https://www.hoseo.ac.kr/Home/Main.mbz';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('오류', '링크를 열 수 없습니다.');
      }
    } catch (error) {
      console.error('링크 열기 실패:', error);
      Alert.alert('오류', '링크를 열 수 없습니다.');
    }
  };

  const handleShuttleBusPress = () => {
    router.push('/pages/shuttle-bus');
  };

  const handleSchedulePress = () => {
    router.push('/pages/schedule');
  };


  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금전';
    if (diffInMinutes < 60) return `${diffInMinutes}분전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일전`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#A9CBFA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <TopBar 
        title="홈"
        showSearchButton={true}
        rightIcon="notifications"
        onRightIconPress={() => router.push('/pages/notifications')}
      />

      {/* 메인 콘텐츠 - 스크롤 가능 */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 빠른 메뉴 */}
        <View style={styles.quickMenu}>
          <TouchableOpacity style={styles.quickMenuItem} onPress={handleSchoolPress}>
            <Ionicons name="school" size={30} color="#2D3A4A" />
            <Text style={styles.quickMenuText}>학교</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickMenuItem} onPress={handleShuttleBusPress}>
            <Ionicons name="bus" size={30} color="#2D3A4A" />
            <Text style={styles.quickMenuText}>셔틀버스/시내버스</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickMenuItem} onPress={handleSchedulePress}>
            <Ionicons name="calendar" size={30} color="#2D3A4A" />
            <Text style={styles.quickMenuText}>강의 시간표</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickMenuItem}>
            <Ionicons name="library" size={30} color="#2D3A4A" />
            <Text style={styles.quickMenuText}>도서관</Text>
          </TouchableOpacity>
        </View>

        {/* 최신 게시글 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최신 게시글</Text>
          {recentPosts.length > 0 ? (
            recentPosts.slice(0, 5).map((post) => (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postItem}
                onPress={() => handlePostPress(post.id)}
              >
                <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.postMeta}>
                  {getDisplayNickname(post.author_nickname)} • {formatTimeAgo(post.created_at)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>최신 게시글이 없습니다</Text>
          )}
        </View>

        {/* 인기 게시글 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>인기 게시글</Text>
          {popularPosts.length > 0 ? (
            popularPosts.map((post) => (
              <TouchableOpacity 
                key={post.id} 
                style={styles.postItem}
                onPress={() => handlePostPress(post.id)}
              >
                <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.postMeta}>
                  {getDisplayNickname(post.author_nickname)} • ❤️ {post.heart_count} • {formatTimeAgo(post.created_at)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>인기 게시글이 없습니다</Text>
          )}
        </View>


      </ScrollView>
      
      {/* 하단 바 */}
      <BottomBar 
        activeTab="home"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  quickMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  quickMenuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  quickMenuText: {
    fontSize: 12,
    color: '#2D3A4A',
    marginTop: 8,
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100, // 하단 바 공간 확보
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  postItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 5,
  },
  postMeta: {
    fontSize: 12,
    color: '#666666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    padding: 20,
  },
}); 