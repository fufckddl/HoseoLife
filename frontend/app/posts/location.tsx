import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { postService, PostListResponse } from '../services/postService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

export default function LocationBoardScreen() {
  const router = useRouter();
  const [posts, setPosts] = React.useState<PostListResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const insets = useSafeAreaInsets();

  const fetchPosts = async () => {
    try {
      setLoading(true);
      // 카테고리가 "위치"인 게시글만 가져오기
      const postsData = await postService.getPosts(0, 100, "위치", undefined, undefined, undefined, false);
      setPosts(postsData);
      console.log('위치 게시글 로드 완료:', postsData.length, '개');
    } catch (error) {
      console.error('위치 게시글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      fetchPosts();
    }, [])
  );

  const handlePostPress = (post: PostListResponse) => {
    router.push(`/pages/post-detail?id=${post.id}`);
  };

  const handleSearch = () => {
    router.push({
      pathname: '/pages/search',
      params: { category: '위치', query: '' }
    });
  };

  const handleCreatePost = () => {
    router.push('/pages/create-post');
  };

  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    
    // 한국 시간대로 변환 (UTC+9)
    const kstOffset = 9 * 60; // 9시간을 분으로
    const nowKST = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const createdKST = new Date(created.getTime() + (kstOffset * 60 * 1000));
    
    const diffInMinutes = Math.floor((nowKST.getTime() - createdKST.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금전';
    if (diffInMinutes < 60) return `${diffInMinutes}분전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일전`;
  };

  const renderPostItem = ({ item }: { item: PostListResponse }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => handlePostPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{getDisplayNickname(item.author_nickname)}</Text>
          <Text style={styles.postTime}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </View>
      
      <Text style={styles.postTitle} numberOfLines={2}>
        {item.title}
      </Text>
      
      {/* 위치 정보 표시 */}
      {item.building_name && (
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={16} color="#6c757d" />
          <Text style={styles.locationText}>{item.building_name}</Text>
        </View>
      )}
      
      <View style={styles.postFooter}>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{item.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{item.comment_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{item.heart_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>위치 게시판</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Ionicons name="search" size={24} color="#000000" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreatePost}
          >
            <Ionicons name="add" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 게시글 목록 */}
      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.postList}
        contentContainerStyle={styles.postListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* 빈 상태 */}
      {!loading && posts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#adb5bd" />
          <Text style={styles.emptyTitle}>아직 게시글이 없습니다</Text>
          <Text style={styles.emptySubtitle}>첫 번째 게시글을 작성해보세요!</Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={handleCreatePost}
          >
            <Text style={styles.emptyCreateButtonText}>게시글 작성하기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    padding: 8,
    marginRight: 8,
  },
  createButton: {
    padding: 8,
  },
  postList: {
    flex: 1,
  },
  postListContent: {
    padding: 16,
  },
  postItem: {
    backgroundColor: '#ffffff',
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
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  postTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    lineHeight: 22,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 4,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCreateButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyCreateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
