import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from '../services/userService';
import { notificationService, NotificationItem } from '../services/notificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

type TabType = 'news_notices' | 'notifications';

interface PostItem {
  id: number;
  title: string;
  content: string;
  category: string;
  author_nickname: string;
  view_count: number;
  heart_count: number;
  comment_count: number;
  created_at: string;
  image_urls?: string[];
}

const API_BASE_URL = 'https://hoseolife.kro.kr';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('news_notices');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newsNoticesItems, setNewsNoticesItems] = useState<PostItem[]>([]); // 🔧 통합된 새소식&공지
  const [userNotifications, setUserNotifications] = useState<NotificationItem[]>([]); // 🆕 사용자 알림
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await userService.getCurrentUserInfo();
        if (userInfo) {
          // 관리자 권한 확인
          const isUserAdmin = Boolean(userInfo.is_admin);
          setIsAdmin(isUserAdmin);
          console.log('관리자 권한 확인:', isUserAdmin, userInfo.is_admin, userInfo);
        } else {
          setIsAdmin(false);
          console.log('사용자 정보 없음');
        }
      } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error);
        setIsAdmin(false);
      }
    };
    
    fetchUserInfo();
  }, []);

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'news_notices') {
      // 🔧 새소식과 공지사항을 통합해서 조회
      Promise.all([
        fetch(`${API_BASE_URL}/posts/?category=뉴스&include_news_notices=true`).then(res => res.json()),
        fetch(`${API_BASE_URL}/posts/?category=공지&include_news_notices=true`).then(res => res.json())
      ])
        .then(([newsData, noticeData]) => {
          const allItems = [
            ...(Array.isArray(newsData) ? newsData : []),
            ...(Array.isArray(noticeData) ? noticeData : [])
          ];
          // 생성일 기준으로 최신순 정렬
          allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setNewsNoticesItems(allItems);
        })
        .catch(error => {
          console.error('새소식&공지 조회 오류:', error);
          setNewsNoticesItems([]);
        })
        .finally(() => setLoading(false));
    } else {
      // 🆕 사용자 알림 조회
      notificationService.getUserNotifications(0, 50, false)
        .then(notifications => {
          setUserNotifications(notifications);
        })
        .catch(error => {
          console.error('사용자 알림 조회 오류:', error);
          setUserNotifications([]);
        })
        .finally(() => setLoading(false));
    }
  }, [activeTab, refreshKey]);

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleWritePress = () => {
    if (activeTab === 'news_notices') {
      // 🔧 새소식 또는 공지 작성 선택 모달 표시 (또는 기본값으로 새소식)
      router.push('/pages/create-news');
    }
  };

  const handleNewsPress = (item: PostItem) => {
    router.push(`/pages/post-detail?id=${item.id}`);
  };

  const handleNoticePress = (item: PostItem) => {
    router.push(`/pages/post-detail?id=${item.id}`);
  };

  const renderNewsItem = (item: PostItem) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handleNewsPress(item)}>
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{getDisplayNickname(item.author_nickname)}</Text>
          <Text style={styles.postTime}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</Text>
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

  const renderNoticeItem = (item: PostItem) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handleNoticePress(item)}>
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{getDisplayNickname(item.author_nickname)}</Text>
          <Text style={styles.postTime}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</Text>
        </View>
        {/* 🆕 카테고리 배지 추가 */}
        <View style={[styles.categoryBadge, { backgroundColor: item.category === '뉴스' ? '#007AFF' : '#FF6B6B' }]}>
          <Text style={styles.categoryText}>{item.category}</Text>
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

  // 🆕 사용자 알림 아이템 렌더링
  const renderNotificationItem = (item: NotificationItem) => {
    const handleNotificationPress = async () => {
      // 읽지 않은 알림이면 읽음 처리
      if (!item.is_read) {
        try {
          await notificationService.markNotificationAsRead(item.id);
          // 알림 목록 새로고침
          setRefreshKey(prev => prev + 1);
        } catch (error) {
          console.error('알림 읽음 처리 실패:', error);
        }
      }
      
      // 알림 타입에 따라 해당 페이지로 이동
      const data = item.data ? JSON.parse(item.data) : {};
      const notificationType = item.notification_type || data.type;
      
      if (notificationType === 'comment' || 
          notificationType === 'heart' || 
          notificationType === 'reply' ||
          notificationType === 'my_post_comment' ||
          notificationType === 'my_post_heart' ||
          notificationType === 'my_post_hot') {
        // 게시글 관련 알림
        let postUrl = `/pages/post-detail?id=${data.post_id}`;
        
        // 대댓글 알림인 경우 댓글 ID도 포함
        if (notificationType === 'reply' && data.comment_id) {
          postUrl += `&comment_id=${data.comment_id}`;
        }
        
        // 네비게이션 전 잠시 대기 후 replace 사용 (더 확실한 네비게이션)
        setTimeout(() => {
          router.replace(postUrl);
        }, 500);
      } else if (notificationType === 'chat_message') {
        // 채팅 관련 알림
        const roomType = data.room_type || 'dm';
        // 네비게이션 전 잠시 대기 후 replace 사용 (더 확실한 네비게이션)
        setTimeout(() => {
          router.replace(`/pages/chat-room?id=${data.room_id}&type=${roomType}`);
        }, 500);
      }
    };

    return (
      <TouchableOpacity 
        key={item.id} 
        style={[
          styles.notificationCard,
          !item.is_read && styles.unreadNotificationCard
        ]}
        onPress={handleNotificationPress}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationTypeContainer}>
            <Ionicons 
              name={getNotificationIcon(item.notification_type)} 
              size={20} 
              color={getNotificationColor(item.notification_type)} 
            />
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationTime}>
            {formatTimeAgo(item.created_at)}
          </Text>
        </View>
        <Text style={[styles.notificationTitle, !item.is_read && styles.unreadTitle]}>
          {item.title}
        </Text>
        <Text style={styles.notificationContent} numberOfLines={2}>
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  // 알림 타입별 아이콘 반환
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment': return 'chatbubble';
      case 'heart': return 'heart';
      case 'chat_message': return 'chatbox';
      case 'news': return 'newspaper';
      case 'hot_post': return 'flame';
      default: return 'notifications';
    }
  };

  // 알림 타입별 색상 반환
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'comment': return '#007AFF';
      case 'heart': return '#FF3B30';
      case 'chat_message': return '#34C759';
      case 'news': return '#FF9500';
      case 'hot_post': return '#FF6B6B';
      default: return '#8E8E93';
    }
  };

  // 시간 포맷팅
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금전';
    if (diffInMinutes < 60) return `${diffInMinutes}분전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}일전`;
    
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        {/* 뒤로가기 버튼과 타이틀 */}
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, !isAdmin && styles.headerTitleCentered]}>새소식 & 공지</Text>
          {/* 관리자만 작성 버튼 노출 */}
          {isAdmin ? (
            <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
              <Ionicons name="add" size={20} color="#000000" />
              <Text style={styles.writeButtonText}>작성</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderButton} />
          )}
        </View>
        
        {/* 탭 버튼들 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'news_notices' && styles.activeTabButton]}
            onPress={() => setActiveTab('news_notices')}
          >
            <Text style={[styles.tabText, activeTab === 'news_notices' && styles.activeTabText]}>
              새소식 & 공지
            </Text>
            {activeTab === 'news_notices' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'notifications' && styles.activeTabButton]}
            onPress={() => setActiveTab('notifications')}
          >
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
              내 알림
            </Text>
            {activeTab === 'notifications' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>
      {/* 콘텐츠 영역 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : activeTab === 'news_notices' ? (
          <View style={styles.tabContent}>
            {newsNoticesItems.length === 0 ? (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>새소식 & 공지가 없습니다.</Text>
            ) : (
              newsNoticesItems.map(renderNewsItem)
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {userNotifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <Ionicons name="notifications-outline" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>받은 알림이 없습니다</Text>
                <Text style={styles.emptySubtext}>새로운 알림이 있을 때 여기에 표시됩니다</Text>
              </View>
            ) : (
              userNotifications.map(renderNotificationItem)
            )}
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerTitleCentered: {
    flex: 1,
    textAlign: 'center',
    marginLeft: 30
  },
  backButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTabButton: {
    // 활성 탭 스타일
  },
  tabText: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#212529',
    fontWeight: '600',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#212529',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  tabContent: {
    padding: 16,
  },
  card: {
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
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  writeButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  placeholderButton: {
    width: 60,
  },
  // 🆕 카테고리 배지 스타일
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // 🆕 사용자 알림 스타일
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // 🆕 읽지 않은 알림 스타일
  unreadNotificationCard: {
    backgroundColor: '#F8F9FF',
    borderLeftColor: '#007AFF',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6c757d',
  },
  notificationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    position: 'absolute',
    top: -2,
    right: -2,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#000000',
  },
  notificationContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
}); 