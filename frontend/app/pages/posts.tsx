import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { postService, PostListResponse } from '../services/postService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastFocusTime, setLastFocusTime] = useState(0); // 포커스 시간 추적
  const [shouldRefreshOnFocus, setShouldRefreshOnFocus] = useState(false); // 포커스 시 새로고침 여부
  const insets = useSafeAreaInsets();

  const categories = ['전체', '일상', '사람', '질문', '행사'];

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory]);

  // 화면이 포커스될 때마다 게시글 목록 새로고침 (하트 상태 등 반영)
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== Posts 화면 포커스됨 ===');
      
      // 새로고침이 필요한 경우에만 실행
      if (!shouldRefreshOnFocus) {
        console.log('새로고침이 필요하지 않음, 건너뜀');
        return;
      }
      
      // 이전 포커스 시간을 확인하여 너무 자주 새로고침하지 않도록 제한
      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTime;
      
      // 3초 이내에 다시 포커스되면 새로고침하지 않음 (더 관대하게)
      if (timeSinceLastFocus < 3000) {
        console.log('Posts 화면 포커스 간격이 너무 짧음, 새로고침 건너뜀');
        return;
      }
      
      setLastFocusTime(now);
      setShouldRefreshOnFocus(false); // 새로고침 플래그 리셋
      
      // 약간의 지연을 두어 post-detail에서의 변경사항이 서버에 반영될 시간을 줌
      setTimeout(() => {
        console.log('Posts 화면 포커스 후 지연 완료, 게시글 목록 새로고침 시작');
        fetchPosts(true); // 새로고침 모드로 호출
      }, 800); // 지연 시간을 더 늘려서 더 안정적으로
    }, [selectedCategory, lastFocusTime, shouldRefreshOnFocus])
  );

  const fetchPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
      }

      const currentPage = isRefresh ? 1 : page;
      const category = selectedCategory === '전체' ? undefined : selectedCategory || undefined;
      
      console.log('카테고리 필터:', category);
      
      const postsData = await postService.getPosts(
        (currentPage - 1) * 20,
        20,
        category,
        undefined,
        undefined,
        undefined,
        false  // 공지/뉴스 제외
      );

      if (isRefresh || currentPage === 1) {
        setPosts(postsData);
      } else {
        setPosts(prev => [...prev, ...postsData]);
      }

      setHasMore(postsData.length === 20);
      if (!isRefresh) {
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('게시글 목록 가져오기 실패:', error);
      Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCategoryPress = (category: string) => {
    const newCategory = category === '전체' ? null : category;
    setSelectedCategory(newCategory);
    setPage(1);
    setHasMore(true);
    setShouldRefreshOnFocus(false); // 카테고리 변경 시 새로고침 플래그 리셋
  };

  const onRefresh = () => {
    fetchPosts(true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchPosts();
    }
  };

  const handlePostPress = (postId: number) => {
    setShouldRefreshOnFocus(true); // 게시글 상세로 이동 시 새로고침 플래그 설정
    router.push(`/pages/post-detail?id=${postId}`);
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '일상':
        return '#4CAF50';
      case '사람':
        return '#2196F3';
      case '질문':
        return '#FF9800';
      case '행사':
        return '#E91E63';
      default:
        return '#9E9E9E';
    }
  };

  const renderPost = ({ item }: { item: PostListResponse }) => {
    console.log('게시글 렌더링:', {
      id: item.id,
      author: item.author_nickname,
      profileImage: item.author_profile_image_url
    });
    
    return (
      <TouchableOpacity 
        style={styles.postItem} 
        onPress={() => handlePostPress(item.id)}
        activeOpacity={0.7}
      >
        {/* 상단 정보 */}
        <View style={styles.postHeader}>
          <View style={styles.postInfo}>
            <View style={styles.authorContainer}>
              {item.author_profile_image_url ? (
                <Image 
                  source={{ 
                    uri: item.author_profile_image_url,
                    cache: 'reload'
                  }} 
                  style={styles.authorProfileImage} 
                />
              ) : (
                <Image 
                  source={require('../../assets/images/camsaw_human.png')} 
                  style={styles.authorProfileImage} 
                />
              )}
              <Text style={styles.authorText}>{item.author_nickname}</Text>
            </View>
            <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(item.category) }]}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          </View>
          <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
        </View>

        {/* 제목 */}
        <Text style={styles.postTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {/* 하단 정보 */}
        <View style={styles.postFooter}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{item.building_name || '위치 없음'}</Text>
          </View>
          <View style={styles.engagementInfo}>
            <View style={styles.engagementItem}>
              <Text style={styles.engagementIcon}>❤️</Text>
              <Text style={styles.engagementText}>{item.heart_count}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Text style={styles.engagementIcon}>💬</Text>
              <Text style={styles.engagementText}>{item.comment_count}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Text style={styles.engagementIcon}>👁️</Text>
              <Text style={styles.engagementText}>{item.view_count}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>모든 게시글을 불러왔습니다</Text>
        </View>
      );
    }
    return null;
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.container}>
        {/* 상단 노치 영역 */}
        <View style={[styles.topNotch, { height: insets.top }]} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>게시글</Text>
        </View>
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
      
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게시글</Text>
        <TouchableOpacity style={styles.searchButton} onPress={() => router.push('/pages/search')}>
          
        <Image source={require('../../assets/images/camsaw_search.png')} style={{ width: 45, height: 45, resizeMode: 'contain' }} />
        </TouchableOpacity>
      </View>

      {/* 카테고리 필터 */}
      <View style={styles.categoryFilter}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryFilterButton,
                selectedCategory === category && styles.categoryFilterButtonSelected
              ]}
              onPress={() => handleCategoryPress(category)}
            >
              <Text style={[
                styles.categoryFilterText,
                selectedCategory === category && styles.categoryFilterTextSelected
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 게시글 목록 */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        style={styles.postList}
        contentContainerStyle={styles.postListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
      />
      
      {/* 하단 노치 영역 */}
      <View style={[styles.bottomNotch, { height: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 80,
  },
  backButton: {
    padding: 8,
    height: 45,
    width: 45 ,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 30,
    color: '#FFFFFF',  
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'GmarketSans',
    flex: 1,
    textAlign: 'center',
  },
  searchButton: {
    alignItems: 'center',
  },
  categoryFilter: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryScrollContainer: {
    paddingHorizontal: 20,
  },
  categoryFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryFilterButtonSelected: {
    backgroundColor: '#2D3A4A',
    borderColor: '#2D3A4A',
  },
  categoryFilterText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'GmarketSans',
    fontWeight: '500',
  },
  categoryFilterTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  postList: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  postListContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  postItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  authorProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    resizeMode: 'cover',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  authorText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'GmarketSans',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'GmarketSans',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
    fontFamily: 'GmarketSans',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'GmarketSans',
  },
  engagementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  engagementIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  engagementText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'GmarketSans',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'GmarketSans',
  },
  topNotch: {
    backgroundColor: '#2D3A4A', // 상단 노치 색상
  },
  bottomNotch: {
    backgroundColor: '#FFFFFF', // 하단 노치 색상
  },
}); 