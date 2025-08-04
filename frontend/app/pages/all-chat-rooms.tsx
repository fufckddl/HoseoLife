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
  Modal,
  Image
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService, ChatRoomData } from '../services/chatService';

export default function AllChatRoomsScreen() {
  const router = useRouter();
  const [allChatRooms, setAllChatRooms] = useState<ChatRoomData[]>([]);
  const [userChatRooms, setUserChatRooms] = useState<ChatRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomData | null>(null);
  const [joining, setJoining] = useState(false);

  const loadAllChatRooms = async () => {
    try {
      setLoading(true);
      
      // 토큰 확인
      const token = await AsyncStorage.getItem('access_token');
      console.log('AllChatRooms - 토큰 존재 여부:', !!token);
      
      // 전체 채팅방 목록과 사용자 채팅방 목록을 병렬로 로드
      const [allData, userData] = await Promise.all([
        chatService.getAllChatRooms(),
        chatService.getUserChatRooms()
      ]);
      
      console.log('로드된 전체 채팅방 데이터:', allData);
      console.log('로드된 사용자 채팅방 데이터:', userData);
      console.log('전체 채팅방 수:', allData.length || 0);
      console.log('사용자 참여 채팅방 수:', userData.approved_rooms?.length || 0);
      
      setAllChatRooms(allData);
      setUserChatRooms(userData.approved_rooms || []);
    } catch (error) {
      console.error('전체 채팅방 목록 로드 실패:', error);
      
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
        Alert.alert('오류', '전체 채팅방 목록을 불러오는데 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadAllChatRooms();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllChatRooms();
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

  const handleChatRoomPress = (room: ChatRoomData) => {
    // 참여 중인 채팅방인지 확인
    const isParticipating = userChatRooms.some(userRoom => userRoom.id === room.id);
    
    if (isParticipating) {
      // 이미 참여 중이면 바로 채팅방으로 이동
      router.push(`/pages/chat-room?id=${room.id}` as any);
    } else {
      // 참여하지 않은 경우 참여 확인 모달 표시
      setSelectedRoom(room);
      setShowJoinModal(true);
    }
  };

  const handleJoinChatRoom = async () => {
    if (!selectedRoom) return;

    try {
      setJoining(true);
      await chatService.joinChatRoom(selectedRoom.id);
      
      Alert.alert('성공', '채팅방에 참여했습니다!');
      setShowJoinModal(false);
      
      // 목록 새로고침
      loadAllChatRooms();
    } catch (error) {
      console.error('채팅방 참여 실패:', error);
      Alert.alert('오류', '채팅방 참여에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D3A4A" />
          <Text style={styles.loadingText}>전체 채팅방 목록을 불러오는 중...</Text>
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
        <Text style={styles.title}>전체 채팅방</Text>
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
        {/* 전체 채팅방 */}
        {allChatRooms && allChatRooms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>전체 채팅방 ({allChatRooms.length})</Text>
            {allChatRooms.map((room) => {
              // 참여 중인 채팅방인지 확인
              const isParticipating = userChatRooms.some(userRoom => userRoom.id === room.id);
              
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.chatRoomItem, isParticipating && styles.participatingRoom]}
                  onPress={() => handleChatRoomPress(room)}
                >
                  <View style={styles.chatRoomHeader}>
                    <Text style={styles.chatRoomTitle}>{room.title}</Text>
                    <View style={styles.statusContainer}>
                      {isParticipating && (
                        <View style={[styles.statusBadge, { backgroundColor: '#4CAF50', marginRight: 8 }]}>
                          <Text style={styles.statusText}>참여중</Text>
                        </View>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(room.is_approved) }]}>
                        <Text style={styles.statusText}>{getStatusText(room.is_approved)}</Text>
                      </View>
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
              );
            })}
          </View>
        )}

        {/* 빈 상태 */}
        {(!allChatRooms || allChatRooms.length === 0) && (
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

      {/* 참여 확인 모달 */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>채팅방 참여</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedRoom && (
              <View style={styles.modalContent}>
                <Text style={styles.modalRoomTitle}>{selectedRoom.title}</Text>
                <Text style={styles.modalRoomPurpose}>{selectedRoom.purpose}</Text>
                
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoText}>
                    생성자: {selectedRoom.creator_nickname}
                  </Text>
                  <Text style={styles.modalInfoText}>
                    멤버: {selectedRoom.member_count}명
                  </Text>
                </View>
                
                <Text style={styles.modalQuestion}>
                  이 채팅방에 참여하시겠습니까?
                </Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowJoinModal(false)}
                disabled={joining}
              >
                <Text style={styles.modalCancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalJoinButton]}
                onPress={handleJoinChatRoom}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalJoinButtonText}>참여하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  participatingRoom: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  closeButton: {
    fontSize: 20,
    color: '#666666',
  },
  modalContent: {
    padding: 20,
  },
  modalRoomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  modalRoomPurpose: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  modalInfo: {
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  modalQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#E0E0E0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  modalJoinButton: {
    backgroundColor: '#4CAF50',
  },
  modalJoinButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 