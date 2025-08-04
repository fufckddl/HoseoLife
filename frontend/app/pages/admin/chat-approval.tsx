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
  TextInput,
  Modal
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { chatService, ChatRoomData } from '../../services/chatService';

export default function ChatApprovalScreen() {
  const router = useRouter();
  const [pendingRooms, setPendingRooms] = useState<ChatRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomData | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [approving, setApproving] = useState(false);

  const loadPendingRooms = async () => {
    try {
      setLoading(true);
      const data = await chatService.getPendingChatRooms();
      console.log('로드된 대기 중인 채팅방:', data);
      setPendingRooms(data);
    } catch (error) {
      console.error('대기 중인 채팅방 로드 실패:', error);
      Alert.alert('오류', '대기 중인 채팅방 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadPendingRooms();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingRooms();
    setRefreshing(false);
  };

  const handleApproval = (room: ChatRoomData, isApproved: boolean) => {
    setSelectedRoom(room);
    setAdminResponse('');
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!selectedRoom) return;

    try {
      setApproving(true);
      await chatService.approveChatRoom(selectedRoom.id, {
        is_approved: true,
        admin_response: adminResponse.trim() || undefined
      });
      
      Alert.alert('성공', '채팅방이 승인되었습니다.');
      setShowApprovalModal(false);
      loadPendingRooms(); // 목록 새로고침
    } catch (error) {
      console.error('채팅방 승인 실패:', error);
      Alert.alert('오류', '채팅방 승인에 실패했습니다.');
    } finally {
      setApproving(false);
    }
  };

  const submitRejection = async () => {
    if (!selectedRoom) return;

    try {
      setApproving(true);
      await chatService.approveChatRoom(selectedRoom.id, {
        is_approved: false,
        admin_response: adminResponse.trim() || '채팅방 생성 요청이 거부되었습니다.'
      });
      
      Alert.alert('성공', '채팅방이 거부되었습니다.');
      setShowApprovalModal(false);
      loadPendingRooms(); // 목록 새로고침
    } catch (error) {
      console.error('채팅방 거부 실패:', error);
      Alert.alert('오류', '채팅방 거부에 실패했습니다.');
    } finally {
      setApproving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D3A4A" />
          <Text style={styles.loadingText}>대기 중인 채팅방을 불러오는 중...</Text>
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
        <Text style={styles.title}>채팅방 승인</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pendingRooms.length > 0 ? (
          pendingRooms.map((room) => (
            <View key={room.id} style={styles.roomItem}>
              <View style={styles.roomHeader}>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>대기중</Text>
                </View>
              </View>
              
              <Text style={styles.roomPurpose}>{room.purpose}</Text>
              
              <View style={styles.roomMeta}>
                <Text style={styles.creatorInfo}>
                  생성자: {room.creator_nickname}
                </Text>
                <Text style={styles.dateInfo}>
                  {formatDate(room.created_at)}
                </Text>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleApproval(room, true)}
                >
                  <Text style={styles.approveButtonText}>승인</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleApproval(room, false)}
                >
                  <Text style={styles.rejectButtonText}>거부</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>대기 중인 채팅방이 없습니다.</Text>
          </View>
        )}
      </ScrollView>

      {/* 승인/거부 모달 */}
      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>채팅방 처리</Text>
              <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedRoom && (
              <View style={styles.modalContent}>
                <Text style={styles.modalRoomTitle}>{selectedRoom.title}</Text>
                <Text style={styles.modalRoomPurpose}>{selectedRoom.purpose}</Text>
                
                <Text style={styles.modalLabel}>관리자 답변 (선택사항)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="승인/거부 사유를 입력하세요..."
                  value={adminResponse}
                  onChangeText={setAdminResponse}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor="#999999"
                />
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={submitRejection}
                disabled={approving}
              >
                <Text style={styles.modalRejectButtonText}>거부</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalApproveButton]}
                onPress={submitApproval}
                disabled={approving}
              >
                <Text style={styles.modalApproveButtonText}>승인</Text>
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  roomItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
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
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  statusBadge: {
    backgroundColor: '#FF9800',
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
  roomPurpose: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  roomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  creatorInfo: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  dateInfo: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  rejectButton: {
    backgroundColor: '#FF4444',
  },
  rejectButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
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
  modalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 80,
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
  modalRejectButton: {
    backgroundColor: '#FF4444',
  },
  modalRejectButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  modalApproveButton: {
    backgroundColor: '#4CAF50',
  },
  modalApproveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 