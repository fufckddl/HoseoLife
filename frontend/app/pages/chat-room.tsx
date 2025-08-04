import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { chatService, ChatRoomDetailData, ChatMessageData } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, notificationsEnabled } = useAuth();
  const roomId = parseInt(params.id as string);
  
  const [chatRoom, setChatRoom] = useState<ChatRoomDetailData | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true); // 스크롤 위치 추적
  const [hasNewMessages, setHasNewMessages] = useState(false); // 새 메시지 알림
  const [showSideMenu, setShowSideMenu] = useState(false); // 사이드 메뉴 표시
  const [roomNotificationsEnabled, setRoomNotificationsEnabled] = useState(true); // 채팅방 개별 알림 설정
  
  const flatListRef = useRef<FlatList>(null);
  const messageInputRef = useRef<TextInput>(null);

  const loadChatRoom = async () => {
    try {
      setLoading(true);
      const roomData = await chatService.getChatRoomDetail(roomId);
      setChatRoom(roomData);
    } catch (error) {
      console.error('채팅방 정보 로드 실패:', error);
      Alert.alert('오류', '채팅방 정보를 불러오는데 실패했습니다.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const messageData = await chatService.getChatMessages(roomId);
      const previousMessageCount = messages.length;
      setMessages(messageData);
      
      // 새 메시지가 추가되었을 때
      if (messageData.length > previousMessageCount) {
        if (isAtBottom) {
          // 사용자가 맨 아래에 있으면 자동 스크롤
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          // 사용자가 맨 아래에 있지 않으면 새 메시지 알림 표시
          setHasNewMessages(true);
        }
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom;
    setIsAtBottom(isCloseToBottom);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setHasNewMessages(false);
  };

  const toggleSideMenu = () => {
    setShowSideMenu(!showSideMenu);
  };

  const handleRoomNotificationToggle = (value: boolean) => {
    setRoomNotificationsEnabled(value);
    // TODO: 서버에 개별 채팅방 알림 설정 저장
    console.log(`채팅방 알림 설정 변경: ${value ? '켜짐' : '꺼짐'}`);
  };

  // 실제 알림 상태 계산 (전체 알림 && 개별 채팅방 알림)
  const isNotificationActive = notificationsEnabled && roomNotificationsEnabled;

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadChatRoom(), loadMessages()]);
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      if (roomId) {
        refreshData();
      }
    }, [roomId])
  );

  // 주기적으로 메시지 새로고침 (실시간 효과)
  useEffect(() => {
    if (chatRoom?.is_approved) {
      const interval = setInterval(() => {
        loadMessages();
      }, 1000); // 1초마다 새로고침으로 실시간성 향상

      return () => clearInterval(interval);
    }
  }, [chatRoom?.is_approved]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      return;
    }

    try {
      setSending(true);
      const sentMessage = await chatService.sendMessage(roomId, {
        content: newMessage.trim()
      });
      
      setNewMessage('');
      setMessages(prev => [...prev, sentMessage]);
      
      // 메시지 전송 후 즉시 새로고침하여 최신 상태 유지
      setTimeout(() => {
        loadMessages();
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  // UTC 시간을 한국 시간으로 변환하는 함수
  const convertToKoreaTime = (dateString: string) => {
    const date = new Date(dateString);
    // UTC 시간에 9시간을 더해서 한국 시간으로 변환
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime;
  };

  const formatMessageTime = (dateString: string) => {
    const koreaDate = convertToKoreaTime(dateString);
    const hours = String(koreaDate.getHours()).padStart(2, '0');
    const minutes = String(koreaDate.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderMessage = ({ item }: { item: ChatMessageData }) => {
    const isMyMessage = item.sender_id === user?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {!isMyMessage && (
          <View style={styles.senderInfo}>
            {item.sender_profile_image_url ? (
              <Image 
                source={{ uri: item.sender_profile_image_url, cache: 'reload' }} 
                style={styles.senderProfileImage} 
              />
            ) : (
              <Image 
                source={require('../../assets/images/camsaw_human.png')} 
                style={styles.senderProfileImage} 
              />
            )}
            <Text style={styles.senderName}>{item.sender_nickname}</Text>
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
        </View>
        <Text style={[
          styles.messageTime,
          isMyMessage ? styles.myMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(item.created_at)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>채팅방을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!chatRoom) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>채팅방을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.roomTitle}>{chatRoom.title}</Text>
          <Text style={styles.memberCount}>멤버 {chatRoom.members.length}명</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={toggleSideMenu}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* 승인되지 않은 채팅방 안내 */}
      {!chatRoom.is_approved && (
        <View style={styles.approvalNotice}>
          <Text style={styles.approvalNoticeText}>
            ⏳ 관리자 승인 대기 중입니다. 승인 후 채팅이 가능합니다.
          </Text>
        </View>
      )}

      {/* 메시지 목록 */}
      <FlatList
        ref={flatListRef}
        style={styles.messageList}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={refreshData}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageListContent}
        onScroll={handleScroll}
      />

      {/* 새 메시지 알림 버튼 */}
      {hasNewMessages && (
        <TouchableOpacity style={styles.newMessageButton} onPress={scrollToBottom}>
          <Text style={styles.newMessageButtonText}>새 메시지 보기</Text>
        </TouchableOpacity>
      )}

      {/* 메시지 입력 영역 */}
      {chatRoom.is_approved && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <TextInput
            ref={messageInputRef}
            style={styles.messageInput}
            placeholder="메시지를 입력하세요..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
            placeholderTextColor="#999999"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>전송</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      {/* 사이드 메뉴 */}
      {showSideMenu && (
        <View style={styles.sideMenuOverlay}>
          <TouchableOpacity 
            style={styles.sideMenuBackdrop} 
            onPress={toggleSideMenu}
            activeOpacity={1}
          />
          <SafeAreaView style={styles.sideMenu}>
            <View style={styles.sideMenuHeader}>
              <Text style={styles.sideMenuTitle}>채팅방 정보</Text>
              <TouchableOpacity onPress={toggleSideMenu}>
                <Text style={styles.sideMenuClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* 채팅방 제목 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>채팅방 제목</Text>
              <Text style={styles.sideMenuRoomTitle}>{chatRoom.title}</Text>
            </View>

            {/* 알림 설정 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>알림 설정</Text>
              <View style={styles.sideMenuNotificationRow}>
                <Text style={styles.sideMenuNotificationText}>
                  {isNotificationActive ? '알림 켜짐' : '알림 꺼짐'}
                </Text>
                <Switch
                  value={roomNotificationsEnabled}
                  onValueChange={handleRoomNotificationToggle}
                  trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                  thumbColor={roomNotificationsEnabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              {!notificationsEnabled && (
                <Text style={styles.sideMenuNotificationNote}>
                  * 전체 알림이 꺼져있어 개별 설정이 적용되지 않습니다
                </Text>
              )}
            </View>

            {/* 참여자 목록 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>참여자 ({chatRoom.members.length}명)</Text>
              <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
                {chatRoom.members.map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.nickname}</Text>
                      <Text style={styles.memberJoined}>
                        {new Date(member.joined_at).toLocaleDateString('ko-KR')} 참여
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 12,
  },
  backIcon: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'GmarketSans',
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#333',
  },
  approvalNotice: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFEAA7',
  },
  approvalNoticeText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  messageList: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  myMessageTime: {
    alignSelf: 'flex-end',
  },
  otherMessageTime: {
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    fontFamily: 'GmarketSans',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  newMessageButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  newMessageButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  sideMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  sideMenuBackdrop: {
    flex: 1,
  },
  sideMenu: {
    position: 'absolute',
    right: 0,
    width: '70%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
    zIndex: 11,
  },
  sideMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sideMenuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'GmarketSans',
  },
  sideMenuClose: {
    fontSize: 24,
    color: '#333',
  },
  sideMenuSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sideMenuSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  sideMenuRoomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    fontFamily: 'GmarketSans',
  },
  sideMenuNotificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideMenuNotificationText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'GmarketSans',
  },
  sideMenuNotificationNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  membersList: {
    maxHeight: 200,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'GmarketSans',
  },
  memberJoined: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'GmarketSans',
  },
}); 