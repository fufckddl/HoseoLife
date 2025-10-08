import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { postService, PostResponse, Comment, ScrapResponse, ScrapStatus } from '../services/postService';
import { userService } from '../services/userService';
import { Ionicons } from '@expo/vector-icons';
import { chatService } from '../services/chatService';
import { useAuth } from '../contexts/AuthContext';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import ReportModal from '../components/ReportModal';
import { getDisplayNickname, isDeactivatedUser } from '../utils/userUtils'; // 🆕 유틸리티 함수 import
import AsyncStorage from '@react-native-async-storage/async-storage';
import { blockService } from '../services/blockService'; // 🆕 차단 서비스 import

interface PostDetail extends PostResponse {
  comments?: Comment[];
}

export default function PostDetailScreen() {
  console.log('=== PostDetailScreen 컴포넌트 렌더링 시작 ===');
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSuspended } = useAuth();
  const postId = params.id as string;
  const commentId = params.comment_id as string; // 대댓글 ID 파라미터
  
  console.log('PostDetailScreen - postId:', postId);
  console.log('PostDetailScreen - params:', params);
  console.log('PostDetailScreen - router:', router);
  const [post, setPost] = React.useState<PostDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [submittingComment, setSubmittingComment] = React.useState(false);
  const [isHearted, setIsHearted] = React.useState(false);
  const [heartCount, setHeartCount] = React.useState(0);
  const [togglingHeart, setTogglingHeart] = React.useState(false);
  const [isScrapped, setIsScrapped] = React.useState(false);
  const [scrapCount, setScrapCount] = React.useState(0);
  const [togglingScrap, setTogglingScrap] = React.useState(false);
  const [fullScreenImageVisible, setFullScreenImageVisible] = React.useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportTarget, setReportTarget] = React.useState<{ type: 'post' | 'comment', id: number, content?: string } | null>(null);
  const [showPostMenu, setShowPostMenu] = React.useState(false);
  const [showCommentMenu, setShowCommentMenu] = React.useState<number | null>(null);
  
  // 대댓글 관련 상태 추가
  const [replyingTo, setReplyingTo] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const [submittingReply, setSubmittingReply] = React.useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // 대댓글 ID가 있을 때 해당 댓글로 스크롤
  React.useEffect(() => {
    if (commentId && comments.length > 0) {
      console.log('🔗 대댓글 ID로 스크롤:', commentId);
      
      // 해당 댓글이 있는지 확인
      const targetCommentIndex = comments.findIndex(comment => 
        comment.id.toString() === commentId || 
        (comment as any).replies?.some((reply: any) => reply.id.toString() === commentId)
      );
      
      if (targetCommentIndex !== -1) {
        console.log('✅ 대상 댓글 찾음, 인덱스:', targetCommentIndex);
        
        // 잠시 후 스크롤 (렌더링 완료 후)
        setTimeout(() => {
          // 대략적인 스크롤 위치 계산 (댓글 높이 * 인덱스)
          const estimatedScrollY = targetCommentIndex * 200; // 댓글당 대략 200px
          scrollViewRef.current?.scrollTo({ y: estimatedScrollY, animated: true });
          
          // 하이라이트 효과를 위한 상태 업데이트
          setHighlightedCommentId(parseInt(commentId));
          setTimeout(() => {
            setHighlightedCommentId(null);
          }, 2000);
        }, 1000);
      }
    }
  }, [commentId, comments]);

  const [highlightedCommentId, setHighlightedCommentId] = React.useState<number | null>(null);

  React.useEffect(() => {
    console.log('=== PostDetailScreen useEffect 실행 ===');
    console.log('postId 값:', postId);
    
    if (postId) {
      console.log('postId가 있음, getCurrentUser 호출');
      getCurrentUser();
    } else {
      console.log('postId가 없음');
    }
  }, [postId]);

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== PostDetailScreen useFocusEffect 실행 ===');
      console.log('postId 값:', postId);
      
      if (postId) {
        console.log('postId가 있음, 데이터 가져오기 시작');
        fetchPostDetail(true); // 새로고침 시에도 로딩 인디케이터 표시
        fetchComments();
        fetchHeartStatus();
        fetchScrapStatus();
      } else {
        console.log('postId가 없음, 데이터 가져오기 건너뜀');
      }
    }, [postId])
  );

  const getCurrentUser = async () => {
    try {
      const user = await userService.getCurrentUserInfo();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('현재 사용자 정보 가져오기 실패:', error);
    }
  };

  const fetchPostDetail = async (showLoading = true) => {
    console.log('=== fetchPostDetail 시작 ===');
    console.log('postId:', postId);
    console.log('showLoading:', showLoading);
    
    try {
      if (showLoading) {
        console.log('로딩 상태 설정');
        setLoading(true);
      }
      
      // 공지사항인지 확인 (notice- prefix로 시작하는지 체크)
      if (postId.startsWith('notice-')) {
        console.log('공지사항 데이터 처리');
        const noticeDataStr = params.noticeData as string;
        if (noticeDataStr) {
          const noticeData = JSON.parse(noticeDataStr);
          console.log('공지사항 데이터:', noticeData);
          setPost(noticeData);
          setHeartCount(noticeData.heart_count || 0);
          console.log('공지사항 상태 업데이트 완료');
        } else {
          throw new Error('공지사항 데이터가 없습니다.');
        }
      } else {
        console.log('일반 게시글 데이터 처리');
        console.log('postService.getPost 호출 시작');
        const postData = await postService.getPost(parseInt(postId));
        console.log('postService.getPost 응답:', postData);
        
        setPost(postData);
        setHeartCount(postData.heart_count);
        console.log('상태 업데이트 완료');
      }
    } catch (error) {
      console.error('게시글 상세 조회 실패:', error);
      if (showLoading) {
        Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
      }
    } finally {
      // showLoading이 false여도 로딩 상태를 해제해야 함
      console.log('로딩 상태 해제 (showLoading:', showLoading, ')');
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      // 공지사항인 경우 댓글 조회 건너뛰기
      if (postId.startsWith('notice-')) {
        console.log('공지사항은 댓글 조회 건너뜀');
        setComments([]);
        return;
      }
      
      const response = await postService.getComments(parseInt(postId));
      setComments(response);
    } catch (error) {
      console.error('댓글 조회 실패:', error);
    }
  };

  // 댓글을 부모-자식 구조로 정리하는 함수 추가
  const organizeCommentsWithReplies = (comments: Comment[]) => {
    const commentMap = new Map<number, Comment & { replies: Comment[] }>();
    const rootComments: (Comment & { replies: Comment[] })[] = [];

    // 모든 댓글을 맵에 저장하고 replies 배열 초기화
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // 댓글들을 부모-자식 관계로 정리
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parent_id) {
        // 대댓글인 경우 부모 댓글의 replies에 추가
        const parentComment = commentMap.get(comment.parent_id);
        if (parentComment) {
          parentComment.replies.push(commentWithReplies);
        }
      } else {
        // 최상위 댓글인 경우 rootComments에 추가
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  const fetchHeartStatus = async () => {
    try {
      // 공지사항인 경우 하트 상태 조회 건너뛰기
      if (postId.startsWith('notice-')) {
        console.log('공지사항은 하트 상태 조회 건너뜀');
        setIsHearted(false);
        return;
      }
      
      const heartStatus = await postService.getHeartStatus(parseInt(postId));
      setIsHearted(heartStatus.is_hearted);
      setHeartCount(heartStatus.heart_count);
    } catch (error) {
      console.error('하트 상태 조회 실패:', error);
    }
  };

  const fetchScrapStatus = async () => {
    try {
      // 공지사항인 경우 스크랩 상태 조회 건너뛰기
      if (postId.startsWith('notice-')) {
        console.log('공지사항은 스크랩 상태 조회 건너뜀');
        setIsScrapped(false);
        setScrapCount(0);
        return;
      }
      
      const scrapStatus = await postService.getScrapStatus(parseInt(postId));
      setIsScrapped(scrapStatus.is_scrapped);
      setScrapCount(scrapStatus.scrap_count);
    } catch (error) {
      console.error('스크랩 상태 조회 실패:', error);
    }
  };

  const handleHeartToggle = async () => {
    if (togglingHeart) return;
    
    try {
      setTogglingHeart(true);
      console.log('하트 토글 시작, postId:', postId);
      const response = await postService.toggleHeart(parseInt(postId));
      console.log('하트 토글 응답:', response);
      
      // 로컬 상태 즉시 업데이트
      setIsHearted(response.is_hearted);
      setHeartCount(response.heart_count);
      
      // 게시글 정보도 업데이트 (하트 수 반영)
      if (post) {
        setPost({
          ...post,
          heart_count: response.heart_count
        });
      }
      
      console.log('하트 토글 완료, 새로운 상태:', {
        isHearted: response.is_hearted,
        heartCount: response.heart_count
      });
      
      // 하트 토글 후 약간의 지연을 두어 서버에 반영될 시간을 줌
      setTimeout(() => {
        console.log('하트 토글 후 지연 완료, 데이터 동기화 준비됨');
      }, 800);
      
    } catch (error) {
      console.error('하트 토글 실패:', error);
      Alert.alert('오류', '하트 토글에 실패했습니다.');
    } finally {
      setTogglingHeart(false);
    }
  };

  const handleScrapToggle = async () => {
    if (togglingScrap) return;
    
    try {
      setTogglingScrap(true);
      console.log('스크랩 토글 시작, postId:', postId);
      const response = await postService.toggleScrap(parseInt(postId));
      console.log('스크랩 토글 응답:', response);
      
      // 로컬 상태 즉시 업데이트
      setIsScrapped(response.is_scrapped);
      setScrapCount(response.scrap_count);
      
      console.log('스크랩 토글 완료, 새로운 상태:', {
        isScrapped: response.is_scrapped,
        scrapCount: response.scrap_count
      });
      
    } catch (error) {
      console.error('스크랩 토글 실패:', error);
      Alert.alert('오류', '스크랩 토글에 실패했습니다.');
    } finally {
      setTogglingScrap(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('알림', '댓글 내용을 입력해주세요.');
      return;
    }

    try {
      setSubmittingComment(true);
      await postService.createComment(parseInt(postId), newComment.trim());
      setNewComment('');
      // 댓글 목록 새로고침
      await fetchComments();
      // 게시글 정보 새로고침 (댓글 수 업데이트)
      await fetchPostDetail();
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      Alert.alert('오류', '댓글 작성에 실패했습니다.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // 대댓글 작성 함수 추가
  const handleSubmitReply = async (parentCommentId: number) => {
    if (!replyText.trim()) {
      Alert.alert('알림', '대댓글 내용을 입력해주세요.');
      return;
    }

    try {
      setSubmittingReply(true);
      await postService.createComment(parseInt(postId), replyText.trim(), parentCommentId);
      setReplyText('');
      setReplyingTo(null);
      // 댓글 목록 새로고침
      await fetchComments();
      // 게시글 정보 새로고침 (댓글 수 업데이트)
      await fetchPostDetail();
    } catch (error) {
      console.error('대댓글 작성 실패:', error);
      Alert.alert('오류', '대댓글 작성에 실패했습니다.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert(
      '댓글 삭제',
      '정말로 이 댓글을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await postService.deleteComment(commentId);
              // 댓글 목록 새로고침
              await fetchComments();
              // 게시글 정보 새로고침 (댓글 수 업데이트)
              await fetchPostDetail();
            } catch (error) {
              console.error('댓글 삭제 실패:', error);
              Alert.alert('오류', '댓글 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleImagePress = (index: number) => {
    console.log('이미지 클릭됨, 인덱스:', index);
    console.log('이미지 URL:', imageUrls[index]);
    console.log('전체 이미지 URLs:', imageUrls);
    setSelectedImageIndex(index);
    setFullScreenImageVisible(true);
  };

  const handleAuthorChat = async (authorId: number, authorNickname: string) => {
    if (authorId === currentUserId) {
      return; // 자신과는 채팅할 수 없음
    }

    Alert.alert(
      '1:1 채팅 시작',
      `${authorNickname}님과 1:1 채팅하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: async () => {
            try {
              // 1:1 채팅방 찾기 또는 생성
              const chatRoom = await chatService.findOrCreateDirectChat(authorId);
              
              // 채팅방으로 이동 (새로운 Room 모델)
              router.push(`/pages/chat-room?id=${chatRoom.id}&type=dm`);
            } catch (error: any) {
              console.error('채팅방 생성 실패:', error);
              
              // 🆕 차단 에러 메시지 처리
              const errorMessage = error?.response?.data?.detail || error?.message || '채팅방을 생성하는데 실패했습니다.';
              
              if (errorMessage.includes('차단')) {
                Alert.alert('채팅 불가', errorMessage);
              } else {
                Alert.alert('오류', errorMessage);
              }
            }
          },
        },
      ]
    );
  };

  const handleCloseFullScreenImage = () => {
    console.log('전체화면 이미지 닫기');
    setFullScreenImageVisible(false);
  };

  const handleReportPost = (postId: string) => {
    setReportTarget({
      type: 'post',
      id: parseInt(postId),
      content: post?.title || post?.content
    });
    setShowReportModal(true);
  };

  // 🆕 사용자 차단
  const handleBlockUser = async (authorId: number) => {
    if (!post) return;
    
    Alert.alert(
      '사용자 차단',
      `${post.author_nickname || '알 수 없음'}님을 차단하시겠습니까?\n\n차단하면:\n• 해당 사용자의 게시글이 보이지 않습니다.\n• 해당 사용자와 채팅을 할 수 없습니다.\n• 차단은 언제든지 프로필 설정에서 해제할 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(authorId);
              Alert.alert(
                '차단 완료',
                '사용자를 차단했습니다. 프로필 설정에서 차단 목록을 확인할 수 있습니다.',
                [{ text: '확인', onPress: () => router.back() }]
              );
            } catch (error) {
              console.error('사용자 차단 실패:', error);
              Alert.alert('오류', '사용자 차단에 실패했습니다.');
            }
          }
        }
      ]
    );
  };



  const handleReportComment = (commentId: number) => {
    const comment = comments.find(c => c.id === commentId);
    setReportTarget({
      type: 'comment',
      id: commentId,
      content: comment?.content
    });
    setShowReportModal(true);
  };

  const formatTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    
    // 한국 시간대로 변환 (UTC+9)
    const kstOffset = 9 * 60; // 9시간을 분으로
    const nowKST = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const createdKST = new Date(created.getTime() + (kstOffset * 60 * 1000));
    
    const diffInMinutes = Math.floor((nowKST.getTime() - createdKST.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return '방금전';
    if (diffInMinutes < 60) return `${diffInMinutes}분전`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}시간전`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}일전`;
  };

  const getCategoryColor = (category: string) => {
    return '#000000';
  };

  const handleDeletePost = async () => {
    Alert.alert(
      '게시글 삭제',
      '정말로 이 게시글을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('게시글 삭제 시작:', postId);
              await postService.deletePost(parseInt(postId));
              console.log('게시글 삭제 성공');
              
              Alert.alert('성공', '게시글이 삭제되었습니다.', [
                {
                  text: '확인',
                  onPress: () => {
                    console.log('Home 화면으로 돌아가기');
                    // Home 화면으로 직접 이동
                    router.push('/tabs/home');
                  },
                },
              ]);
            } catch (error) {
              console.error('게시글 삭제 실패:', error);
              Alert.alert('오류', '게시글 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  const sharePost = async () => {
    try {
      console.log('🔗 게시글 공유 시작 - Post ID:', postId);
      
      // 백엔드에서 공유 링크 생성
      const response = await fetch(`https://hoseolife.kro.kr/posts/${postId}/share-link`, {
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
        message: `호서라이프 게시글을 공유합니다!\n\n📱 앱이 설치되어 있다면 자동으로 앱에서 열립니다!\n🌐 앱이 없다면 웹에서 확인할 수 있습니다.\n\n${shareLink}`,
        url: shareLink,
        title: '호서라이프 게시글 공유',
      });

      if (result.action === Share.sharedAction) {
        console.log('✅ 공유 완료');
      }
    } catch (error) {
      console.error('❌ 게시글 공유 실패:', error);
      Alert.alert('오류', '게시글 공유에 실패했습니다.');
    }
  };

  // 댓글 렌더링 함수 추가
  const renderComment = (comment: Comment & { replies: Comment[] }, isReply: boolean = false) => {
    const isHighlighted = highlightedCommentId === comment.id;
    
    return (
      <View 
        key={comment.id} 
        style={[
          styles.commentItem, 
          isReply && styles.replyComment,
          isHighlighted && styles.highlightedComment
        ]}
      >
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthorContainer}>
              {!isDeactivatedUser(comment.author_nickname) ? (
              comment.author_profile_image_url ? (
                <Image 
                  source={{ 
                    uri: comment.author_profile_image_url,
                    cache: 'reload'
                  }} 
                  style={styles.commentAuthorImage} 
                />
              ) : (
                <Ionicons 
                  name="person-circle-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.commentAuthorImage} 
                />
              )
            ) : null}
            <TouchableOpacity 
              onPress={() => {
                if (!isDeactivatedUser(comment.author_nickname)) {
                  handleAuthorChat(comment.author_id, comment.author_nickname!);
                }
              }}
              disabled={comment.author_id === currentUserId || isDeactivatedUser(comment.author_nickname)}
            >
              <Text style={[
                styles.commentAuthor,
                (comment.author_id === currentUserId || isDeactivatedUser(comment.author_nickname)) && styles.commentAuthorDisabled
              ]}>
                {getDisplayNickname(comment.author_nickname)}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.commentRightSection}>
            <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
            
            {/* 대댓글 버튼 추가 (대댓글에는 대댓글 버튼 숨김) */}
            {!isReply && (
              <Pressable 
                style={({ pressed }) => [
                  styles.replyButton,
                  pressed && { opacity: 1 } // 터치 시에도 투명도 변화 없음
                ]} 
                onPress={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#666" />
              </Pressable>
            )}
            
            {/* 메뉴 버튼 (배경색 제거) */}
            <Pressable 
              style={({ pressed }) => [
                styles.commentMenuButton,
                pressed && { opacity: 1 } // 터치 시에도 투명도 변화 없음
              ]} 
              onPress={() => setShowCommentMenu(showCommentMenu === comment.id ? null : comment.id)}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#000000" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.commentContent}>{comment.content}</Text>
        
        {/* 대댓글 입력 영역 */}
        {replyingTo === comment.id && (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder="대댓글을 입력하세요..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
              placeholderTextColor="#999"
            />
            <View style={styles.replyInputActions}>
              <TouchableOpacity 
                style={styles.replyCancelButton}
                onPress={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
              >
                <Text style={styles.replyCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.replySubmitButton,
                  (!replyText.trim() || submittingReply) && styles.replySubmitButtonDisabled
                ]}
                onPress={() => handleSubmitReply(comment.id)}
                disabled={!replyText.trim() || submittingReply}
              >
                {submittingReply ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.replySubmitText}>등록</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* 댓글 메뉴 드롭다운 */}
        {showCommentMenu === comment.id && (
          <View style={styles.commentMenuOverlay}>
            <TouchableOpacity 
              style={styles.commentMenuBackdrop} 
              onPress={() => setShowCommentMenu(null)}
              activeOpacity={1}
            />
            <View style={styles.commentMenuContainer}>
              {currentUserId === comment.author_id ? (
                // 댓글 작성자인 경우: 삭제 | 신고
                <>
                  <TouchableOpacity 
                    style={styles.commentMenuItem} 
                    onPress={() => {
                      setShowCommentMenu(null);
                      handleDeleteComment(comment.id);
                    }}
                  >
                    <Text style={styles.commentMenuItemText}>삭제</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.commentMenuItem} 
                    onPress={() => {
                      setShowCommentMenu(null);
                      handleReportComment(comment.id);
                    }}
                  >
                    <Text style={styles.commentMenuItemText}>신고</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // 댓글 작성자가 아닌 경우: 신고
                <TouchableOpacity 
                  style={styles.commentMenuItem} 
                  onPress={() => {
                    setShowCommentMenu(null);
                    handleReportComment(comment.id);
                  }}
                >
                  <Text style={styles.commentMenuItemText}>신고</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        
        {/* 대댓글들 렌더링 */}
        {comment.replies && comment.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map((reply) => renderComment({ ...reply, replies: [] }, true))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* 뒤로가기 버튼 */}
        <View style={styles.loadingHeader}>
          <TouchableOpacity style={styles.loadingBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        {/* 뒤로가기 버튼 */}
        <View style={styles.loadingHeader}>
          <TouchableOpacity style={styles.loadingBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>게시글을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrls: string[] = Array.isArray(post.image_urls) ? post.image_urls : [];
  console.log('Post Detail - imageUrls:', imageUrls);
  console.log('Post Detail - post.image_urls:', post.image_urls);

  // 뉴스/공지 카테고리인지 확인
  const isNewsOrNotice = post.category === '뉴스' || post.category === '공지';
  
  // 게시판 공지사항인지 확인
  const isBoardNotice = postId.startsWith('notice-') || (post as any).is_notice;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          console.log('뒤로가기 버튼 클릭, 이전 화면으로 이동');
          router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        {/* 게시판 이름 표시 */}
        <View style={styles.headerCenter}>
          <Text style={styles.boardNameText}>
            {post.category || '게시판'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={() => setShowPostMenu(!showPostMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : Platform.OS === 'android' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
        >
          {/* 작성자 태그 */}
          <View style={styles.tagContainer}>
            <View style={styles.tagLeftSection}>
              {/* 🆕 작성자 프로필 이미지 */}
              {!isDeactivatedUser(post.author_nickname) && (
                post.author_profile_image_url ? (
                  <Image 
                    source={{ 
                      uri: post.author_profile_image_url,
                      cache: 'reload'
                    }} 
                    style={styles.authorProfileImageClean} 
                  />
                ) : (
                  <Ionicons 
                    name="person-circle-outline" 
                    size={35} 
                    color="#666" 
                    style={styles.authorProfileImageClean} 
                  />
                )
              )}
              
              {/* 🆕 작성자 닉네임 (회색 원형) */}
              <TouchableOpacity 
                style={styles.authorTag}
                onPress={() => {
                  if (!isDeactivatedUser(post.author_nickname)) {
                    handleAuthorChat(post.author_id, post.author_nickname!);
                  }
                }}
                disabled={post.author_id === currentUserId || isDeactivatedUser(post.author_nickname)}
              >
                <Text style={[
                  styles.authorText,
                  (post.author_id === currentUserId || isDeactivatedUser(post.author_nickname)) && styles.authorTextDisabled
                ]}>
                  {getDisplayNickname(post.author_nickname)}
                </Text>
              </TouchableOpacity>
            </View>
            {/* 위치가 아닌 카테고리의 경우 시간을 우측에 표시 */}
            {post.category !== '위치' && (
              <Text style={styles.timeText}>
                {formatTimeAgo(post.created_at)}
              </Text>
            )}
          </View>

          {/* 게시글 제목 */}
          <Text style={styles.title}>{post.title}</Text>

          {/* 게시글 내용 */}
          <Text style={styles.contentText}>{post.content}</Text>

          {/* 이미지 */}
          {imageUrls.length > 0 && (
            <View style={styles.imageContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageScrollContainer}
              >
                {imageUrls.map((url: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleImagePress(index)}
                    activeOpacity={0.8}
                    style={styles.imageTouchable}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 참여도 지표 - 공지사항이 아닌 경우만 표시 */}
          {!isBoardNotice && (
          <View style={styles.engagementContainer}>
            <TouchableOpacity 
              onPress={handleHeartToggle} 
              style={[styles.engagementItem, togglingHeart && styles.engagementItemDisabled]}
              disabled={togglingHeart}
            >
              <Ionicons 
                name={isHearted ? "heart" : "heart-outline"} 
                size={20} 
                color={isHearted ? "#FF3B30" : "#333"} 
              />
              <Text style={[styles.engagementText, isHearted && styles.heartTextActive]}>
                {heartCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleScrapToggle} 
              style={[styles.engagementItem, togglingScrap && styles.engagementItemDisabled]}
              disabled={togglingScrap}
            >
              <Ionicons 
                name={isScrapped ? "bookmark" : "bookmark-outline"} 
                size={20} 
                color={isScrapped ? "#FF9800" : "#333"} 
              />
              <Text style={[styles.engagementText, isScrapped && styles.scrapTextActive]}>
                {scrapCount}
              </Text>
            </TouchableOpacity>
            <View style={styles.engagementItem}>
              <Ionicons name="chatbubble-outline" size={20} color="#333" />
              <Text style={styles.engagementText}>{post.comment_count}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Ionicons name="eye-outline" size={20} color="#333" />
              <Text style={styles.engagementText}>{post.view_count}</Text>
            </View>
          </View>
          )}

          {/* 댓글 섹션 - 공지사항이 아닌 경우만 표시 */}
          {!isBoardNotice && (
          <View style={styles.commentSection}>
            <Text style={styles.commentSectionTitle}>댓글 ({comments.length})</Text>
            
            {/* 댓글 목록 */}
            {comments.length > 0 ? (
              organizeCommentsWithReplies(comments).map((comment) => renderComment(comment))
            ) : (
              <View style={styles.noCommentContainer}>
                <Text style={styles.noCommentText}>아직 댓글이 없습니다.</Text>
                <Text style={styles.noCommentSubText}>첫 번째 댓글을 남겨보세요!</Text>
              </View>
            )}
          </View>
          )}
        </ScrollView>

        {/* 댓글 입력 영역 - 공지사항이 아닌 경우만 표시 */}
        {!isBoardNotice && (
        <View style={[styles.commentInputContainer, Platform.OS === 'android' && styles.androidCommentInputContainer]}>
          {isSuspended && (
            <View style={styles.suspensionWarning}>
              <Text style={styles.suspensionWarningText}>
                ⚠️ 계정이 정지되어 댓글 작성이 제한됩니다.
              </Text>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={[styles.commentInput, isSuspended && styles.inputDisabled]}
              placeholder={isSuspended ? "계정이 정지되어 작성할 수 없습니다." : "댓글을 입력하세요..."}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
              placeholderTextColor="#999"
              editable={!isSuspended}
            />
          
            <TouchableOpacity
              style={[
                styles.commentSubmitButton,
                (!newComment.trim() || submittingComment || isSuspended) && styles.commentSubmitButtonDisabled
              ]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || submittingComment || isSuspended}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.commentSubmitText}>
                  {isSuspended ? '작성 제한됨' : '등록'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>

      {/* 전체화면 이미지 뷰어 */}
      <FullScreenImageViewer
        visible={fullScreenImageVisible}
        images={imageUrls}
        initialIndex={selectedImageIndex}
        onClose={handleCloseFullScreenImage}
      />

      {/* 게시글 메뉴 드롭다운 */}
      {showPostMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop} 
            onPress={() => setShowPostMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setShowPostMenu(false);
                sharePost();
              }}
            >
              <Text style={styles.menuItemText}>공유</Text>
            </TouchableOpacity>
            {currentUserId === post.author_id ? (
              // 작성자인 경우: 삭제 | 수정 | 신고
              <>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setShowPostMenu(false);
                    router.push(`/pages/edit-post?id=${postId}`);
                  }}
                >
                  <Text style={styles.menuItemText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setShowPostMenu(false);
                    handleDeletePost();
                  }}
                >
                  <Text style={styles.menuItemText}>삭제</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setShowPostMenu(false);
                    handleReportPost(postId);
                  }}
                >
                  <Text style={styles.menuItemText}>신고</Text>
                </TouchableOpacity>
              </>
            ) : (
              // 작성자가 아닌 경우: 신고 & 차단
              <>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setShowPostMenu(false);
                    handleBlockUser(post.author_id);
                  }}
                >
                  <Text style={styles.menuItemText}>사용자 차단</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    setShowPostMenu(false);
                    handleReportPost(postId);
                  }}
                >
                  <Text style={styles.menuItemText}>신고</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* 신고 모달 */}
      {reportTarget && (
        <ReportModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportTarget(null);
          }}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetContent={reportTarget.content}
        />
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardNameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
  },

  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginLeft: 8,
  },

  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tagContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagLeftSection: {
    flexDirection: 'row',
    gap: 8,
  },
  authorProfileImageClean: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    resizeMode: 'cover',
  },
  authorTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    minHeight: 36,
    justifyContent: 'center',
  },
  authorInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    resizeMode: 'cover',
  },
  authorText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  authorTextDisabled: {
    color: '#999',
    opacity: 0.7,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 28,
  },
  contentText: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 24,
  },
  imageContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageScrollContainer: {
    paddingHorizontal: 8,
    gap: 8,
  },
  postImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  engagementContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 24,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  engagementText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  commentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  commentSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  commentItem: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightedComment: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFE69C',
    borderWidth: 2,
    shadowColor: '#FFA500',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  replyComment: {
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EAED',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentAuthorImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    resizeMode: 'cover',
  },
  commentRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  commentAuthorDisabled: {
    color: '#999',
  },
  commentTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'GmarketSans',
  },
  commentContent: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '400',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  commentActionText: {
    fontSize: 12,
    color: '#666',
  },
  likedText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  replyInputContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  replyInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 14,
    color: '#333',
    minHeight: 36,
    maxHeight: 80,
    textAlignVertical: 'top',
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  replyCancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
  },
  replyCancelText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  replySubmitButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  replySubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  replySubmitText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 0,
    paddingLeft: 0,
  },
  noCommentContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCommentText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  noCommentSubText: {
    fontSize: 14,
    color: '#999',
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 12, // Android에서 하단 여백 추가
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  commentInput: {
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
  },
  commentSubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    marginLeft: 8,
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  commentSubmitText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  suspensionWarning: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  suspensionWarningText: {
    fontSize: 12,
    color: '#721C24',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999999',
  },
  keyboardAvoidingView: {
    flex: 1,
    paddingBottom: Platform.OS === 'android' ? 0 : 0, // Android에서 추가 패딩 제거
  },
  engagementItemDisabled: {
    opacity: 0.7,
  },

  heartTextActive: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  imageTouchable: {
    marginHorizontal: 4,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  loadingBackButton: {
    marginRight: 12,
  },


  scrapTextActive: {
    color: '#FF9800',
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  commentMenuButton: {
    padding: 6,
    borderRadius: 6,
  },
  
  // 대댓글 버튼 스타일 추가
  replyButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: 6,
  },
  commentMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent', // 투명 배경으로 설정
  },
  commentMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent', // 배경색 제거
  },
  commentMenuContainer: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 100,
  },
  commentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  commentMenuItemText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  // Android 전용 댓글 입력창 스타일
  androidCommentInputContainer: {
    paddingBottom: 32, // Android에서 더 많은 하단 여백
    marginBottom: Platform.OS === 'android' ? 8 : 0, // Android에서 추가 마진
  },
}); 