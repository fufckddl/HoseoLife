import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, SafeAreaView, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { postService, PostListResponse } from '../services/postService';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { BottomBar } from '../components/layout/BottomBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

export default function PostListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [popularPosts, setPopularPosts] = useState<PostListResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  // 게시판 데이터
  const [boards, setBoards] = useState([
    { id: 'location', name: '위치', description: '호서대학교 내에서 작성된 게시글을 확인하는 공간' },
    { id: 'free', name: '자유', description: '자유로운 이야기를 나누는 공간' },
    { id: 'secret', name: '비밀', description: '익명으로 비밀을 공유하는 공간' },
    { id: 'freshman', name: '새내기', description: '새내기를 위한 정보 공유' },
    { id: 'info', name: '정보', description: '유용한 정보를 공유하는 공간' },
    { id: 'club', name: '동아리', description: '동아리 활동과 모집 정보' },
    { id: 'promotion', name: '홍보', description: '다양한 홍보와 광고' },
    { id: 'event', name: '행사', description: '학교 행사와 이벤트 정보' },
  ]);

  // 인기 게시글 가져오기
  useEffect(() => {
    fetchPopularPosts();
    fetchBoards();
  }, []);

  const fetchPopularPosts = async () => {
    try {
      setLoading(true);
      // 모든 게시글을 가져와서 클라이언트에서 필터링
      const allPosts = await postService.getPosts(0, 100, undefined, undefined, undefined, undefined, false);
      
      // 공지, 새소식이 아니고 좋아요 수가 10개 이상인 게시글만 필터링
      const popular = allPosts.filter(post => 
        post.category !== '공지' && 
        post.category !== '새소식' && 
        post.heart_count >= 10
      );
      
      // 좋아요 수로 정렬하고 상위 10개만 선택
      const sortedPopular = popular
        .sort((a, b) => b.heart_count - a.heart_count)
        .slice(0, 10);
      
      setPopularPosts(sortedPopular);
    } catch (error) {
      console.error('인기 게시글 가져오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoards = async () => {
    try {
      const response = await fetch('https://hoseolife.kro.kr/boards');
      if (response.ok) {
        const boardData = await response.json();
        // 기존 기본 게시판과 새로운 승인된 게시판을 합침
        const defaultBoards = [
          { id: 'location', name: '위치', description: '호서대학교 내에서 작성된 게시글을 확인하는 공간' },
          { id: 'free', name: '자유', description: '자유로운 이야기를 나누는 공간' },
          { id: 'secret', name: '비밀', description: '익명으로 비밀을 공유하는 공간' },
          { id: 'freshman', name: '새내기', description: '새내기를 위한 정보 공유' },
          { id: 'info', name: '정보', description: '유용한 정보를 공유하는 공간' },
          { id: 'club', name: '동아리', description: '동아리 활동과 모집 정보' },
          { id: 'promotion', name: '홍보', description: '다양한 홍보와 광고' },
          { id: 'event', name: '행사', description: '학교 행사와 이벤트 정보' },
        ];
        
        // 승인된 게시판을 기본 게시판에 추가
        const approvedBoards = boardData.map((board: any) => ({
          id: `board_${board.id}`,
          name: board.name,
          description: board.description
        }));
        
        setBoards([...defaultBoards, ...approvedBoards]);
      }
    } catch (error) {
      console.error('게시판 목록 가져오기 실패:', error);
    }
  };

  const handleBoardPress = (boardId: string, boardName: string) => {
    // 게시판 클릭 시 해당 게시판으로 이동
    if (boardId.startsWith('board_')) {
      // 🔧 승인된 게시판인 경우 - @[id] 화면으로 이동
      const boardIdNum = boardId.replace('board_', '');
      router.push(`/posts/board/${boardIdNum}` as any);
    } else {
      // 기본 게시판인 경우
      switch (boardId) {
        case 'location':
          router.push('/posts/location' as any);
          break;
        case 'free':
          router.push('/posts/free' as any);
          break;
        case 'secret':
          router.push('/posts/secret' as any);
          break;
        case 'freshman':
          router.push('/posts/freshman' as any);
          break;
        case 'info':
          router.push('/posts/info' as any);
          break;
        case 'club':
          router.push('/posts/club' as any);
          break;
        case 'promotion':
          router.push('/posts/promotion' as any);
          break;
        case 'event':
          router.push('/posts/event' as any);
          break;
        default:
          router.push(`/pages/posts?category=${boardName}` as any);
          break;
      }
    }
  };

  const handlePopularPostsPress = () => {
    router.push('/pages/popular-posts' as any);
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.emptySpace} />
        
        <Text style={styles.headerTitle}>게시판</Text>
        
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/pages/create-board' as any)}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.boardContainer}>
          {/* 인기 게시글 섹션 */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>🔥 인기 게시글</Text>
              <Text style={styles.sectionDescription}>  좋아요 수가 10개 이상인 게시글은 인기 게시글에 등록됩니다.</Text>
            </View>
            <TouchableOpacity onPress={handlePopularPostsPress}>
              <Text style={styles.seeAllText}>전체보기</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.loadingText}>인기 게시글을 불러오는 중...</Text>
            </View>
          ) : popularPosts.length > 0 ? (
            <View style={styles.popularPostsContainer}>
              {popularPosts.slice(0, 3).map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.popularPostItem}
                  onPress={() => router.push(`/pages/post-detail?id=${post.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.popularPostHeader}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{post.category}</Text>
                    </View>
                    <Text style={styles.heartCount}>❤️ {post.heart_count}</Text>
                  </View>
                  <Text style={styles.popularPostTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <View style={styles.popularPostFooter}>
                    <Text style={styles.authorText}>{getDisplayNickname(post.author_nickname)}</Text>
                    <Text style={styles.timeText}>{formatTimeAgo(post.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noPopularPosts}>
              <Text style={styles.noPopularText}>아직 인기 게시글이 없습니다</Text>
            </View>
          )}

          {/* 게시판 목록 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 게시판</Text>
          </View>
          
          {boards.map((board) => (
            <TouchableOpacity
              key={board.id}
              style={styles.boardButton}
              onPress={() => handleBoardPress(board.id, board.name)}
              activeOpacity={0.7}
            >
              <View style={styles.boardContent}>
                <Text style={styles.boardName}>{board.name}</Text>
                <Text style={styles.boardDescription}>{board.description}</Text>
              </View>
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      {/* 하단 바 */}
      <BottomBar 
        activeTab="posts"
      />
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  emptySpace: {
    padding: 8,
    marginRight: 12,
    width: 40, // 🆕 뒤로가기 버튼과 동일한 크기의 빈 공간
    height: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    flex: 1,
  },
  createButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  boardContainer: {
    padding: 16,
  },
  boardButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  boardContent: {
    flex: 1,
  },
  boardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  boardDescription: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  arrowContainer: {
    marginLeft: 16,
  },
  arrow: {
    fontSize: 20,
    color: '#adb5bd',
    fontWeight: '300',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
    lineHeight: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6c757d',
  },
  popularPostsContainer: {
    marginBottom: 24,
  },
  popularPostItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  popularPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  heartCount: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  popularPostTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    lineHeight: 22,
  },
  popularPostFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#adb5bd',
  },
  noPopularPosts: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  noPopularText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});