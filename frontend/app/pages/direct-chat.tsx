import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { directChatService, DirectMessageData } from '../services/directChatService';
import { useAuth } from '../contexts/AuthContext';

export default function DirectChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, notificationsEnabled } = useAuth();
  const otherUserId = parseInt(params.otherUserId as string);
  const otherUserNickname = params.otherUserNickname as string;
  const otherUserProfileImage = params.otherUserProfileImage as string;
  
  const [messages, setMessages] = useState<DirectMessageData[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true); // 스크롤 위치 추적
  const [hasNewMessages, setHasNewMessages] = useState(false); // 새 메시지 알림
  const [showSideMenu, setShowSideMenu] = useState(false); // 사이드 메뉴 표시
  const [directNotificationsEnabled, setDirectNotificationsEnabled] = useState(true); // 1:1 채팅 개별 알림 설정
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadInitialMessages();
  }, [otherUserId]);

  // 주기적으로 메시지 새로고침 (실시간 효과)
  useEffect(() => {
    let interval: number | undefined;
    
    // 로딩이 완료된 후에만 실시간 폴링 시작
    if (!loading) {
      interval = setInterval(() => {
        fetchMessages();
      }, 1000); // 1초마다 새로고침으로 실시간성 향상
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [otherUserId, loading]);

  const fetchMessages = async () => {
    try {
      const response = await directChatService.getDirectMessages(otherUserId);
      const previousMessageCount = messages.length;
      setMessages(response);
      
      // 새 메시지가 추가되었을 때
      if (response.length > previousMessageCount) {
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
      console.error('메시지 조회 실패:', error);
      // 실시간 폴링 중에는 에러 알림을 표시하지 않음
    }
  };

  const loadInitialMessages = async () => {
    try {
      setLoading(true);
      await fetchMessages();
    } catch (error) {
      console.error('초기 메시지 로드 실패:', error);
      Alert.alert('오류', '메시지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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

  const handleDirectNotificationToggle = (value: boolean) => {
    setDirectNotificationsEnabled(value);
    // TODO: 서버에 개별 1:1 채팅 알림 설정 저장
    console.log(`1:1 채팅 알림 설정 변경: ${value ? '켜짐' : '꺼짐'}`);
  };

  // 실제 알림 상태 계산 (전체 알림 && 개별 1:1 채팅 알림)
  const isDirectNotificationActive = notificationsEnabled && directNotificationsEnabled;

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      const sentMessage = await directChatService.sendDirectMessage(otherUserId, newMessage.trim());
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      
      // 메시지 전송 후 즉시 새로고침하여 최신 상태 유지 (로딩 상태 변경 없이)
      setTimeout(() => {
        fetchMessages();
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessageData }) => {
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

  const formatMessageTime = (createdAt: string) => {
    const date = new Date(createdAt);
    // UTC 시간에 9시간을 더해서 한국 시간으로 변환
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const hours = String(koreaTime.getHours()).padStart(2, '0');
    const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            {otherUserProfileImage ? (
              <Image 
                source={{ uri: otherUserProfileImage, cache: 'reload' }} 
                style={styles.headerProfileImage} 
              />
            ) : (
              <Image 
                source={require('../../assets/images/camsaw_human.png')} 
                style={styles.headerProfileImage} 
              />
            )}
            <Text style={styles.headerNickname}>{otherUserNickname}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>메시지를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {otherUserProfileImage ? (
            <Image 
              source={{ uri: otherUserProfileImage, cache: 'reload' }} 
              style={styles.headerProfileImage} 
            />
          ) : (
            <Image 
              source={require('../../assets/images/camsaw_human.png')} 
              style={styles.headerProfileImage} 
            />
          )}
          <Text style={styles.headerNickname}>{otherUserNickname}</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={toggleSideMenu}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 메시지 목록 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScroll={handleScroll}
        />

        {/* 새 메시지 알림 버튼 */}
        {hasNewMessages && (
          <TouchableOpacity style={styles.newMessageButton} onPress={scrollToBottom}>
            <Text style={styles.newMessageButtonText}>새 메시지 보기</Text>
          </TouchableOpacity>
        )}

        {/* 메시지 입력 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="메시지를 입력하세요..."
            multiline
            maxLength={500}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>전송</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
              <Text style={styles.sideMenuTitle}>1:1 채팅 정보</Text>
              <TouchableOpacity onPress={toggleSideMenu}>
                <Text style={styles.sideMenuClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* 상대방 정보 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>상대방 정보</Text>
              <View style={styles.sideMenuUserInfo}>
                {otherUserProfileImage ? (
                  <Image 
                    source={{ uri: otherUserProfileImage, cache: 'reload' }} 
                    style={styles.sideMenuUserImage} 
                  />
                ) : (
                  <Image 
                    source={require('../../assets/images/camsaw_human.png')} 
                    style={styles.sideMenuUserImage} 
                  />
                )}
                <Text style={styles.sideMenuUserName}>{otherUserNickname}</Text>
              </View>
            </View>

            {/* 알림 설정 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>알림 설정</Text>
              <View style={styles.sideMenuNotificationRow}>
                <Text style={styles.sideMenuNotificationText}>
                  {isDirectNotificationActive ? '알림 켜짐' : '알림 꺼짐'}
                </Text>
                <Switch
                  value={directNotificationsEnabled}
                  onValueChange={handleDirectNotificationToggle}
                  trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                  thumbColor={directNotificationsEnabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
              {!notificationsEnabled && (
                <Text style={styles.sideMenuNotificationNote}>
                  * 전체 알림이 꺼져있어 개별 설정이 적용되지 않습니다
                </Text>
              )}
            </View>

            {/* 채팅 정보 */}
            <View style={styles.sideMenuSection}>
              <Text style={styles.sideMenuSectionTitle}>채팅 정보</Text>
              <View style={styles.sideMenuChatInfo}>
                <Text style={styles.sideMenuChatInfoText}>총 메시지: {messages.length}개</Text>
                <Text style={styles.sideMenuChatInfoText}>
                  시작일: {messages.length > 0 ? new Date(messages[0].created_at).toLocaleDateString('ko-KR') : '없음'}
                </Text>
              </View>
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
  headerProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerNickname: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
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
    color: '#666',
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '70%',
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
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  myMessageTime: {
    alignSelf: 'flex-end',
  },
  otherMessageTime: {
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    fontSize: 14,
    color: '#333',
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
    marginRight: 8,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  sendButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
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
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#333',
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
  },
  sideMenuUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideMenuUserImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  sideMenuUserName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sideMenuNotificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideMenuNotificationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  sideMenuNotificationNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  sideMenuChatInfo: {
    marginTop: 8,
  },
  sideMenuChatInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
}); 