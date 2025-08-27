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
        <View style={styles.categoryContainer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.post_category}</Text>
          </View>
        </View>
        <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      
      <Text style={styles.postTitle} numberOfLines={1}>
        {item.post_title}
      </Text>
      
      <Text style={styles.commentContent} numberOfLines={3}>
        {item.content}
      </Text>
      
      <View style={styles.commentFooter}>
        <Ionicons name="chatbubble-outline" size={16} color="#000000" />
        <Text style={styles.commentLabel}>내 댓글</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>내 댓글을 불러오는 중...</Text>
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
            <Ionicons name="chatbubble-outline" size={64} color="#000000" />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
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
  categoryContainer: {
    flex: 1,
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
  commentTime: {
    fontSize: 12,
    color: '#6c757d',
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    lineHeight: 18,
  },
  commentContent: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
    marginBottom: 12,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentLabel: {
    fontSize: 12,
    color: '#000000',
    marginLeft: 4,
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
    paddingVertical: 60,
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
