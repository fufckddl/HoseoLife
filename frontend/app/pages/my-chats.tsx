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
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '../stores/groupStore';
import { websocketService } from '../services/websocketService';
import { TopBar } from '../components/layout/TopBar';
import { BottomBar } from '../components/layout/BottomBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MyChatsScreen() {
  const router = useRouter();
  const { 
    myRooms, 
    availableGroups, // 🆕 참여가능한 그룹 목록 추가
    loading, 
    error, 
    fetchMyRooms, 
    refreshMyRooms, 
    fetchAvailableGroups, // 🆕 참여가능한 그룹 조회 함수 추가
    joinGroup, // 🆕 그룹 참여 함수 추가
    clearError 
  } = useGroupStore();
  const [activeTab, setActiveTab] = useState<'my-chats' | 'available-groups'>('my-chats');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadMyRooms();
  }, []);

  // 🆕 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'available-groups') {
      loadAvailableGroups();
    }
  }, [activeTab]);

  // 화면이 포커스될 때마다 채팅방 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 my-chats 화면 포커스 - 채팅방 목록 새로고침');
      refreshMyRooms();
    }, [])
  );

  const loadMyRooms = async () => {
    try {
      console.log('🔄 loadMyRooms 시작');
      await refreshMyRooms();
      console.log('✅ loadMyRooms 완료');
    } catch (error) {
      console.error('❌ 채팅방 목록 로드 실패:', error);
    }
  };

  // 🆕 참여가능한 그룹 목록 로드
  const loadAvailableGroups = async () => {
    try {
      console.log('🔄 loadAvailableGroups 시작');
      await fetchAvailableGroups();
      console.log('✅ loadAvailableGroups 완료');
    } catch (error) {
      console.error('❌ 참여가능한 그룹 목록 로드 실패:', error);
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

  const renderRoomItem = ({ item }: { item: any }) => {
    // 🆕 디버깅: 그룹 채팅방 정보 확인
    console.log('🔍 채팅방 정보:', {
      name: item.name,
      type: item.type,
      memberCount: item.memberCount,
      roomId: item.roomId
    });

    // 🆕 DM과 그룹 채팅방에 따라 다른 이미지 URL 처리
    const getImageUrl = () => {
      if (item.type === 'group' && item.roomId) {
        // 그룹 채팅방의 경우 S3 group 폴더에서 이미지 가져오기
        return `https://camsaw-assets.s3.ap-northeast-2.amazonaws.com/group/${item.roomId}/logo.png`;
      } else if (item.type === 'dm') {
        // DM 채팅방의 경우 상대방 프로필 이미지 사용
        return item.imageUrl;
      }
      return item.imageUrl;
    };

    const imageUrl = getImageUrl();

    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() => handleRoomPress(item)}
      >
        {/* 🆕 왼쪽: 채팅방 이미지 또는 아이콘 */}
        <View style={styles.leftImageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.roomImage}
              onError={() => {
                // 이미지 로드 실패 시 기본 아이콘 표시
                console.log(`이미지 로드 실패: ${imageUrl}`);
              }}
              onLoad={() => { 
                console.log(`이미지 로드 성공: ${imageUrl}`);
              }}
            />
          ) : (
            <View style={styles.roomIconContainer}>
              <Ionicons 
                name={item.type === 'group' ? 'people' : 'person'} 
                size={24} 
                color="#FFFFFF" 
              />
            </View>
            )}
          {/* 안읽은 메시지 배지 */}
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.roomInfo}>
          <View style={styles.roomTitleContainer}>
            <Text style={styles.roomName}>{item.name}</Text>
            {/* 🆕 그룹 채팅방 표시 */}
            {(item.type === 'group' || item.type === 'Group') && (
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={12} color="#FFFFFF" />
                <Text style={styles.groupBadgeText}>
                  그룹 {item.memberCount ? `(${item.memberCount}명)` : ''}
                </Text>
              </View>
            )}
          </View>
          {item.lastMessage ? (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {/* 🆕 사진 메시지 처리 */}
              {item.lastMessage.includes('[이미지]') || item.lastMessage.includes('image') ? 
                `${item.lastMessageSender || '누군가'}님이 사진을 보냈습니다.` : 
                item.lastMessage
              }
            </Text>
          ) : (
            <Text style={styles.noMessage}>메시지가 없습니다</Text>
          )}
        </View>
        
        <View style={styles.roomMeta}>
          <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderAvailableGroupItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => handleJoinGroup(item)}
    >
      <View style={styles.roomInfo}>
        <View style={styles.roomTitleContainer}>
          <Ionicons 
            name="people" 
            size={20} 
            color="#2D3A4A" 
          />
          <Text style={styles.roomName}>{item.name}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {item.description || '그룹 설명이 없습니다'}
        </Text>
        <Text style={styles.groupMeta}>
          멤버 {item.memberCount || 0}명 • 그룹 채팅
        </Text>
      </View>
      
      <View style={styles.roomMeta}>
        <TouchableOpacity 
          style={styles.joinButton}
          onPress={() => handleJoinGroup(item)}
        >
          <Text style={styles.joinButtonText}>참여</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const handleJoinGroup = async (group: any) => {
    try {
      console.log('🎯 그룹 참여 시도:', group);
      await joinGroup(group.roomId);
      console.log('✅ 그룹 참여 성공');
      
      // 참여 후 내 채팅방 탭으로 이동
      setActiveTab('my-chats');
    } catch (error) {
      console.error('❌ 그룹 참여 실패:', error);
    }
  };

  const renderEmptyState = (type: 'my-chats' | 'available-groups') => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={type === 'my-chats' ? 'chatbubbles-outline' : 'people-outline'} 
        size={64} 
        color="#CCCCCC" 
      />
      <Text style={styles.emptyText}>
        {type === 'my-chats' ? '채팅방이 없습니다' : '참여가능한 그룹이 없습니다'}
      </Text>
      <Text style={styles.emptySubtext}>
        {type === 'my-chats' 
          ? '게시글이나 댓글에서 사용자와 채팅을 시작해보세요' 
          : '새로운 그룹에 참여하거나 그룹을 생성해보세요'
        }
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 상단 바 */}
      <TopBar 
        title="내 채팅방"
        showRefreshButton={true}
        showLogo={false}
        onRefreshPress={refreshMyRooms}
      />

      {/* 탭 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my-chats' && styles.activeTabButton]}
          onPress={() => setActiveTab('my-chats')}
        >
          <Ionicons 
            name="chatbubbles-outline" 
            size={20} 
            color={activeTab === 'my-chats' ? '#2D3A4A' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'my-chats' && styles.activeTabText]}>
            내 채팅방 ({(myRooms.dms?.length || 0) + (myRooms.groups?.length || 0)})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'available-groups' && styles.activeTabButton]}
          onPress={() => setActiveTab('available-groups')}
        >
          <Ionicons 
            name="people-outline" 
            size={20} 
            color={activeTab === 'available-groups' ? '#2D3A4A' : '#666666'} 
          />
          <Text style={[styles.tabText, activeTab === 'available-groups' && styles.activeTabText]}>
            참여가능 그룹채팅방
          </Text>
        </TouchableOpacity>
      </View>

      {/* 참여가능 그룹 상단 버튼 */}

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
          <>
            {activeTab === 'my-chats' ? (
              <FlatList
                data={[...(myRooms?.dms || []), ...(myRooms?.groups || [])]
                  .sort((a, b) => {
                    // 🆕 최신 메시지 시간 기준으로 정렬 (최신이 위로)
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    return timeB - timeA; // 내림차순 정렬 (최신이 먼저)
                  })}
                renderItem={renderRoomItem}
                keyExtractor={(item) => `${item.roomId}-${item.type}`}
                refreshControl={
                  <RefreshControl refreshing={loading} onRefresh={refreshMyRooms} />
                }
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={() => renderEmptyState('my-chats')}
              />
            ) : (
              <FlatList
                data={availableGroups} // 🔧 실제 참여가능한 그룹 데이터 사용
                renderItem={renderAvailableGroupItem}
                keyExtractor={(item) => `available-${item.roomId}`} // 🔧 roomId 사용
                refreshControl={
                  <RefreshControl refreshing={loading} onRefresh={loadAvailableGroups} /> // 🔧 적절한 새로고침 함수 사용
                }
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={() => renderEmptyState('available-groups')}
              />
            )}
          </>
        )}
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottomButtons}>
        {activeTab === 'available-groups' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/pages/group-create')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>그룹 생성</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 하단 바 */}
      <BottomBar activeTab="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  // 🆕 왼쪽 이미지 컨테이너
  leftImageContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 🆕 채팅방 이미지 (원형)
  roomImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
  },
  // 🆕 기본 아이콘 컨테이너 (원형)
  roomIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2D3A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfo: {
    flex: 1,
  },
  roomTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8, // 🆕 그룹 배지와의 간격
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
    flex: 1,
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
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30', // 🔧 더 진한 빨간색 (카카오톡 스타일)
    borderRadius: 10, // 🔧 더 둥근 모서리
    minWidth: 20, // 🔧 크기 조정
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4, // 🆕 좌우 패딩 조정
    borderWidth: 2,
    borderColor: '#FFFFFF', // 흰색 테두리 추가
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11, // 🔧 폰트 크기 조정
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
    backgroundColor: '#000000',
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
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  createGroupButtonText: {
    color: '#2D3A4A',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'GmarketSans',
  },
  groupMeta: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  joinButton: {
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  // 🆕 그룹 배지 스타일
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 8, // 6에서 8로 증가
    paddingVertical: 3,   // 2에서 3으로 증가
    borderRadius: 12,     // 10에서 12로 증가
    gap: 3,               // 2에서 3으로 증가
    flexShrink: 0,        // 배지가 축소되지 않도록
  },
  groupBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,        // 10에서 9로 줄임 (공간 절약)
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
    flexShrink: 0,      // 텍스트가 축소되지 않도록
  },
});
