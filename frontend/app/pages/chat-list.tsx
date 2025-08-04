import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService, ChatRoomListData } from '../services/chatService';
import { directChatService, DirectChatData } from '../services/directChatService';

export default function ChatListScreen() {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoomListData | null>(null);
  const [directChats, setDirectChats] = useState<DirectChatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChatRooms = async () => {
    try {
      setLoading(true);
      
      // 토큰 확인
      const token = await AsyncStorage.getItem('access_token');
      console.log('ChatList - 토큰 존재 여부:', !!token);
      
      // 사용자의 채팅방 목록과 1:1 채팅 대화 목록을 병렬로 로드
      const [userData, directChatData] = await Promise.all([
        chatService.getUserChatRooms(),
        directChatService.getDirectConversations()
      ]);
      
      console.log('로드된 사용자 채팅방 데이터:', userData);
      console.log('로드된 1:1 채팅 대화 데이터:', directChatData);
      console.log('대기 중인 채팅방 수:', userData.pending_rooms?.length || 0);
      console.log('참여 중인 채팅방 수:', userData.approved_rooms?.length || 0);
      console.log('1:1 채팅 대화 수:', directChatData.length);
      
      setChatRooms(userData);
      setDirectChats(directChatData);
    } catch (error) {
      console.error('채팅방 목록 로드 실패:', error);
      
      // 토큰 관련 오류인지 확인
      if (error instanceof Error && error.message.includes('인증 토큰이 없습니다')) {
        Alert.alert(
          '인증 오류', 
          '로그인이 필요합니다. 다시 로그인해주세요.',
          [
            {
              text: '확인',
              onPress: () => router.push('/auth/login')
            }
          ]
        );
      } else {
        Alert.alert('오류', '채팅방 목록을 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadChatRooms();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChatRooms();
    setRefreshing(false);
  };

  // UTC 시간을 한국 시간으로 변환하는 함수
  const convertToKoreaTime = (dateString: string) => {
    const date = new Date(dateString);
    // UTC 시간에 9시간을 더해서 한국 시간으로 변환
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const koreaDate = convertToKoreaTime(dateString);
    const diffInMinutes = Math.floor((now.getTime() - koreaDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금전';
    if (diffInMinutes < 60) return `${diffInMinutes}분전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일전`;
  };

  const formatDate = (dateString: string) => {
    const koreaDate = convertToKoreaTime(dateString);
    return `${koreaDate.getFullYear()}-${String(koreaDate.getMonth() + 1).padStart(2, '0')}-${String(koreaDate.getDate()).padStart(2, '0')}`;
  };

  const getStatusColor = (isApproved: boolean | null) => {
    if (isApproved === null) return '#FF9800'; // 대기중
    return isApproved ? '#4CAF50' : '#FF4444'; // 승인됨 또는 거부됨
  };

  const getStatusText = (isApproved: boolean | null) => {
    if (isApproved === null) return '대기중';
    return isApproved ? '승인됨' : '거부됨';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D3A4A" />
          <Text style={styles.loadingText}>채팅방 목록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>채팅방</Text>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={() => router.push('/pages/create-chat-room')}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 1:1 채팅 대화 */}
        {directChats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1:1 채팅 ({directChats.length})</Text>
            {directChats.map((chat) => (
              <TouchableOpacity
                key={chat.other_user_id}
                style={styles.directChatItem}
                onPress={() => router.push({
                  pathname: '/pages/direct-chat',
                  params: {
                    otherUserId: chat.other_user_id.toString(),
                    otherUserNickname: chat.other_user_nickname,
                    otherUserProfileImage: chat.other_user_profile_image_url || ''
                  }
                } as any)}
              >
                <View style={styles.directChatHeader}>
                  {chat.other_user_profile_image_url ? (
                    <Image 
                      source={{ uri: chat.other_user_profile_image_url, cache: 'reload' }} 
                      style={styles.directChatProfileImage} 
                    />
                  ) : (
                    <Image 
                      source={require('../../assets/images/camsaw_human.png')} 
                      style={styles.directChatProfileImage} 
                    />
                  )}
                  <View style={styles.directChatInfo}>
                    <Text style={styles.directChatName}>{chat.other_user_nickname}</Text>
                    {chat.last_message && (
                      <Text style={styles.directChatLastMessage} numberOfLines={1}>
                        {chat.last_message}
                      </Text>
                    )}
                  </View>
                  <View style={styles.directChatRight}>
                    {chat.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>{chat.unread_count}</Text>
                      </View>
                    )}
                    {chat.last_message_time && (
                      <Text style={styles.directChatTime}>
                        {formatTimeAgo(chat.last_message_time)}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 대기 중인 채팅방 */}
        {chatRooms?.pending_rooms && chatRooms.pending_rooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>대기 중인 채팅방 ({chatRooms.pending_rooms.length})</Text>
            {chatRooms.pending_rooms.map((room) => (
              <View key={room.id} style={styles.chatRoomItem}>
                <View style={styles.chatRoomHeader}>
                  <Text style={styles.chatRoomTitle}>{room.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(room.is_approved) }]}>
                    <Text style={styles.statusText}>{getStatusText(room.is_approved)}</Text>
                  </View>
                </View>
                <Text style={styles.chatRoomPurpose}>{room.purpose}</Text>
                <View style={styles.chatRoomFooter}>
                  <Text style={styles.chatRoomMeta}>
                    생성자: {room.creator_nickname} • {formatDate(room.created_at)}
                  </Text>
                  <Text style={styles.memberCount}>멤버 {room.member_count}명</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 참여 중인 채팅방 */}
        {chatRooms?.approved_rooms && chatRooms.approved_rooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>참여 중인 채팅방 ({chatRooms.approved_rooms.length})</Text>
            {chatRooms.approved_rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.chatRoomItem}
                onPress={() => router.push(`/pages/chat-room?id=${room.id}` as any)}
              >
                <View style={styles.chatRoomHeader}>
                  <Text style={styles.chatRoomTitle}>{room.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(room.is_approved) }]}>
                    <Text style={styles.statusText}>{getStatusText(room.is_approved)}</Text>
                  </View>
                </View>
                <Text style={styles.chatRoomPurpose}>{room.purpose}</Text>
                {room.last_message && (
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {room.last_message}
                  </Text>
                )}
                <View style={styles.chatRoomFooter}>
                  <Text style={styles.chatRoomMeta}>
                    생성자: {room.creator_nickname} • {formatDate(room.created_at)}
                  </Text>
                  <Text style={styles.memberCount}>멤버 {room.member_count}명</Text>
                </View>
                {room.last_message_time && (
                  <Text style={styles.lastMessageTime}>
                    {formatTimeAgo(room.last_message_time)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 빈 상태 */}
        {(!chatRooms || (chatRooms.pending_rooms.length === 0 && chatRooms.approved_rooms.length === 0)) && directChats.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>채팅방이 없습니다</Text>
            <Text style={styles.emptyText}>
              새로운 채팅방을 만들어보세요!
            </Text>
            <TouchableOpacity 
              style={styles.createFirstButton}
              onPress={() => router.push('/pages/create-chat-room')}
            >
              <Text style={styles.createFirstButtonText}>채팅방 만들기</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'GmarketSans',
  },
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    fontFamily: 'GmarketSans',
  },
  chatRoomItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chatRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatRoomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  chatRoomPurpose: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  lastMessage: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 8,
    fontStyle: 'italic',
    fontFamily: 'GmarketSans',
  },
  chatRoomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatRoomMeta: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  memberCount: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  lastMessageTime: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'GmarketSans',
  },
  createFirstButton: {
    backgroundColor: '#2D3A4A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  directChatItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  directChatProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  directChatInfo: {
    flex: 1,
    marginRight: 10,
  },
  directChatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
    marginBottom: 4,
  },
  directChatLastMessage: {
    fontSize: 13,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  directChatRight: {
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#FF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  directChatTime: {
    fontSize: 11,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
}); 