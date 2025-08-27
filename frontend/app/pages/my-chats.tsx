// 내 채팅방 목록 화면 (DM/그룹 분리)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '../stores/groupStore';

export default function MyChatsScreen() {
  const router = useRouter();
  const { myRooms, loading, error, fetchMyRooms, clearError } = useGroupStore();
  const [activeTab, setActiveTab] = useState<'dms' | 'groups'>('dms');

  useEffect(() => {
    loadMyRooms();
  }, []);

  // 화면이 포커스될 때마다 채팅방 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 my-chats 화면 포커스 - 채팅방 목록 새로고침');
      loadMyRooms();
    }, [])
  );

  const loadMyRooms = async () => {
    try {
      await fetchMyRooms();
    } catch (error) {
      console.error('채팅방 목록 로드 실패:', error);
    }
  };

  const handleRoomPress = (room: any) => {
    // 채팅방 화면으로 이동 (roomId와 type 전달)
    if (room.type === 'dm') {
      router.push(`/pages/chat-room?id=${room.roomId}&type=dm`);
    } else if (room.type === 'group') {
      router.push(`/pages/chat-room?id=${room.roomId}&type=group`);
    }
  };

  const renderRoomItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => handleRoomPress(item)}
    >
      <View style={styles.roomInfo}>
        <Text style={styles.roomName}>{item.name}</Text>
        {item.lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        ) : (
          <Text style={styles.noMessage}>메시지가 없습니다</Text>
        )}
      </View>
      
      <View style={styles.roomMeta}>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = (type: 'dms' | 'groups') => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={type === 'dms' ? 'chatbubble-outline' : 'people-outline'} 
        size={64} 
        color="#CCCCCC" 
      />
      <Text style={styles.emptyText}>
        {type === 'dms' ? '1:1 채팅' : '그룹 채팅'}이 없습니다
      </Text>
      <Text style={styles.emptySubtext}>
        {type === 'dms' 
          ? '게시글이나 댓글에서 사용자와 1:1 채팅을 시작해보세요' 
          : '새로운 그룹에 참여하거나 그룹을 생성해보세요'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>내 채팅방</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 탭 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'dms' && styles.activeTabButton]}
          onPress={() => setActiveTab('dms')}
        >
          <Ionicons 
            name="chatbubble-outline" 
            size={20} 
            color={activeTab === 'dms' ? '#2D3A4A' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'dms' && styles.activeTabText]}>
            1:1 채팅 ({myRooms.dms.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'groups' && styles.activeTabButton]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons 
            name="people-outline" 
            size={20} 
            color={activeTab === 'groups' ? '#2D3A4A' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            그룹 ({myRooms.groups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2D3A4A" />
            <Text style={styles.loadingText}>로딩 중...</Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'dms' ? (myRooms?.dms || []) : (myRooms?.groups || [])}
            renderItem={renderRoomItem}
            keyExtractor={(item) => `${item.roomId}-${item.type}`}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadMyRooms} />
            }
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => renderEmptyState(activeTab)}
          />
        )}
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottomButtons}>
        {activeTab === 'groups' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/pages/available-groups')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>그룹 참여/생성</Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 34,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#F0F0F0',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  activeTabText: {
    color: '#2D3A4A',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  errorDismiss: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  listContainer: {
    padding: 20,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  noMessage: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
    fontFamily: 'GmarketSans',
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  bottomButtons: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D3A4A',
    paddingVertical: 15,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
});
