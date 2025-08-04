import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { postService, PostResponse, Comment } from '../services/postService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import ReportModal from '../components/ReportModal';

interface PostDetail extends PostResponse {
  comments?: Comment[];
}

export default function PostDetailScreen() {
  console.log('=== PostDetailScreen 컴포넌트 렌더링 시작 ===');
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isSuspended } = useAuth();
  const postId = params.id as string;
  
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
  const [fullScreenImageVisible, setFullScreenImageVisible] = React.useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportTarget, setReportTarget] = React.useState<{ type: 'post' | 'comment', id: number, content?: string } | null>(null);

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
      
      console.log('postService.getPost 호출 시작');
      const postData = await postService.getPost(parseInt(postId));
      console.log('postService.getPost 응답:', postData);
      
      setPost(postData);
      setHeartCount(postData.heart_count);
      console.log('상태 업데이트 완료');
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
      const response = await postService.getComments(parseInt(postId));
      setComments(response);
    } catch (error) {
      console.error('댓글 조회 실패:', error);
    }
  };

  const fetchHeartStatus = async () => {
    try {
      const heartStatus = await postService.getHeartStatus(parseInt(postId));
      setIsHearted(heartStatus.is_hearted);
      setHeartCount(heartStatus.heart_count);
    } catch (error) {
      console.error('하트 상태 조회 실패:', error);
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
    switch (category) {
      case '일상':
        return '#4CAF50';
      case '사람':
        return '#2196F3';
      case '질문':
        return '#FF9800';
      case '행사':
        return '#E91E63';
      default:
        return '#9E9E9E';
    }
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* 뒤로가기 버튼 */}
        <View style={styles.loadingHeader}>
          <TouchableOpacity style={styles.loadingBackButton} onPress={() => router.back()}>
            <Text style={styles.loadingBackIcon}>←</Text>
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
            <Text style={styles.loadingBackIcon}>←</Text>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          console.log('뒤로가기 버튼 클릭, 이전 화면으로 이동');
          router.back();
        }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        {/* 뉴스/공지가 아닌 경우에만 위치 정보 표시 */}
        {!isNewsOrNotice && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>
            {post.building_name} 근처 - {formatTimeAgo(post.created_at)}
          </Text>
        </View>
        )}
        {/* 뉴스/공지의 경우 시간만 표시 */}
        {isNewsOrNotice && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>
              {formatTimeAgo(post.created_at)}
            </Text>
          </View>
        )}
        <View style={styles.actionButtons}>
          {currentUserId === post.author_id ? (
            // 작성자인 경우: 삭제 | 수정 | 신고
            <>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={handleDeletePost}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editButton} 
                onPress={() => {
                  router.push(`/pages/edit-post?id=${postId}`);
                }}
              >
                <Text style={styles.editButtonText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reportButton} 
                onPress={() => handleReportPost(postId)}
              >
                <Text style={styles.reportButtonText}>신고</Text>
              </TouchableOpacity>
            </>
          ) : (
            // 작성자가 아닌 경우: 신고
            <TouchableOpacity 
              style={styles.reportButton} 
              onPress={() => handleReportPost(postId)}
            >
              <Text style={styles.reportButtonText}>신고</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 카테고리 및 작성자 태그 */}
          <View style={styles.tagContainer}>
            <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(post.category) }]}>
              <Text style={styles.categoryText}>{post.category}</Text>
            </View>
            <TouchableOpacity 
              style={styles.authorTag}
              onPress={() => {
                // 자신의 게시글이 아닌 경우에만 1:1 채팅으로 이동
                if (post.author_id !== currentUserId) {
                  router.push({
                    pathname: '/pages/direct-chat',
                    params: {
                      otherUserId: post.author_id.toString(),
                      otherUserNickname: post.author_nickname,
                      otherUserProfileImage: post.author_profile_image_url || ''
                    }
                  });
                }
              }}
              disabled={post.author_id === currentUserId}
            >
              <Text style={[
                styles.authorText,
                post.author_id === currentUserId && styles.authorTextDisabled
              ]}>
                {post.author_nickname}
              </Text>
            </TouchableOpacity>
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

          {/* 참여도 지표 */}
          <View style={styles.engagementContainer}>
            <TouchableOpacity 
              onPress={handleHeartToggle} 
              style={[styles.engagementItem, togglingHeart && styles.engagementItemDisabled]}
              disabled={togglingHeart}
            >
              <Text style={[styles.engagementIcon, isHearted && styles.heartIconActive]}>
                {isHearted ? '🖤' : '🤍'}
              </Text>
              <Text style={[styles.engagementText, isHearted && styles.heartTextActive]}>
                {heartCount}
              </Text>
            </TouchableOpacity>
            <View style={styles.engagementItem}>
              <Text style={styles.engagementIcon}>💬</Text>
              <Text style={styles.engagementText}>{post.comment_count}</Text>
            </View>
            <View style={styles.engagementItem}>
              <Text style={styles.engagementIcon}>👁️</Text>
              <Text style={styles.engagementText}>{post.view_count}</Text>
            </View>
          </View>

          {/* 댓글 섹션 */}
          <View style={styles.commentSection}>
            <Text style={styles.commentSectionTitle}>댓글 ({comments.length})</Text>
            
            {/* 댓글 목록 */}
            {comments.length > 0 ? (
              comments.map((comment) => {
                console.log('댓글 렌더링:', {
                  id: comment.id,
                  author: comment.author_nickname,
                  profileImage: comment.author_profile_image_url
                });
                
                return (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAuthorContainer}>
                      {comment.author_profile_image_url ? (
                        <Image 
                          source={{ 
                            uri: comment.author_profile_image_url,
                            cache: 'reload'
                          }} 
                          style={styles.commentAuthorImage} 
                        />
                      ) : (
                        <Image 
                          source={require('../../assets/images/camsaw_human.png')} 
                          style={styles.commentAuthorImage} 
                        />
                      )}
                      <Text style={styles.commentAuthor}>{comment.author_nickname}</Text>
                    </View>
                    <View style={styles.commentRightSection}>
                      <Text style={styles.commentTime}>{formatTimeAgo(comment.created_at)}</Text>
                      {currentUserId === comment.author_id ? (
                        // 댓글 작성자인 경우: 삭제 | 신고
                        <>
                          <TouchableOpacity 
                            style={styles.commentDeleteButton}
                            onPress={() => handleDeleteComment(comment.id)}
                          >
                            <Text style={styles.commentDeleteText}>삭제</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.commentReportButton}
                            onPress={() => handleReportComment(comment.id)}
                          >
                            <Text style={styles.commentReportText}>신고</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        // 댓글 작성자가 아닌 경우: 신고
                        <TouchableOpacity 
                          style={styles.commentReportButton}
                          onPress={() => handleReportComment(comment.id)}
                        >
                          <Text style={styles.commentReportText}>신고</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                </View>
              );
            })
            ) : (
              <View style={styles.noCommentContainer}>
                <Text style={styles.noCommentText}>아직 댓글이 없습니다.</Text>
                <Text style={styles.noCommentSubText}>첫 번째 댓글을 남겨보세요!</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* 댓글 입력 영역 */}
        <View style={styles.commentInputContainer}>
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
      </KeyboardAvoidingView>

      {/* 전체화면 이미지 뷰어 */}
      <FullScreenImageViewer
        visible={fullScreenImageVisible}
        images={imageUrls}
        initialIndex={selectedImageIndex}
        onClose={handleCloseFullScreenImage}
      />

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
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  editButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF9500',
    borderRadius: 16,
  },
  reportButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
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
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  authorTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  authorText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
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
  engagementIcon: {
    fontSize: 16,
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
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentAuthorImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    resizeMode: 'cover',
  },
  commentRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  commentContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  commentDeleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
  },
  commentDeleteText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  commentReportButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FF9500',
    borderRadius: 8,
  },
  commentReportText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
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
  },
  engagementItemDisabled: {
    opacity: 0.7,
  },
  heartIconActive: {
    fontSize: 18,
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
  loadingBackIcon: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
  },
}); 