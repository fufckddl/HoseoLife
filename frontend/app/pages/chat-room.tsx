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
  Share,
  Linking,
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
import { groupChatService } from '../services/groupChatService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OptimisticMessage extends ChatMessage {
  isOptimistic: boolean;
  clientMsgId: string;
  isSystemMessage?: boolean;
  image_urls?: string[];
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
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
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>채팅방을 불러오는 중...</Text>
        </View>
      </View>
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
  const [roomName, setRoomName] = useState<string>('');
  const [leaveTime, setLeaveTime] = useState<Date | null>(null); // 사용자가 나간 시간 추적
  
  // 날짜 구분선은 메시지 데이터에 포함되므로 별도 상태 불필요
  
  // groupStore 사용
  const { refreshMyRooms } = useGroupStore();
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initializeChatRoom = async () => {
      try {
        console.log('🚀 채팅방 초기화 시작');
        await loadCurrentUser();
        await loadUserLeaveTime(); // 사용자가 나간 시간 로드
        await loadParticipants(); // 🔧 currentUserId 로드 후 참여자 로드
        await loadMessages(); // 🔧 참여자 로드 후 메시지 로드
        setupWebSocket();
        console.log('✅ 채팅방 초기화 완료');
      } catch (error) {
        console.error('❌ 채팅방 초기화 실패:', error);
        // 초기화 실패 시에도 기본적인 채팅방은 표시
        try {
          setupWebSocket();
        } catch (wsError) {
          console.error('❌ WebSocket 설정도 실패:', wsError);
        }
      }
    };
    
    initializeChatRoom();
    
    // 채팅방 입장 시 멤버십 활성화 (1:1 채팅방 재입장 시)
    if (roomType === 'dm') {
      chatService.activateMembership(roomId)
        .then(() => {
          console.log('✅ 멤버십 활성화 완료');
        })
        .catch(err => {
          console.warn('⚠️ 멤버십 활성화 실패:', err);
        });
    }
    
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
    
    // WebSocket 연결 상태 모니터링
    const connectionHandler = (connected: boolean) => {
      console.log('🔌 WebSocket 연결 상태 변경:', connected);
      if (connected) {
        // 연결되면 채팅방 참여 시도
        setTimeout(() => {
          const joinSuccess = websocketService.joinRoom(roomId);
          console.log('연결 후 채팅방 참여 시도 결과:', joinSuccess);
        }, 500);
      } else {
        console.log('❌ WebSocket 연결 끊어짐');
      }
    };
    
    websocketService.onConnectionChange(connectionHandler);
    
    return () => {
      // 채팅방 나가기
      websocketService.leaveRoom(roomId);
      websocketService.removeConnectionListener(connectionHandler);
      chatStateStore.clearCurrentRoom();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId, roomType]);

  // 🆕 참여자 정보가 변경되면 메시지를 다시 처리하여 발신자 정보 보완
  useEffect(() => {
    if (participants.length > 0 && messages.length > 0) {
      console.log('🔧 참여자 정보 로드 완료 - 메시지 발신자 정보 보완');
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          // 이미 발신자 정보가 있으면 그대로 유지
          if ((msg as any).sender_nickname) {
            return msg;
          }
          
          // 발신자 정보가 없으면 참여자 목록에서 찾기
          if (msg.sender_id) {
            const senderParticipant = participants.find(p => p.id === msg.sender_id);
            if (senderParticipant) {
              console.log(`🔧 메시지 ${msg.id} 발신자 정보 보완: ${senderParticipant.nickname}`);
              return {
                ...msg,
                sender_nickname: senderParticipant.nickname,
                sender_profile_image_url: senderParticipant.profile_image_url,
              };
            }
          }
          
          return msg;
        })
      );
    }
  }, [participants]);

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

  const loadUserLeaveTime = async () => {
    try {
      console.log('🔍 사용자 나간 시간 로드 시작 - Room ID:', roomId);
      const response = await chatService.getUserLeaveTime(roomId);
      if (response.leave_time) {
        setLeaveTime(new Date(response.leave_time));
        console.log('✅ 사용자 나간 시간 로드 완료:', response.leave_time);
      } else {
        setLeaveTime(null);
        console.log('ℹ️ 사용자 나간 시간 없음');
      }
    } catch (error) {
      console.error('❌ 사용자 나간 시간 로드 실패:', error);
      setLeaveTime(null);
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
        
        // 채팅방 제목 설정
        if (roomType === 'group') {
          // 그룹 채팅방인 경우 방 정보 API 호출
          try {
            const roomInfo = await groupChatService.getRoomInfo(roomId);
            console.log('✅ 그룹 채팅방 정보 로드 성공:', roomInfo);
            setRoomName(roomInfo.name || '그룹 채팅');
          } catch (error) {
            console.error('❌ 그룹 채팅방 정보 로드 실패:', error);
            setRoomName('그룹 채팅');
          }
        } else {
          // 1:1 채팅방인 경우 상대방 닉네임 설정
          console.log('🔍 1:1 채팅방 참여자 목록:', data.participants);
          console.log('🔍 현재 사용자 ID:', currentUserId);
          
          const otherParticipant = data.participants.find((p: any) => p.id !== currentUserId);
          console.log('🔍 상대방 참여자:', otherParticipant);
          
          if (otherParticipant) {
            console.log('✅ 상대방 닉네임 설정:', otherParticipant.nickname);
            setRoomName(otherParticipant.nickname);
          } else {
            console.warn('⚠️ 상대방을 찾을 수 없음, 기본값 사용');
            setRoomName('1:1 채팅');
          }
        }
        } else {
        console.warn('⚠️ 참여자 목록이 비어있습니다');
        setParticipants([]);
        setRoomName(roomType === 'group' ? '그룹 채팅' : '1:1 채팅');
      }
    } catch (error) {
      console.error('❌ 참여자 목록 로드 실패:', error);
      // 에러 발생 시 빈 배열로 설정
      setParticipants([]);
      setRoomName(roomType === 'group' ? '그룹 채팅' : '1:1 채팅');
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

  const shareChatRoom = async () => {
    try {
      console.log('🔗 채팅방 공유 시작 - Room ID:', roomId);
      
      // 백엔드에서 공유 링크 생성
      const response = await fetch(`https://hoseolife.kro.kr/chat/rooms/${roomId}/share-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const shareLink = data.share_link;
      
      console.log('✅ 공유 링크 생성 완료:', shareLink);

      // 공유 다이얼로그 표시
      const result = await Share.share({
        message: `호서라이프 그룹 채팅방에 초대합니다!\n\n${shareLink}\n\n앱이 설치되어 있지 않다면 네이버로 이동합니다.`,
        url: shareLink,
        title: '호서라이프 채팅방 공유',
      });

      if (result.action === Share.sharedAction) {
        console.log('✅ 공유 완료');
      }
    } catch (error) {
      console.error('❌ 채팅방 공유 실패:', error);
      Alert.alert('오류', '채팅방 공유에 실패했습니다.');
    }
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
              
              // 모달 닫기
              setIsMenuOpen(false);
              
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
      let realMessages = chatMessages.map((msg: any) => {
        // 🔧 발신자 정보 보완: 백엔드에서 받은 정보가 없으면 참여자 목록에서 찾기
        let senderNickname = msg.sender_nickname;
        let senderProfileImageUrl = msg.sender_profile_image_url;
        
        if (!senderNickname && msg.sender_id && participants.length > 0) {
          const senderParticipant = participants.find(p => p.id === msg.sender_id);
          if (senderParticipant) {
            senderNickname = senderParticipant.nickname;
            senderProfileImageUrl = senderParticipant.profile_image_url;
            console.log(`🔧 메시지 로드 시 참여자 목록에서 발신자 정보 보완: ${senderNickname} (ID: ${msg.sender_id})`);
          }
        }
        
        return {
          ...msg,
          isOptimistic: false,
          clientMsgId: msg.client_msg_id || '',
          // sender_id가 null인 경우 시스템 메시지로 처리 (카카오톡 스타일)
          isSystemMessage: msg.sender_id === null,
          // sent_at 필드 보장 (서버에서 받은 시간 정보 사용)
          sent_at: msg.sent_at || msg.created_at || new Date().toISOString(),
          // 🆕 발신자 정보 추가 (백엔드에서 받은 정보 또는 참여자 목록에서 보완)
          sender_nickname: senderNickname,
          sender_profile_image_url: senderProfileImageUrl,
        };
      });
      
      // 사용자가 나간 시간 이후의 메시지만 필터링
      if (leaveTime) {
        const filteredMessages = realMessages.filter((msg: any) => {
          if (!msg.sent_at) return false;
          const messageTime = new Date(msg.sent_at);
          return messageTime > leaveTime;
        });
        console.log(`🔍 메시지 필터링: 전체 ${realMessages.length}개 → 나간 시간 이후 ${filteredMessages.length}개`);
        realMessages = filteredMessages;
      }
      
      console.log('✅ 메시지 로드 완료 - 메시지 수:', realMessages.length);
      console.log('🔍 첫 번째 메시지 sent_at 확인:', realMessages[0]?.sent_at);
      console.log('🔍 마지막 메시지 sent_at 확인:', realMessages[realMessages.length - 1]?.sent_at);
      
      // 날짜 구분선 디버깅을 위한 로그
      if (realMessages.length > 0) {
        console.log('🔍 날짜 구분선 테스트:');
        realMessages.forEach((msg: any, idx: number) => {
          if (idx < 3) { // 처음 3개 메시지만 로그
            console.log(`  메시지 ${idx}: sent_at=${msg.sent_at}, 타입=${typeof msg.sent_at}`);
          }
        });
      }
      setMessages([...optimisticMessages, ...realMessages]);
    } catch (error) {
      console.error('❌ 메시지 로드 실패:', error);
      Alert.alert('오류', '메시지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    try {
      console.log('🔌 WebSocket 설정 시작 - Room ID:', roomId);
      
      // 새로운 스펙: room_id 기반 연결
      websocketService.connect(roomId).then((connected) => {
        if (connected) {
          console.log('✅ WebSocket 연결 성공');
          // 연결 성공 후 채팅방 참여
          setTimeout(() => {
            try {
              const joinSuccess = websocketService.joinRoom(roomId);
              console.log('채팅방 참여 시도 결과:', joinSuccess);
            } catch (joinError) {
              console.error('❌ 채팅방 참여 실패:', joinError);
            }
          }, 500);
        } else {
          console.error('❌ WebSocket 연결 실패');
        }
      }).catch((error) => {
        console.error('❌ WebSocket 연결 오류:', error);
      });
    } catch (error) {
      console.error('❌ setupWebSocket 초기화 실패:', error);
    }

    // 새 메시지 수신 (새로운 이벤트 스펙)
    websocketService.onMessage((message) => {
      try {
        console.log('📨 WebSocket 메시지 수신:', message);
        console.log('📨 메시지 타입:', message.type);
        console.log('📨 메시지 전체 구조:', JSON.stringify(message, null, 2));
        
        // room_id를 안전하게 숫자로 변환하여 비교
        const messageRoomId = typeof message.room_id === 'string' ? parseInt(message.room_id) : message.room_id;
        console.log('🔍 메시지 room_id:', messageRoomId, '현재 room_id:', roomId);
        
        if (messageRoomId === roomId) {
          console.log('✅ 현재 채팅방 메시지 확인 - UI 업데이트 시작');
          
          // 시스템 메시지 처리
          if ((message as any).sender_id === null) {
            console.log('🔔 시스템 메시지 처리');
            setMessages(prev => {
              const newSystemMessage = {
                id: (message as any).message_id || -1,
                room_id: roomId,
                sender_id: null,
                content: (message as any).content,
                sent_at: (message as any).sent_at || new Date().toISOString(),
                is_deleted: false,
                isOptimistic: false,
                clientMsgId: `system_${Date.now()}`,
                isSystemMessage: true,
              };
              console.log('🔔 시스템 메시지 추가:', newSystemMessage);
              return [...prev, newSystemMessage];
            });
          } else {
            // 일반 메시지 처리
            console.log('💬 일반 메시지 처리 - sender_id:', (message as any).sender_id, 'content:', (message as any).content);
            
            setMessages(prev => {
              // 중복 메시지 확인 (같은 message_id가 있는지)
              const existingMessage = prev.find(msg => 
                msg.id === (message as any).message_id || 
                (msg.clientMsgId && msg.clientMsgId === (message as any).client_msg_id)
              );
              
              if (existingMessage) {
                console.log('⚠️ 중복 메시지 무시:', (message as any).message_id);
                return prev;
              }
              
              // 🔧 WebSocket 메시지의 발신자 정보 보완
              let wsSenderNickname = (message as any).sender_nickname;
              let wsSenderProfileImageUrl = (message as any).sender_profile_image_url;
              
              if (!wsSenderNickname && (message as any).sender_id && participants.length > 0) {
                const senderParticipant = participants.find(p => p.id === (message as any).sender_id);
                if (senderParticipant) {
                  wsSenderNickname = senderParticipant.nickname;
                  wsSenderProfileImageUrl = senderParticipant.profile_image_url;
                  console.log(`🔧 WebSocket 메시지에서 참여자 목록으로 발신자 정보 보완: ${wsSenderNickname} (ID: ${(message as any).sender_id})`);
                }
              }

              const newMessage = {
                id: (message as any).message_id || Date.now(),
                room_id: roomId,
                sender_id: (message as any).sender_id,
                sender_nickname: wsSenderNickname,  // 🔧 보완된 발신자 닉네임
                sender_profile_image_url: wsSenderProfileImageUrl,  // 🔧 보완된 발신자 프로필 이미지
                content: (message as any).content,
                sent_at: (message as any).sent_at || new Date().toISOString(),
                is_deleted: false,
                isOptimistic: false,
                clientMsgId: (message as any).client_msg_id || `ws_${Date.now()}`,
                isSystemMessage: false,
                image_urls: (message as any).image_urls || [],
              };
              
              console.log('💬 새 메시지 추가:', newMessage);
              return [...prev, newMessage];
            });
          }
          
          // 자동 스크롤
          setTimeout(() => {
            if (flatListRef.current) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }, 100);
        } else {
          console.log('❌ 다른 채팅방 메시지 무시 - room_id 불일치');
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

    // 히스토리 수신
    websocketService.onHistory((messages) => {
      console.log('📚 채팅 히스토리 수신:', messages);
      setMessages(prev => [...prev, ...messages.map(msg => ({
        ...msg,
        isOptimistic: false,
        clientMsgId: msg.client_msg_id || `history_${Date.now()}`,
        isSystemMessage: msg.sender_id === null
      }))]);
    });

    // ACK 수신 (메시지 전송 확인)
    websocketService.onAck((data) => {
      console.log('✅ 메시지 전송 확인:', data);
      // 낙관적 메시지를 실제 메시지로 교체
      if (data.client_msg_id) {
        setMessages(prev => prev.map(msg => 
          msg.clientMsgId === data.client_msg_id 
            ? { ...msg, id: data.message_id, isOptimistic: false }
            : msg
        ));
      }
    });

    // 전달 확인 수신
    websocketService.onDelivered((data) => {
      console.log('📬 메시지 전달 확인:', data);
      // UI에서 전달 상태 표시
    });

    // 오류 수신
    websocketService.onError((error) => {
      console.error('❌ WebSocket 오류:', error);
      Alert.alert('연결 오류', error);
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const messageContent = inputText.trim();
    const clientMsgId = `msg_${Date.now()}_${Math.random()}`;
    
    console.log('📤 메시지 전송 시작:', { roomId, roomType, content: messageContent, clientMsgId });
    
    const optimisticMessage: OptimisticMessage = {
      id: -1, // 임시 ID
      room_id: roomId,
      sender_id: currentUserId!,
      content: messageContent,
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
      // HTTP API를 통해 메시지 전송 (안정성 우선)
      console.log('📤 HTTP API로 메시지 전송 시도');
      const response = await chatService.sendGroupMessage(roomId, messageContent);
      
      if (response && response.id) {
        console.log('✅ HTTP API 메시지 전송 성공 - 메시지 ID:', response.id);
        
        // 낙관적 메시지를 실제 메시지로 교체
        setMessages(prev => prev.map(msg => 
          msg.clientMsgId === clientMsgId 
            ? { ...msg, id: response.id, isOptimistic: false }
            : msg
        ));
        
        // 메시지 전송 후 leaveTime 초기화 (사용자가 다시 참여자로 인식)
        setLeaveTime(null);
        
        console.log('✅ 메시지 전송 완료');
      } else {
        throw new Error('메시지 전송 실패 - 응답 형식 오류');
      }
    } catch (error: any) {
      console.error('❌ 메시지 전송 실패:', error);
      
      // 실패 시 낙관적 메시지 제거
      setMessages(prev => prev.filter(msg => msg.clientMsgId !== clientMsgId));
      
      // 🆕 차단 에러 메시지 처리
      const errorMessage = error?.response?.data?.detail || error?.message || '메시지 전송에 실패했습니다.';
      
      if (errorMessage.includes('차단')) {
        Alert.alert('메시지 전송 불가', errorMessage);
      } else {
        Alert.alert('오류', errorMessage);
      }
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

  const renderMessage = ({ item, index }: { item: OptimisticMessage; index: number }) => {
    // 시스템 메시지 렌더링
    if (item.isSystemMessage) {
    return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
      );
    }
        
    const isOwnMessage = currentUserId === item.sender_id;
    
    // 🆕 발신자 정보 추출 (백엔드에서 받은 정보 또는 참여자 목록에서 찾기)
    let senderNickname = (item as any).sender_nickname || (item as any).senderNickname;
    let senderProfileImageUrl = (item as any).sender_profile_image_url || (item as any).senderProfileImageUrl;
    
    // 🔧 발신자 정보가 없는 경우 참여자 목록에서 찾기
    if (!senderNickname && item.sender_id) {
      if (participants.length > 0) {
        const senderParticipant = participants.find(p => p.id === item.sender_id);
        if (senderParticipant) {
          senderNickname = senderParticipant.nickname;
          senderProfileImageUrl = senderParticipant.profile_image_url;
          console.log(`🔧 참여자 목록에서 발신자 정보 찾음: ${senderNickname} (ID: ${item.sender_id})`);
        }
      }
      
      // 🔧 내 메시지인 경우 현재 사용자 정보 사용 (참여자 목록에서 못 찾은 경우)
      if (!senderNickname && isOwnMessage && currentUserId === item.sender_id) {
        // AsyncStorage에서 현재 사용자 정보 가져오기는 비동기이므로, 
        // 대신 "나"로 표시하거나 참여자 목록에서 현재 사용자 찾기
        const currentUserParticipant = participants.find(p => p.id === currentUserId);
        if (currentUserParticipant) {
          senderNickname = currentUserParticipant.nickname;
          senderProfileImageUrl = currentUserParticipant.profile_image_url;
          console.log(`🔧 현재 사용자 정보 사용: ${senderNickname}`);
        } else {
          senderNickname = '나';
        }
      }
    }
    
    // 최종 기본값 설정
    senderNickname = senderNickname || '알 수 없음';
    
    // 닉네임이 비어있거나 null인 경우 처리
    if (!senderNickname || senderNickname.trim() === '') {
      senderNickname = '알 수 없음';
    }
    
    // 🆕 카카오톡 스타일: 연속된 같은 사용자의 메시지인지 확인
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const isPrevMessageFromSameSender = prevMessage && 
      prevMessage.sender_id === item.sender_id && 
      !prevMessage.isSystemMessage;
    
    // 🆕 연속된 메시지인지 시간으로도 확인 (5분 이내)
    let isConsecutiveMessage = false;
    if (isPrevMessageFromSameSender && prevMessage?.sent_at && item.sent_at) {
      try {
        const prevTime = new Date(prevMessage.sent_at);
        const currentTime = new Date(item.sent_at);
        const timeDiff = Math.abs(currentTime.getTime() - prevTime.getTime());
        isConsecutiveMessage = timeDiff < 5 * 60 * 1000; // 5분 이내
      } catch (error) {
        console.log('시간 비교 실패:', error);
      }
    }
    
    // 🆕 프로필과 닉네임을 표시할지 결정
    const shouldShowProfile = !isOwnMessage && (!isPrevMessageFromSameSender || !isConsecutiveMessage);
    
    // sent_at 필드에서 실제 메시지 전송 시간 파싱
    let messageDate = null;
    let isValidDate = false;
    
    if (item.sent_at) {
      try {
        if (typeof item.sent_at === 'string') {
          messageDate = new Date(item.sent_at);
        } else if (item.sent_at && typeof item.sent_at === 'object') {
          messageDate = new Date(item.sent_at as any);
        } else {
          messageDate = new Date(String(item.sent_at));
        }
        isValidDate = messageDate && !isNaN(messageDate.getTime()) && messageDate.getTime() > 0;
      } catch (error) {
        console.log('❌ 시간 파싱 실패:', error);
        isValidDate = false;
        messageDate = null;
      }
    }
    // 날짜 구분선 렌더링 (카카오톡 스타일)
    const renderDateDivider = () => {
      // sent_at이 없으면 구분선 표시하지 않음
      if (!item.sent_at) {
        return null;
      }
      
      // sent_at에서 날짜만 추출 (YYYY-MM-DD 형태)
      let currentDateStr = null;
      let messageDateForDisplay = null;
      
      try {
        if (typeof item.sent_at === 'string') {
          // ISO 문자열인 경우 (예: "2025-01-27T10:30:00+09:00")
          if (item.sent_at.includes('T')) {
            currentDateStr = item.sent_at.split('T')[0];
            messageDateForDisplay = new Date(item.sent_at);
          } else {
            // 날짜만 있는 경우 (예: "2025-01-27")
            currentDateStr = item.sent_at;
            messageDateForDisplay = new Date(item.sent_at + 'T00:00:00');
          }
        } else {
          // Date 객체인 경우
          const date = new Date(item.sent_at);
          if (!isNaN(date.getTime())) {
            currentDateStr = date.toISOString().split('T')[0];
            messageDateForDisplay = date;
          }
        }
      } catch (error) {
        console.log('❌ 날짜 파싱 실패:', error);
        return null;
      }
      
      if (!currentDateStr || !messageDateForDisplay) {
        return null;
      }
      
      // 첫 번째 메시지이거나 이전 메시지와 날짜가 다른 경우
      const prevMessage = index > 0 ? messages[index - 1] : null;
      let prevDateStr = null;
      
      if (prevMessage?.sent_at) {
        try {
          if (typeof prevMessage.sent_at === 'string') {
            if (prevMessage.sent_at.includes('T')) {
              prevDateStr = prevMessage.sent_at.split('T')[0];
            } else {
              prevDateStr = prevMessage.sent_at;
            }
          } else {
            const prevDate = new Date(prevMessage.sent_at);
            if (!isNaN(prevDate.getTime())) {
              prevDateStr = prevDate.toISOString().split('T')[0];
            }
          }
        } catch (error) {
          console.log('❌ 이전 메시지 날짜 파싱 실패:', error);
        }
      }
      
      // 첫 번째 메시지이거나 이전 메시지와 날짜가 다른 경우 구분선 표시
      const shouldShowDivider = index === 0 || (prevDateStr && currentDateStr !== prevDateStr);
      
      if (shouldShowDivider) {
        ////console.log('✅ 날짜 구분선 표시:', currentDateStr, '(방:', roomId, ')');
        
        // 한국어 날짜 형식으로 표시
        const displayDate = messageDateForDisplay.toLocaleDateString('ko-KR', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          weekday: 'long'
        });
        
        return (
          <View style={styles.dateDividerContainer}>
            <View style={styles.dateDivider}>
              <Text style={styles.dateDividerText}>
                {displayDate}
              </Text>
            </View>
          </View>
        );
      }
      
      return null;
    };
    
    // 동시간 메시지에서 시간 표시 여부 결정
    const shouldShowTime = () => {
      if (!isValidDate || !messageDate) return false;
      
      // 다음 메시지가 있는지 확인
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      
      if (!nextMessage) {
        // 마지막 메시지인 경우 항상 시간 표시
        return true;
      }
      
      // 다음 메시지와 시간이 다른 경우 시간 표시
      if (nextMessage.sent_at) {
        try {
          let nextMessageDate = null;
          if (typeof nextMessage.sent_at === 'string') {
            nextMessageDate = new Date(nextMessage.sent_at);
          } else {
            nextMessageDate = new Date(String(nextMessage.sent_at));
          }
          
          if (nextMessageDate && !isNaN(nextMessageDate.getTime())) {
            // 같은 분에 보낸 메시지인지 확인 (초 단위는 무시)
            const currentMinute = messageDate.getHours() * 60 + messageDate.getMinutes();
            const nextMinute = nextMessageDate.getHours() * 60 + nextMessageDate.getMinutes();
            
            return currentMinute !== nextMinute;
          }
        } catch (error) {
          console.log('❌ 다음 메시지 시간 파싱 실패:', error);
        }
      }
      
      // 기본적으로 시간 표시
      return true;
    };
    
    // 이미지 메시지
    const images: string[] | undefined = (item as any).image_urls || (item as any).imageUrls;
    if (images && Array.isArray(images) && images.length > 0) {
    return (
        <View style={styles.messageContainer}>
          {renderDateDivider()}
          <View style={[
            styles.messageContentWrapper,
            isOwnMessage ? styles.ownMessage : styles.otherMessage
          ]}>
            <View style={[styles.messageContentContainer, isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent]}>
            {/* 🆕 카카오톡 스타일: 연속 메시지가 아닌 경우에만 프로필 이미지 표시 */}
            {shouldShowProfile && (
              <View style={styles.profileContainer}>
                {senderProfileImageUrl ? (
                  <Image 
                    source={{ uri: senderProfileImageUrl }} 
                    style={styles.profileImage}
                    onError={() => console.log('프로필 이미지 로드 실패:', senderNickname)}
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileImageText}>
                      {senderNickname && senderNickname.length > 0 ? senderNickname.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* 🔧 연속 메시지인 경우 프로필 공간만큼 여백 추가 */}
            {!isOwnMessage && !shouldShowProfile && (
              <View style={styles.profileSpacer} />
            )}
            
            <View style={styles.messageContent}>
              {/* 🆕 카카오톡 스타일: 연속 메시지가 아닌 경우에만 닉네임 표시 */}
              {shouldShowProfile && (
                <Text style={styles.senderNickname}>{senderNickname}</Text>
              )}
              
              {/* 이미지 메시지는 말풍선 배경 없이 독립 컨테이너에 렌더 */}
              <View style={styles.imageGridContainer}>{renderImageGrid(images)}</View>
              {shouldShowTime() && (
                <View style={[styles.messageTimeContainer, isOwnMessage ? styles.ownTimeContainer : styles.otherTimeContainer]}>
                  <Text style={styles.messageTime}>
                    {messageDate?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
          </View>
          </View>
        </View>
      );
    }
        
    return (
        <View style={styles.messageContainer}>
          {renderDateDivider()}
          <View style={[
            styles.messageContentWrapper,
            isOwnMessage ? styles.ownMessage : styles.otherMessage
          ]}>
            <View style={[styles.messageContentContainer, isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent]}>
            {/* 🆕 카카오톡 스타일: 연속 메시지가 아닌 경우에만 프로필 이미지 표시 */}
            {shouldShowProfile && (
              <View style={styles.profileContainer}>
                {senderProfileImageUrl ? (
                  <Image 
                    source={{ uri: senderProfileImageUrl }} 
                    style={styles.profileImage}
                    onError={() => console.log('프로필 이미지 로드 실패:', senderNickname)}
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileImageText}>
                      {senderNickname && senderNickname.length > 0 ? senderNickname.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* 🔧 연속 메시지인 경우 프로필 공간만큼 여백 추가 */}
            {!isOwnMessage && !shouldShowProfile && (
              <View style={styles.profileSpacer} />
            )}
            
            <View style={styles.messageContent}>
              {/* 🆕 카카오톡 스타일: 연속 메시지가 아닌 경우에만 닉네임 표시 */}
              {shouldShowProfile && (
                <Text style={styles.senderNickname}>{senderNickname}</Text>
              )}
              
              <View style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownBubble : styles.otherBubble,
                item.isOptimistic && styles.optimisticMessage
              ]}>
                <Text 
                  style={[
                    styles.messageText,
                    isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                  ]}
                >
                  {item.content}
                </Text>
                {item.isOptimistic && (
                  <ActivityIndicator 
                    size="small" 
                    color={isOwnMessage ? "#FFFFFF" : "#007AFF"} 
                    style={styles.sendingIndicator} 
                  />
                )}
              </View>
              {shouldShowTime() && (
                <View style={[styles.messageTimeContainer, isOwnMessage ? styles.ownTimeContainer : styles.otherTimeContainer]}>
                  <Text style={styles.messageTime}>
                    {messageDate?.toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
          </View>
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
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>메시지를 불러오는 중...</Text>
          </View>
        </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
      {/* 상단 탑바 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.push('/pages/my-chats')}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {roomName || (roomType === 'group' ? '그룹 채팅' : '1:1 채팅')}
        </Text>
        <View style={styles.headerRight}>
          
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={() => setIsMenuOpen(true)}
          >
            <Ionicons name="menu" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
          keyExtractor={(item, index) => {
            if (item.clientMsgId) {
              return item.clientMsgId;
            }
            if (item.id !== undefined && item.id !== null) {
              return item.id.toString();
            }
            // fallback: 인덱스 기반 고유 키 생성
            return `msg_${index}_${Date.now()}`;
          }}
          style={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={renderTypingIndicator}
        />
        
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
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
                  selectionLimit: 5, // 10개에서 5개로 줄임
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.05, // 0.1에서 0.05로 더 압축 (5% 품질)
                  base64: true, // Base64 인코딩 활성화
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
                  } else if (err && err.__http && err.status === 413) {
                    Alert.alert('전송 실패', '이미지 파일이 너무 큽니다. 더 작은 이미지를 선택하거나 이미지 개수를 줄여주세요.');
                  } else if (err && err.__http) {
                    Alert.alert('전송 실패', `이미지 전송 오류 (${err.status}). 잠시 후 다시 시도해주세요.`);
                  } else {
                    throw err;
                  }
                }
                // 성공 시 WebSocket을 통해 실시간으로 메시지가 전송되므로 별도 새로고침 불필요
                console.log('✅ 이미지 전송 완료 - WebSocket을 통해 실시간 업데이트됨');
              } catch (e) {
                console.error('이미지 선택/전송 실패:', e);
                Alert.alert('오류', '이미지 전송에 실패했습니다.');
              } finally {
                setSendingImages(false);
              }
            }}
          >
            <Ionicons name="image" size={22} color="#000000" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="메시지를 입력하세요..."
            multiline
            maxLength={1000}
            scrollEnabled={true}
            textAlignVertical="top"
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
            <TouchableOpacity 
              style={styles.menuHeader}
              onPress={() => setIsMenuOpen(false)}
              activeOpacity={0.9}
            >
              <View style={styles.menuHeaderContent}>
                <View style={styles.menuHeaderLeft}>
                  <View style={styles.menuHeaderIcon}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.menuHeaderTextContainer}>
                    <Text style={styles.menuTitle}>
                      {roomName || (roomType === 'group' ? '그룹 채팅' : '1:1 채팅')}
                    </Text>
                    <Text style={styles.menuSubtitle}>
                      {roomType === 'group' ? `${participants.length}명` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.menuHeaderRight}>
                  {/* 채팅방 공유 버튼 - 그룹 채팅일 경우에만 표시 */}
                  {roomType === 'group' && (
                    <TouchableOpacity 
                      style={styles.menuHeaderActionButton}
                      onPress={shareChatRoom}
                    >
                      <Ionicons name="share" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                  
                  {/* 채팅방 나가기 버튼 */}
                  <TouchableOpacity 
                    style={styles.menuHeaderActionButton}
                    onPress={leaveChatRoom}
                  >
                    <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                  
                  {/* 닫기 버튼 */}
                  <TouchableOpacity style={styles.closeButton} onPress={() => setIsMenuOpen(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
            
            <ScrollView 
              style={styles.menuContent}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                // 아래로 스크롤할 때 (음수 값) 모달 닫기
                if (offsetY < -50) {
                  setIsMenuOpen(false);
                }
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 전체화면 이미지 뷰어 */}
      <FullScreenImageViewer
        visible={imageViewerVisible}
        images={imageViewerImages}
        initialIndex={imageViewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#B2C7DA', // 🔧 카카오톡 스타일: 연한 파란색 배경
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
  messageContentWrapper: {
    // 날짜 구분선과 메시지 내용을 분리하기 위한 래퍼
  },
  messageContentContainer: {
    flexDirection: 'row',  // 🔧 카카오톡 스타일: 프로필과 메시지 가로 배치
    alignItems: 'flex-start',
  },
  // 🆕 카카오톡 스타일 메시지 컨테이너
  ownMessageContent: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1,
  },
  otherMessageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  ownMessage: {
    alignItems: 'flex-end',
    marginLeft: 60, // 🔧 카카오톡 스타일: 내 메시지 좌측 여백 조정
  },
  otherMessage: {
    alignItems: 'flex-start',
    marginRight: 60, // 🔧 카카오톡 스타일: 상대방 메시지 우측 여백 조정
  },
  messageBubble: {
    maxWidth: '85%', // 최대 너비를 늘려서 텍스트가 더 넓게 표시되도록
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start', // 메시지 내용에 맞게 크기 조정
    minWidth: 60, // 최소 너비 설정
  },
  ownBubble: {
    backgroundColor: '#000000', // 🔧 내 메시지는 검은색 배경
    alignSelf: 'flex-end', // 내 메시지는 오른쪽 정렬
  },
  otherBubble: {
    backgroundColor: '#FFFFFF', // 🔧 카카오톡 스타일: 상대방 메시지는 흰색
    alignSelf: 'flex-start', // 상대방 메시지는 왼쪽 정렬
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optimisticMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20, // 🔧 줄 간격 설정으로 자연스러운 줄바꿈
  },
  ownMessageText: {
    color: '#FFFFFF', // 🔧 검은색 배경에 흰색 텍스트
  },
  otherMessageText: {
    color: '#000000', // 🔧 카카오톡 스타일: 흰색 배경에 검은색 텍스트
  },
  messageTime: {
    fontSize: 11,
    color: '#999', // 원래 색상으로 복원
  },
  messageTimeContainer: {
    marginTop: 4,
    marginHorizontal: 8,
  },
  ownTimeContainer: {
    alignItems: 'flex-end', // 내 메시지는 오른쪽 정렬
  },
  otherTimeContainer: {
    alignItems: 'flex-start', // 상대방 메시지는 왼쪽 정렬
    marginLeft: 8, // 왼쪽 여백 추가
  },
  messageDate: {
    fontSize: 10,
    color: '#ccc',
    marginTop: 2,
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
    backgroundColor: 'white', // 원래 흰색으로 복원
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
    height: 40, // 고정 높이 설정
    maxHeight: 40, // 최대 높이도 동일하게 설정
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
    backgroundColor: '#000000',
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
    backgroundColor: '#f8f9fa',
  },
  menuHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  menuHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuHeaderTextContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
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
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
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
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  shareButtonText: {
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
  dateDividerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    width: '100%',
    paddingHorizontal: 0, // 좌우 패딩 제거
  },
  dateDivider: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
    marginHorizontal: 0, // 좌우 마진 제거
  },
  dateDividerText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  menuHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuHeaderActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // 🆕 카카오톡 스타일 프로필 관련 스타일들
  profileContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  profileSpacer: {
    width: 44, // profileContainer 너비 + marginRight
    marginTop: 4,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profileImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContent: {
    flex: 1,
    maxWidth: '85%', // 메시지 버블과 동일하게 조정
  },
  senderNickname: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
}); 
