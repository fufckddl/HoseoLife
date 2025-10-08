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
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { postService, PostListResponse } from '../../services/postService';
import { boardService, BoardNotice } from '../../services/boardService'; // 🆕 게시판 서비스 추가
import { chatService } from '../../services/chatService'; // 🆕 채팅 서비스 추가
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayNickname, isDeactivatedUser } from '../../utils/userUtils'; // 🆕 유틸리티 함수 import
import { useAuth } from '../../contexts/AuthContext'; // 🆕 인증 컨텍스트 추가
import { Ionicons } from '@expo/vector-icons';

interface Board {
  id: number;
  name: string;
  description: string;
  creator_id?: number; // 🆕 게시판 생성자 ID
}



export default function BoardPostsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth(); // 🆕 현재 사용자 정보
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board | null>(null);
  const [notices, setNotices] = useState<BoardNotice[]>([]); // 🆕 공지사항 목록
  const [posts, setPosts] = useState<PostListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // 🆕 관리자 권한 확인

  useEffect(() => {
    if (id) {
      fetchBoardInfo();
      fetchNotices(); // 🆕 공지사항 로드
      fetchPosts();
    }
  }, [id]);

  // 화면이 포커스될 때마다 게시글 목록 새로고침
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== 커스텀 게시판 화면 포커스됨 ===');
      if (id) {
        fetchPosts(true);
      }
    }, [id])
  );

  const fetchBoardInfo = async () => {
    try {
      const response = await fetch(`https://hoseolife.kro.kr/boards/${id}`);
      if (response.ok) {
        const boardData = await response.json();
        setBoard(boardData);
        
        // 🆕 관리자 권한 확인 (게시판 생성자이거나 전체 관리자)
        if (user && boardData.creator_id) {
          setIsAdmin(boardData.creator_id === user.id || user.is_admin);
        }
      }
    } catch (error) {
      console.error('게시판 정보 로드 실패:', error);
    }
  };

  // 🆕 공지사항 목록 로드
  const fetchNotices = async () => {
    try {
      const noticesData = await boardService.getBoardNotices(parseInt(id as string));
      setNotices(noticesData);
      console.log(`✅ 게시판 ${id} 공지사항 로드 완료: ${noticesData.length}개`);
    } catch (error) {
      console.error('게시판 공지사항 로드 실패:', error);
      setNotices([]);
    }
  };

  const fetchPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
      }

      const currentPage = isRefresh ? 1 : page;
      
      const postsData = await postService.getPosts(
        (currentPage - 1) * 20,
        20,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        parseInt(id as string)
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
      console.error('게시글 목록 조회 실패:', error);
      Alert.alert('오류', '게시글 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchNotices(); // 🆕 공지사항도 새로고침
    fetchPosts(true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchPosts();
    }
  };

  const handleCreatePost = () => {
    router.push(`/posts/board/${id}/create` as any);
  };

  // 🆕 공지사항 작성
  const handleCreateNotice = () => {
    router.push(`/pages/create-board-notice?boardId=${id}` as any);
  };

  // 공지사항 클릭 핸들러 - 게시글 상세페이지로 이동
  const handleNoticePress = (notice: BoardNotice) => {
    // 공지사항을 게시글 형태로 변환하여 상세페이지로 전달
    const noticeAsPost = {
      id: `notice-${notice.id}`, // 공지사항임을 구분하기 위해 prefix 추가
      title: `📢 [공지] ${notice.title}`,
      content: notice.content,
      author_nickname: notice.author_nickname,
      author_id: notice.author_id, // 🆕 작성자 ID 추가
      author_profile_image_url: notice.author_profile_image_url || null, // 🆕 프로필 이미지 URL 추가
      created_at: notice.created_at,
      updated_at: notice.updated_at,
      view_count: 0,
      heart_count: 0,
      comment_count: 0,
      board_id: parseInt(id as string),
      board_name: board?.name || '',
      is_notice: true, // 공지사항 표시 플래그
      notice_id: notice.id, // 원본 공지사항 ID
      is_pinned: notice.is_pinned
    };

    // 공지사항 데이터를 쿼리 파라미터로 전달
    router.push({
      pathname: '/pages/post-detail',
      params: {
        id: `notice-${notice.id}`,
        noticeData: JSON.stringify(noticeAsPost)
      }
    } as any);
  };

  // 🆕 게시글 삭제 (관리자 권한)
  const handleDeletePost = (postId: number) => {
    Alert.alert(
      '게시글 삭제',
      '정말로 이 게시글을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await postService.deletePost(postId);
              Alert.alert('성공', '게시글이 삭제되었습니다.');
              fetchPosts(true); // 목록 새로고침
            } catch (error) {
              console.error('게시글 삭제 실패:', error);
              Alert.alert('오류', '게시글 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 작성자와 채팅 시작 (자신과의 채팅 금지)
  const handleAuthorChat = async (authorId: number, authorNickname: string) => {
    if (!user || authorId === user.id) {
      return; // 자신과는 채팅할 수 없음
    }

    Alert.alert(
      '1:1 채팅 시작',
      `${authorNickname}님과 1:1 채팅하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              // 1:1 채팅방 찾기 또는 생성
              const chatRoom = await chatService.findOrCreateDirectChat(authorId);
              
              // 채팅방으로 이동
              router.push(`/pages/chat-room?id=${chatRoom.id}&type=dm`);
            } catch (error) {
              console.error('채팅방 생성 실패:', error);
              Alert.alert('오류', '채팅방을 생성하는데 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handlePostPress = (postId: number) => {
    router.push(`/pages/post-detail?id=${postId}`);
  };

  const handleSearch = () => {
    router.push(`/pages/search?category=${board?.name || '기타'}`);
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
          <View style={styles.authorContainer}>
            {!isDeactivatedUser(item.author_nickname) ? (
              item.author_profile_image_url ? (
                <Image 
                  source={{ 
                    uri: item.author_profile_image_url,
                    cache: 'reload'
                  }} 
                  style={styles.authorImage} 
                />
              ) : null
            ) : null}
            <View style={styles.authorTextContainer}>
              <TouchableOpacity 
                onPress={() => {
                  if (!isDeactivatedUser(item.author_nickname) && item.author_id !== user?.id) {
                    handleAuthorChat(item.author_id, item.author_nickname);
                  }
                }}
                disabled={item.author_id === user?.id || isDeactivatedUser(item.author_nickname)}
              >
                <Text style={[
                  styles.authorName,
                  (item.author_id === user?.id || isDeactivatedUser(item.author_nickname)) && styles.authorNameDisabled
                ]}>
                  {getDisplayNickname(item.author_nickname)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.postTime}>{formatTimeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
        {/* 🆕 관리자인 경우 삭제 버튼 표시 */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation(); // 게시글 클릭 이벤트 방지
              handleDeletePost(item.id);
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          </TouchableOpacity>
        )}
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

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.endMessage}>
          <Text style={styles.endText}>모든 게시글을 불러왔습니다</Text>
        </View>
      );
    }
    return null;
  };

  if (loading && posts.length === 0) {
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
          onPress={() => router.replace('/tabs/post-list')}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{board?.name || '게시판'}</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Ionicons name="search" size={24} color="#000000" />
          </TouchableOpacity>
          
          {/* 🆕 관리자인 경우 공지사항 작성 버튼 */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={handleCreateNotice}
            >
              <Ionicons name="megaphone" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
          
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
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        style={styles.postList}
        contentContainerStyle={styles.postListContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={
          // 🆕 공지사항 상단 고정 표시
          notices.length > 0 ? (
            <View style={styles.noticesSection}>
              <View style={styles.noticesHeader}>
                <Ionicons name="megaphone" size={20} color="#FF6B6B" />
                <Text style={styles.noticesTitle}>공지사항</Text>
              </View>
              {notices.map((notice) => (
                <TouchableOpacity
                  key={notice.id}
                  style={styles.noticeCard}
                  onPress={() => handleNoticePress(notice)}
                >
                  <View style={styles.noticeHeader}>
                    <View style={styles.noticeIconContainer}>
                      {notice.is_pinned && (
                        <Ionicons name="pin" size={12} color="#FF6B6B" style={styles.pinIcon} />
                      )}
                    </View>
                    <Text style={styles.noticeTitle} numberOfLines={1}>
                      {notice.title}
                    </Text>
                  </View>
                  <View style={styles.noticeFooter}>
                    <View style={styles.noticeAuthorContainer}>
                      {!isDeactivatedUser(notice.author_nickname) ? (
                        notice.author_profile_image_url ? (
                          <Image 
                            source={{ 
                              uri: notice.author_profile_image_url,
                              cache: 'reload'
                            }} 
                            style={styles.noticeAuthorImage} 
                          />
                        ) : (
                          <Ionicons 
                            name="person-circle-outline" 
                            size={35} 
                            color="#666" 
                            style={styles.noticeAuthorImage} 
                          />
                        )
                      ) : null}
                      <TouchableOpacity 
                        onPress={() => {
                          if (!isDeactivatedUser(notice.author_nickname) && notice.author_nickname !== user?.nickname) {
                            handleAuthorChat((notice as any).author_id || 0, notice.author_nickname);
                          }
                        }}
                        disabled={notice.author_nickname === user?.nickname || isDeactivatedUser(notice.author_nickname)}
                      >
                        <Text style={[
                          styles.noticeAuthor,
                          (notice.author_nickname === user?.nickname || isDeactivatedUser(notice.author_nickname)) && styles.noticeAuthorDisabled
                        ]}>
                          {getDisplayNickname(notice.author_nickname)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.noticeDate}>
                      {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={renderFooter}
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
  noticeButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
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
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    resizeMode: 'cover',
  },
  authorTextContainer: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  authorNameDisabled: {
    color: '#999999',
    opacity: 0.7,
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
  endMessage: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endText: {
    fontSize: 14,
    color: '#6c757d',
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
  // 🆕 공지사항 관련 스타일들
  noticesSection: {
    backgroundColor: '#FFF9E6',
    borderBottomWidth: 2,
    borderBottomColor: '#FFE500',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  noticesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  noticesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    fontFamily: 'GmarketSans',
  },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  pinIcon: {
    marginLeft: 4,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  noticeContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  noticeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  noticeAuthorImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    resizeMode: 'cover',
  },
  noticeAuthor: {
    fontSize: 12,
    color: '#333333',
    fontFamily: 'GmarketSans',
    fontWeight: '500',
  },
  noticeAuthorDisabled: {
    color: '#999999',
    opacity: 0.7,
  },
  noticeDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
});
