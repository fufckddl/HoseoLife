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

type TabType = 'news' | 'notices';

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

const API_BASE_URL = 'https://camsaw.kro.kr';

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('news');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newsItems, setNewsItems] = useState<PostItem[]>([]);
  const [noticeItems, setNoticeItems] = useState<PostItem[]>([]);
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
    if (activeTab === 'news') {
      // 뉴스 카테고리 게시글 조회 (뉴스/공지 포함)
      fetch(`${API_BASE_URL}/posts/?category=뉴스&include_news_notices=true`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setNewsItems(data);
          else setNewsItems([]);
        })
        .catch(error => {
          console.error('뉴스 조회 오류:', error);
          setNewsItems([]);
        })
        .finally(() => setLoading(false));
    } else {
      // 공지사항 카테고리 게시글 조회 (뉴스/공지 포함)
      fetch(`${API_BASE_URL}/posts/?category=공지&include_news_notices=true`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setNoticeItems(data);
          else setNoticeItems([]);
        })
        .catch(error => {
          console.error('공지사항 조회 오류:', error);
          setNoticeItems([]);
        })
        .finally(() => setLoading(false));
    }
  }, [activeTab, refreshKey]);

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleWritePress = () => {
    if (activeTab === 'news') {
      router.push('/pages/create-news');
    } else if (activeTab === 'notices') {
      router.push('/pages/create-notice');
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
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardContent}>{item.content}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.heart_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.comment_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderNoticeItem = (item: PostItem) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handleNoticePress(item)}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardContent}>{item.content}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.heart_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={12} color="#666666" />
            <Text style={styles.statsText}> {item.comment_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        {/* 뒤로가기 버튼과 타이틀 */}
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>새소식 & 공지</Text>
          {/* 관리자만 작성 버튼 노출 */}
          {isAdmin && (
            <TouchableOpacity style={styles.writeButton} onPress={handleWritePress}>
              <Ionicons name="add" size={20} color="#000000" />
              <Text style={styles.writeButtonText}>작성</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* 탭 버튼들 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'news' && styles.activeTabButton]}
            onPress={() => setActiveTab('news')}
          >
            <Text style={[styles.tabText, activeTab === 'news' && styles.activeTabText]}>
              새소식
            </Text>
            {activeTab === 'news' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'notices' && styles.activeTabButton]}
            onPress={() => setActiveTab('notices')}
          >
            <Text style={[styles.tabText, activeTab === 'notices' && styles.activeTabText]}>
              공지사항
            </Text>
            {activeTab === 'notices' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>
      {/* 콘텐츠 영역 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : activeTab === 'news' ? (
          <View style={styles.tabContent}>
            {newsItems.length === 0 ? (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>새소식이 없습니다.</Text>
            ) : (
              newsItems.map(renderNewsItem)
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {noticeItems.length === 0 ? (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>공지사항이 없습니다.</Text>
            ) : (
              noticeItems.map(renderNoticeItem)
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    color: '#000000',
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
    color: '#666666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  tabContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#F5F5DC', // 베이지색
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  cardContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 12,
    color: '#999999',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    color: '#666666',
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

}); 