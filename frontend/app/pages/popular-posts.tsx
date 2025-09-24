import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { postService, PostListResponse } from '../services/postService';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PopularPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchPopularPosts();
  }, []);

  const fetchPopularPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 모든 게시글을 가져와서 클라이언트에서 필터링
      const allPosts = await postService.getPosts(0, 100, undefined, undefined, undefined, undefined, false);
      
      // 공지, 새소식이 아니고 좋아요 수가 10개 이상인 게시글만 필터링
      const popular = allPosts.filter(post => 
        post.category !== '공지' && 
        post.category !== '새소식' && 
        post.heart_count >= 10
      );
      
      // 좋아요 수로 정렬
      const sortedPopular = popular.sort((a, b) => b.heart_count - a.heart_count);
      
      setPosts(sortedPopular);
    } catch (error) {
      console.error('인기 게시글 가져오기 실패:', error);
      Alert.alert('오류', '인기 게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchPopularPosts(true);
  };

  const handlePostPress = (postId: number) => {
    router.push(`/pages/post-detail?id=${postId}`);
  };

  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    
    return created.toLocaleDateString('ko-KR');
  };

  const renderPost = ({ item }: { item: PostListResponse }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => handlePostPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{getDisplayNickname(item.author_nickname)}</Text>
          <Text style={styles.postTime}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        <View style={styles.heartContainer}>
          <Ionicons name="heart" size={16} color="#000000" />
          <Text style={styles.heartCount}>{item.heart_count}</Text>
        </View>
      </View>
      
      <View style={styles.categoryContainer}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>
      
      <Text style={styles.postTitle} numberOfLines={2}>
        {item.title}
      </Text>
      
      <View style={styles.postFooter}>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={16} color="#000000" />
            <Text style={styles.statText}>{item.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#000000" />
            <Text style={styles.statText}>{item.comment_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>인기 게시글을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>🔥 인기 게시글</Text>
        
        <View style={styles.headerSpacer} />
      </View>
      
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionText}>좋아요 수가 10개 이상인 게시글은 인기 게시글에 등록됩니다.</Text>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        style={styles.postList}
        contentContainerStyle={styles.postListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color="#000000" />
            <Text style={styles.emptyTitle}>아직 인기 게시글이 없습니다</Text>
            <Text style={styles.emptySubtitle}>좋아요 10개 이상 받은 게시글이 여기에 표시됩니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  descriptionContainer: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  descriptionText: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
  },
  postList: {
    flex: 1,
  },
  postListContent: {
    padding: 16,
    backgroundColor: '#F8F9FA',
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
  heartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heartCount: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
    marginLeft: 4,
  },
  categoryContainer: {
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
    lineHeight: 22,
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
    color: '#000000',
    marginLeft: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
  },
});
