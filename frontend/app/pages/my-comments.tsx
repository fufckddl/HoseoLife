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
import { postService } from '../services/postService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Comment {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_title: string;
  post_category: string;
}

export default function MyCommentsScreen() {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchMyComments();
  }, []);

  const fetchMyComments = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 내가 작성한 댓글 가져오기
      const myComments = await postService.getMyComments();
      setComments(myComments);
    } catch (error) {
      console.error('내 댓글 가져오기 실패:', error);
      
      let errorMessage = '내 댓글을 불러오는데 실패했습니다.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('오류', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchMyComments(true);
  };

  const handleCommentPress = (postId: number) => {
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

  const renderComment = ({ item }: { item: Comment }) => (
    <TouchableOpacity
      style={styles.commentItem}
      onPress={() => handleCommentPress(item.post_id)}
      activeOpacity={0.7}
    >
      <View style={styles.commentHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>내 댓글</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
        </View>
      </View>
      
      <Text style={styles.postTitle} numberOfLines={2}>
        {item.post_title}
      </Text>
      
      <View style={styles.commentFooter}>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>댓글</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.categoryText}>{item.post_category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: '#ffffff' }]}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>내 댓글을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#ffffff' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>내가 작성한 댓글</Text>
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id.toString()}
        style={styles.commentList}
        contentContainerStyle={styles.commentListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={64} color="#adb5bd" />
            <Text style={styles.emptyTitle}>작성한 댓글이 없습니다</Text>
            <Text style={styles.emptySubtitle}>첫 번째 댓글을 작성해보세요!</Text>
          </View>
        }
      />
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
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    position: 'relative',
  },
  backButton: {
    padding: 8,
    position: 'absolute',
    left: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  commentList: {
    flex: 1,
  },
  commentListContent: {
    padding: 16,
  },
  commentItem: {
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
  commentHeader: {
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
  commentTime: {
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
  commentFooter: {
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
  categoryText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
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
  },
});

