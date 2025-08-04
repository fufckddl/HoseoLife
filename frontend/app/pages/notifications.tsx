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
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const API_BASE_URL = 'http://your-server-ip:5000';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('news');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfoStr, setUserInfoStr] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<PostItem[]>([]);
  const [noticeItems, setNoticeItems] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIsAdmin = async () => {
      try {
        const str = await AsyncStorage.getItem('userInfo');
        setUserInfoStr(str);
        if (str) {
          const userInfo = JSON.parse(str);
          setIsAdmin(userInfo.is_admin === 1 || userInfo.is_admin === true);
        }
      } catch (e) {
        setIsAdmin(false);
      }
    };
    fetchIsAdmin();
  }, []);

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
  }, [activeTab]);

  const handleTabPress = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleWritePress = () => {
    if (activeTab === 'news') {
      (navigation as any).navigate('CreatePost', { category: '뉴스' });
    } else {
      (navigation as any).navigate('CreatePost', { category: '공지' });
    }
  };

  const handleNewsPress = (item: PostItem) => {
    (navigation as any).navigate('PostDetail', { postId: item.id.toString() });
  };

  const handleNoticePress = (item: PostItem) => {
    (navigation as any).navigate('PostDetail', { postId: item.id.toString() });
  };

  const renderNewsItem = (item: PostItem) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => handleNewsPress(item)}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardContent}>{item.content}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>👁️ {item.view_count}</Text>
          <Text style={styles.statsText}>❤️ {item.heart_count}</Text>
          <Text style={styles.statsText}>💬 {item.comment_count}</Text>
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
          <Text style={styles.statsText}>👁️ {item.view_count}</Text>
          <Text style={styles.statsText}>❤️ {item.heart_count}</Text>
          <Text style={styles.statsText}>💬 {item.comment_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          {/* 탭 버튼들 */}
          <View style={[styles.tabContainer, { flex: 1 }]}>
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
          {/* 관리자만 작성 버튼 노출 */}
          {isAdmin && (
            <TouchableOpacity style={{ marginLeft: 8 }} onPress={handleWritePress}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>작성</Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: '#2D3A4A',
  },
  header: {
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2D3A4A',
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
    color: '#CCCCCC',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  statsText: {
    fontSize: 12,
    color: '#666666',
  },
}); 