import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Switch,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chatService } from '../services/chatService';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import { websocketService, ChatMessage } from '../services/websocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatStateStore } from '../stores/chatStateStore';
import { userService } from '../services/userService';
import { useGroupStore } from '../stores/groupStore';

interface OptimisticMessage extends ChatMessage {
  isOptimistic: boolean;
  clientMsgId: string;
  isSystemMessage?: boolean;
}

export default function ChatRoomScreen() {
  const router = useRouter();
  
  // useChatStateStore 안전하게 사용
  let chatStateStore: any = null;
  try {
    chatStateStore = useChatStateStore();
    console.log('✅ useChatStateStore 로드 성공:', chatStateStore);
  } catch (error) {
    console.error('❌ useChatStateStore 로드 실패:', error);
    // Store 로드 실패 시 기본값 설정
    chatStateStore = {
      setCurrentRoom: () => console.log('⚠️ Store not available'),
      clearCurrentRoom: () => console.log('⚠️ Store not available'),
      isInRoom: () => false
    };
  }
  
  // 파라미터 안전하게 처리 - 컴포넌트 최상위에서 호출
  let params: any = null;
  let roomId: number | null = null;
  let roomType: string | null = null;
  let hasValidParams = false;
  
  try {
    params = useLocalSearchParams();
    console.log('🔍 채팅방 파라미터 로드:', params);
    
    if (params?.id && params?.type) {
      roomId = parseInt(params.id as string);
      roomType = params.type as string;
      hasValidParams = true;
    } else {
      console.error('❌ 채팅방 파라미터가 없습니다:', params);
      Alert.alert('오류', '채팅방 정보를 찾을 수 없습니다.', [
        { text: '확인', onPress: () => router.back() }
      ]);
    }
  } catch (error) {
    console.error('❌ 파라미터 로드 실패:', error);
    Alert.alert('오류', '채팅방 정보를 불러오는데 실패했습니다.', [
      { text: '확인', onPress: () => router.back() }
    ]);
  }
  
  // 파라미터가 유효하지 않으면 로딩 화면 표시
  if (!hasValidParams || !roomId || !roomType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>채팅방을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // 파라미터가 유효하지 않으면 로딩 화면 표시
  if (!hasValidParams || !roomId || !roomType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>채팅방을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingImages, setSendingImages] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  
  // 햄버거 메뉴 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  
  // groupStore 사용
  const { refreshMyRooms } = useGroupStore();
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCurrentUser();
    loadMessages();
    setupWebSocket();
    loadParticipants();
    // 입장 시 방별 알림 설정 로드
    chatService.getRoomNotifications(roomId)
      .then(res => {
        setNotificationsEnabled(!!res.notifications_enabled);
        console.log('🔔 방 알림 초기 상태:', res.notifications_enabled);
      })
      .catch(err => {
        // 404 등은 기본값 사용
        console.warn('⚠️ 방 알림 상태 로드 실패. 기본값(true) 사용:', err?.status || err);
        setNotificationsEnabled(true);
      });
    
    // 채팅방 입장 상태 설정
    chatStateStore.setCurrentRoom(roomId, roomType as 'dm' | 'group');
    
    return () => {
      // 채팅방 나가기
      websocketService.leaveRoom(roomId);
      chatStateStore.clearCurrentRoom();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, roomType]);

  const loadCurrentUser = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (userId) {
        setCurrentUserId(parseInt(userId));
      }
    } catch (error) {
      console.error('사용자 ID 로드 실패:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      setLoadingParticipants(true);
      console.log('🔍 참여자 목록 로드 시작 - Room ID:', roomId);
      
      // 실제 참여자 목록 API 호출
      const data = await chatService.getRoomParticipants(roomId);
      
      if (data && data.participants) {
        console.log('✅ 참여자 목록 로드 성공 - 참여자 수:', data.total_count);
        setParticipants(data.participants);
        } else {
        console.warn('⚠️ 참여자 목록이 비어있습니다');
        setParticipants([]);
      }
    } catch (error) {
      console.error('❌ 참여자 목록 로드 실패:', error);
      // 에러 발생 시 빈 배열로 설정
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    console.log('🔔 알림 설정 변경:', next);
    // 백엔드에 방별 알림 설정 저장
    chatService.toggleRoomNotifications(roomId!, next).catch(err => {
      console.error('❌ 알림 설정 저장 실패:', err);
      // 실패 시 UI 롤백
      setNotificationsEnabled(!next);
    });
  };

  const leaveChatRoom = async () => {
    Alert.alert(
      '채팅방 나가기',
      '정말로 이 채팅방을 나가시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 채팅방 나가기 실행 - Room ID:', roomId);
              
              // 백엔드 API 호출
              await chatService.leaveRoom(roomId);
              
              // WebSocket 연결 해제
              websocketService.leaveRoom(roomId);
              
              // 채팅방 상태 초기화
              chatStateStore.clearCurrentRoom();
              
              // 채팅방 목록 새로고침
              await refreshMyRooms();
              
              // 채팅방 목록으로 이동
              router.push('/pages/my-chats');
              
              console.log('✅ 채팅방 나가기 완료');
            } catch (error) {
              console.error('❌ 채팅방 나가기 실패:', error);
              Alert.alert('오류', '채팅방 나가기에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('🔍 메시지 로드 시작 - Room ID:', roomId, 'Type:', roomType);
      
      let chatMessages;
      
      // 그룹 채팅방인지 1:1 채팅방인지 구분하여 API 호출
      if (roomType === 'group') {
        console.log('👥 그룹 채팅방 메시지 조회');
        const groupData = await chatService.getGroupChatMessages(roomId);
        chatMessages = groupData.messages || [];
      } else {
        console.log('💬 1:1 채팅방 메시지 조회 (새로운 Room 모델)');
        const groupData = await chatService.getGroupChatMessages(roomId);
        chatMessages = groupData.messages || [];
      }
      
      // 낙관적 메시지와 실제 메시지 구분
      const optimisticMessages = messages.filter(msg => msg.isOptimistic);
      const realMessages = chatMessages.map((msg: any) => ({
        ...msg,
        isOptimistic: false,
        clientMsgId: msg.client_msg_id || '',
        // sender_id가 null인 경우 시스템 메시지로 처리 (카카오톡 스타일)
        isSystemMessage: msg.sender_id === null,
      }));
      
      console.log('✅ 메시지 로드 완료 - 메시지 수:', realMessages.length);
      setMessages([...optimisticMessages, ...realMessages]);
    } catch (error) {
      console.error('❌ 메시지 로드 실패:', error);
      Alert.alert('오류', '메시지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    // WebSocket 연결 및 채팅방 참여
    websocketService.connect().then(() => {
      websocketService.joinRoom(roomId);
    });

    // 새 메시지 수신
    websocketService.onMessage((message) => {
      try {
        // room_id를 안전하게 숫자로 변환하여 비교
        const messageRoomId = typeof message.room_id === 'string' ? parseInt(message.room_id) : message.room_id;
        if (messageRoomId === roomId) {
          console.log('📨 WebSocket 메시지 수신:', message);
          
          // 시스템 메시지 처리
          if ((message as any).type === 'system_message') {
            setMessages(prev => [...prev, {
              id: -1, // 시스템 메시지는 임시 ID
              room_id: roomId,
              sender_id: null, // 시스템 메시지는 sender_id가 없음
              content: message.content,
              sent_at: message.sent_at || new Date().toISOString(),
              is_deleted: false,
              isOptimistic: false,
              clientMsgId: `system_${Date.now()}`,
              isSystemMessage: true, // 시스템 메시지 플래그
            }]);
          } else {
            // 일반 메시지 처리
            setMessages(prev => {
              // 낙관적 메시지가 실제 메시지로 대체되었는지 확인
              const filteredMessages = prev.filter(msg => 
                !msg.isOptimistic || msg.clientMsgId !== message.client_msg_id
              );
              
              return [...filteredMessages, {
                ...message,
                isOptimistic: false,
                clientMsgId: message.client_msg_id || '',
              }];
            });
          }
          
          // 자동 스크롤
      setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
      }, 100);
        }
    } catch (error) {
        console.error('❌ WebSocket 메시지 처리 실패:', error);
      }
    });

    // 타이핑 상태 수신
    websocketService.onTyping((typingRoomId, userId, isTyping) => {
      try {
        // room_id를 안전하게 숫자로 변환하여 비교
        const typingRoomIdNum = typeof typingRoomId === 'string' ? parseInt(typingRoomId) : typingRoomId;
        if (typingRoomIdNum === roomId) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (isTyping) {
              newSet.add(userId);
            } else {
              newSet.delete(userId);
            }
            return newSet;
          });
        }
      } catch (error) {
        console.error('❌ 타이핑 상태 처리 실패:', error);
      }
    });

    // 읽음 확인 수신
    websocketService.onReadReceipt((roomId, userId, messageId) => {
      // 읽음 확인 처리 (UI 업데이트)
      console.log(`사용자 ${userId}가 메시지 ${messageId}를 읽었습니다`);
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const clientMsgId = `msg_${Date.now()}_${Math.random()}`;
    const optimisticMessage: OptimisticMessage = {
      id: -1, // 임시 ID
      room_id: roomId,
      sender_id: currentUserId!,
      content: inputText.trim(),
      sent_at: new Date().toISOString(),
      is_deleted: false,
      isOptimistic: true,
      clientMsgId,
    };

    // 낙관적 업데이트
    setMessages(prev => [...prev, optimisticMessage]);
    setInputText('');
    setSending(true);

    // 자동 스크롤
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // 서버에 메시지 전송
      let sentMessage;
      
      if (roomType === 'group') {
        console.log('👥 그룹 채팅방 메시지 전송');
        sentMessage = await chatService.sendGroupMessage(roomId, inputText.trim());
      } else {
        console.log('💬 1:1 채팅방 메시지 전송 (새로운 Room 모델)');
        sentMessage = await chatService.sendGroupMessage(roomId, inputText.trim());
      }
      
      // 낙관적 메시지를 실제 메시지로 교체
      setMessages(prev => 
        prev.map(msg => 
          msg.clientMsgId === clientMsgId 
            ? { ...sentMessage, isOptimistic: false, clientMsgId }
            : msg
        )
      );
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      
      // 실패 시 낙관적 메시지 제거
      setMessages(prev => prev.filter(msg => msg.clientMsgId !== clientMsgId));
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    
    // 타이핑 상태 전송
    if (!isTyping) {
      setIsTyping(true);
      websocketService.sendTyping(roomId, true);
    }
    
    // 타이핑 타이머 리셋
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      websocketService.sendTyping(roomId, false);
    }, 3000);
  };

  const renderMessage = ({ item }: { item: OptimisticMessage }) => {
    // 시스템 메시지 렌더링
    if (item.isSystemMessage) {
    return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
      );
    }
        
    const isOwnMessage = currentUserId === item.sender_id;
    
    // 이미지 메시지
    const images: string[] | undefined = (item as any).image_urls || (item as any).imageUrls;
    if (images && images.length > 0) {
    return (
        <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
          {/* 이미지 메시지는 말풍선 배경 없이 독립 컨테이너에 렌더 */}
          <View style={styles.imageGridContainer}>{renderImageGrid(images)}</View>
          {item.sent_at ? (
            <Text style={styles.messageTime}>
              {new Date(item.sent_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
          </View>
      );
    }
        
    return (
        <View style={[
          styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
          <View style={[
            styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
          item.isOptimistic && styles.optimisticMessage
          ]}>
            <Text style={[
              styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
          {item.isOptimistic && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.sendingIndicator} />
          )}
          </View>
        <Text style={styles.messageTime}>
          {new Date(item.sent_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
            </Text>
        </View>
    );
  };

  const renderImageGrid = (urls: string[]) => {
    const GRID_WIDTH = 240;
    // 이미지 개수에 따라 컬럼 동적 결정 (<=4: 2열, 5~8: 3열, 9+: 4열)
    const columns = urls.length >= 9 ? 4 : urls.length >= 5 ? 3 : 2;

    // 2열 + 홀수(>=3)에서는 카카오톡 유사 첫 행 패턴 적용
    if (columns === 2 && urls.length >= 3 && urls.length % 2 === 1) {
      const first = urls[0];
      const rest = urls.slice(1);
      const rows: string[][] = [];
      for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
      const half = GRID_WIDTH / 2;
      return (
        <View style={styles.imageGrid}>
          <View style={styles.imageRow}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => { setImageViewerImages(urls); setImageViewerIndex(0); setImageViewerVisible(true); }}>
              <Image source={{ uri: first }} style={{ width: half, height: GRID_WIDTH, borderRadius: 12 }} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'column', height: GRID_WIDTH }}>
              {rest[0] && (
                <TouchableOpacity activeOpacity={0.9} onPress={() => { setImageViewerImages(urls); setImageViewerIndex(1); setImageViewerVisible(true); }}>
                  <Image source={{ uri: rest[0] }} style={{ width: half, height: half, borderTopRightRadius: 12 }} />
                </TouchableOpacity>
              )}
              {rest[1] && (
                <TouchableOpacity activeOpacity={0.9} onPress={() => { setImageViewerImages(urls); setImageViewerIndex(2); setImageViewerVisible(true); }}>
                  <Image source={{ uri: rest[1] }} style={{ width: half, height: half, borderBottomRightRadius: 12 }} />
                </TouchableOpacity>
          )}
        </View>
          </View>
          {rows.slice(1).map((row, idx) => {
            const cellW = GRID_WIDTH / (row.length === 0 ? columns : row.length);
            return (
              <View key={`r${idx}`} style={styles.imageRow}>
                {row.map((url, j) => (
                  <TouchableOpacity key={`r${idx}-${j}`} activeOpacity={0.9} onPress={() => { setImageViewerImages(urls); setImageViewerIndex(1 + idx*2 + j); setImageViewerVisible(true); }}>
                    <Image source={{ uri: url }} style={{ width: cellW, height: cellW }} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      );
    }

    // 일반 그리드: 2/3/4열. 마지막 행이 비면 남은 칸만큼 균등 분배
    const rows: string[][] = [];
    for (let i = 0; i < urls.length; i += columns) rows.push(urls.slice(i, i + columns));
    return (
      <View style={styles.imageGrid}>
        {rows.map((row, idx) => {
          const cellW = GRID_WIDTH / row.length; // 마지막 행이 비면 남은 칸만큼 넓게
          return (
            <View key={idx} style={styles.imageRow}>
              {row.map((url, j) => (
                <TouchableOpacity key={`${idx}-${j}`} activeOpacity={0.9} onPress={() => { setImageViewerImages(urls); setImageViewerIndex(idx*columns + j); setImageViewerVisible(true); }}>
                  <Image source={{ uri: url }} style={{ width: cellW, height: cellW }} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null;
    
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {Array.from(typingUsers).length}명이 입력 중...
        </Text>
        </View>
    );
  };

  if (loading) {
    return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>메시지를 불러오는 중...</Text>
        </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 탑바 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {roomType === 'group' ? '그룹 채팅' : '1:1 채팅'}
        </Text>
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={() => setIsMenuOpen(true)}
        >
          <Ionicons name="menu" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
          keyExtractor={(item) => {
            if (item.clientMsgId) {
              return item.clientMsgId;
            }
            if (item.id !== undefined && item.id !== null) {
              return item.id.toString();
            }
            // fallback: 타임스탬프 기반 고유 키 생성
            return `msg_${Date.now()}_${Math.random()}`;
          }}
          style={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={renderTypingIndicator}
        />
        
        <View style={styles.inputContainer}>
          {/* 이미지 선택 버튼 */}
          <TouchableOpacity
            style={styles.imageButton}
            onPress={async () => {
              try {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (perm.status !== 'granted') {
                  Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  allowsMultipleSelection: true,
                  selectionLimit: 10,
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.5,
                  base64: true,
                });
                if ((result as any).canceled) return;
                const assets = (result as any).assets || [];
                if (assets.length === 0) return;
                setSendingImages(true);
                try {
                  await chatService.sendImages(roomId, assets.map((a: any) => ({ uri: a.uri, type: a.mimeType, base64: a.base64 })));
                } catch (err: any) {
                  // 권한(403)이나 정책 위반 시 사용자 메시지 구체화
                  if (err && err.__http && err.status === 403) {
                    Alert.alert('전송 실패', '이미지 전송 권한이 없습니다. 방 참여 상태를 확인해주세요.');
                  } else if (err && err.__http) {
                    Alert.alert('전송 실패', `이미지 전송 오류 (${err.status}). 잠시 후 다시 시도해주세요.`);
                  } else {
                    throw err;
                  }
                }
                // 성공 시 메시지 목록 새로고침
                await loadMessages();
              } catch (e) {
                console.error('이미지 선택/전송 실패:', e);
                Alert.alert('오류', '이미지 전송에 실패했습니다.');
              } finally {
                setSendingImages(false);
              }
            }}
          >
            <Ionicons name="image" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="메시지를 입력하세요..."
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
              <Text style={styles.sendButtonText}>전송</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>

      {/* 햄버거 메뉴 모달 */}
      <Modal
        visible={isMenuOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            {/* 헤더 */}
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>채팅방 설정</Text>
          <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setIsMenuOpen(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.menuContent}>
              {/* 참여자 목록 */}
              <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>
                  참여자 ({participants.length}명)
                </Text>
                {loadingParticipants ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  participants.map((participant) => (
                    <View key={participant.id} style={styles.participantItem}>
                      <View style={styles.participantAvatar}>
                        {participant.profile_image_url ? (
                          <Image
                            source={{ uri: participant.profile_image_url }}
                            style={styles.profileImage}
                            onError={() => {
                              // 이미지 로드 실패 시 아바타로 대체
                              console.log('프로필 이미지 로드 실패:', participant.nickname);
                            }}
                          />
                        ) : (
                          <View style={styles.avatarContainer}>
                            <Text style={styles.avatarText}>
                              {participant.nickname.charAt(0).toUpperCase()}
                </Text>
                          </View>
              )}
            </View>
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName}>{participant.nickname}</Text>
                        {participant.is_admin && (
                          <Text style={styles.adminBadge}>관리자</Text>
                        )}
                    </View>
                  </View>
                  ))
                )}
            </View>

              {/* 알림 설정 */}
              <View style={styles.menuSection}>
                <Text style={styles.sectionTitle}>알림 설정</Text>
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>채팅 알림</Text>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={notificationsEnabled ? '#007AFF' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* 채팅방 나가기 */}
              <View style={styles.menuSection}>
              <TouchableOpacity 
                style={styles.leaveButton} 
                  onPress={leaveChatRoom}
              >
                  <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                <Text style={styles.leaveButtonText}>채팅방 나가기</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
        </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  menuButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownBubble: {
    backgroundColor: '#007AFF',
  },
  otherBubble: {
    backgroundColor: '#e0e0e0',
  },
  optimisticMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    flex: 1,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: 'black',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 8,
  },
  sendingIndicator: {
    marginLeft: 8,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
  },
  imageButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageGridContainer: {
    maxWidth: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageGrid: {
    width: 240,
  },
  imageRow: {
    flexDirection: 'row',
  },
  imageCell: {
    width: 120,
    height: 120,
  },
  imageCellFull: {
    width: 240,
    height: 240,
    borderRadius: 12,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // 햄버거 메뉴 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  menuContent: {
    padding: 20,
  },
  menuSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  profileImageText: {
    fontSize: 16,
    color: '#007AFF',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  participantName: {
    fontSize: 16,
    color: '#333',
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminBadge: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontStyle: 'italic',
  },
}); 
