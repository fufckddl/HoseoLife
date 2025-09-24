import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { postService, PostListResponse } from '../services/postService';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

export default function ScrapListScreen() {
  const router = useRouter();
  const [scraps, setScraps] = React.useState<PostListResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchScraps = async () => {
    try {
      setLoading(true);
      const scrapsData = await postService.getMyScraps(0, 100);
      setScraps(scrapsData || []);
      console.log('스크랩 목록 로드 완료:', scrapsData?.length || 0, '개');
    } catch (error) {
      console.error('스크랩 목록 로드 실패:', error);
      setScraps([]); // 오류 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchScraps();
    setRefreshing(false);
  };

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      fetchScraps();
    }, [])
  );

  const handlePostPress = (post: PostListResponse) => {
    router.push(`/pages/post-detail?id=${post.id}`);
  };

  const getCategoryColor = (category: string) => {
    return '#000000';
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
      <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>스크랩 목록</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>스크랩 목록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스크랩 목록</Text>
      </View>

      {scraps.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>스크랩한 게시글이 없습니다</Text>
          <Text style={styles.emptySubtitle}>
            관심 있는 게시글을 스크랩해보세요!
          </Text>
        </View>
      ) : (
        <FlatList
          data={scraps}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
                          colors={['#000000']}
            tintColor="#000000"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  list: {
    flex: 1,
  },
  listContent: {
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
});
