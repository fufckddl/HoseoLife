import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { contactService, ContactData, ContactStats } from '../../services/contactService';

export default function ContactManagementScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsData, statsData] = await Promise.all([
        contactService.getAllContacts(0, 50),
        contactService.getContactStats()
      ]);
      setContacts(contactsData);
      setStats(statsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '대기중': return '#FF8800';
      case '처리중': return '#007AFF';
      case '답변완료': return '#4CAF50';
      case '완료': return '#4CAF50';
      default: return '#666666';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '긴급': return '#FF4444';
      case '높음': return '#FF8800';
      case '보통': return '#007AFF';
      case '낮음': return '#4CAF50';
      default: return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesFilter = selectedFilter === 'all' || 
                         (selectedFilter === 'unread' && !contact.is_read) ||
                         (selectedFilter === 'pending' && contact.status === '대기중') ||
                         (selectedFilter === 'answered' && contact.is_answered);
    
    const matchesSearch = contact.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contact.user_nickname?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>문의 관리</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 통계 섹션 */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>전체</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF8800' }]}>{stats.unread}</Text>
            <Text style={styles.statLabel}>읽지 않음</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#007AFF' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>대기중</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.answered}</Text>
            <Text style={styles.statLabel}>답변완료</Text>
          </View>
        </View>
      )}

      {/* 검색 및 필터 */}
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="제목 또는 사용자명으로 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999999"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>전체</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'unread' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('unread')}
          >
            <Text style={[styles.filterText, selectedFilter === 'unread' && styles.filterTextActive]}>읽지 않음</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'pending' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('pending')}
          >
            <Text style={[styles.filterText, selectedFilter === 'pending' && styles.filterTextActive]}>대기중</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'answered' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('answered')}
          >
            <Text style={[styles.filterText, selectedFilter === 'answered' && styles.filterTextActive]}>답변완료</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 문의 목록 */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredContacts.map((contact) => (
          <TouchableOpacity
            key={contact.id}
            style={[styles.contactItem, !contact.is_read && styles.unreadContact]}
                         onPress={() => router.push(`/pages/admin/contact-detail?id=${contact.id}` as any)}
          >
            <View style={styles.contactHeader}>
              <Text style={styles.contactSubject} numberOfLines={1}>
                {contact.subject}
              </Text>
              <View style={styles.contactMeta}>
                <Text style={styles.contactDate}>{formatDate(contact.created_at)}</Text>
                {!contact.is_read && <View style={styles.unreadDot} />}
              </View>
            </View>
            
            <View style={styles.contactInfo}>
              <Text style={styles.contactUser}>{contact.user_nickname}</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(contact.status) }]}>
                  <Text style={styles.statusText}>{contact.status}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(contact.priority) }]}>
                  <Text style={styles.priorityText}>{contact.priority}</Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.contactMessage} numberOfLines={2}>
              {contact.message}
            </Text>
          </TouchableOpacity>
        ))}
        
        {filteredContacts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>문의가 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
    fontFamily: 'GmarketSans',
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#000000',
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contactItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  unreadContact: {
    backgroundColor: '#F8F9FA',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginLeft: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactUser: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  contactMessage: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
}); 