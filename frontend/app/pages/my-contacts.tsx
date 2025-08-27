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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { contactService, ContactData } from '../services/contactService';

export default function MyContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const contactsData = await contactService.getMyContacts(0, 50);
      setContacts(contactsData);
    } catch (error) {
      console.error('문의 목록 로드 실패:', error);
      Alert.alert('오류', '문의 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts();
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

  const handleContactPress = (contact: ContactData) => {
    // 문의 상세 페이지로 이동
    router.push(`/pages/contact-detail?id=${contact.id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>문의 목록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>내 문의 목록</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 통계 정보 */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{contacts.length}</Text>
          <Text style={styles.statLabel}>전체 문의</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {contacts.filter(c => c.is_answered).length}
          </Text>
          <Text style={styles.statLabel}>답변 완료</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {contacts.filter(c => !c.is_answered).length}
          </Text>
          <Text style={styles.statLabel}>답변 대기</Text>
        </View>
      </View>

      {/* 문의 목록 */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>아직 작성한 문의가 없습니다.</Text>
            <TouchableOpacity 
              style={styles.writeButton}
              onPress={() => router.push('/pages/contact')}
            >
              <Text style={styles.writeButtonText}>문의 작성하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              onPress={() => handleContactPress(contact)}
            >
              <View style={styles.contactHeader}>
                <Text style={styles.contactSubject} numberOfLines={1}>
                  {contact.subject}
                </Text>
                <View style={styles.contactMeta}>
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
              
              <View style={styles.contactFooter}>
                <Text style={styles.contactDate}>{formatDate(contact.created_at)}</Text>
                <Text style={styles.contactCategory}>{contact.category}</Text>
              </View>
              
              {contact.admin_response && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseLabel}>답변:</Text>
                  <Text style={styles.responseText} numberOfLines={2}>
                    {contact.admin_response}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 10,
    fontFamily: 'GmarketSans',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
    fontFamily: 'GmarketSans',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    fontFamily: 'GmarketSans',
  },
  writeButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  writeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  contactItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  contactSubject: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 10,
    fontFamily: 'GmarketSans',
  },
  contactMeta: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  contactMessage: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  contactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  contactCategory: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  responseContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  responseText: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 18,
    fontFamily: 'GmarketSans',
  },
}); 