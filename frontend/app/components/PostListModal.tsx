import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { PostMarker } from '../utils/clustering';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

interface PostListModalProps {
  visible: boolean;
  posts: PostMarker[];
  buildingName?: string;
  onClose: () => void;
  onPostPress: (post: PostMarker) => void;
}

const { width, height } = Dimensions.get('window');

export const PostListModal: React.FC<PostListModalProps> = ({
  visible,
  posts,
  buildingName,
  onClose,
  onPostPress,
}) => {
  if (!visible) return null;

  // posts가 유효하지 않은 경우 처리
  if (!posts || !Array.isArray(posts)) {
    console.log('PostListModal: posts가 유효하지 않음:', posts);
    return null;
  }

  const formatTimeAgo = (createdAt: string) => {
    try {
      if (!createdAt) return '시간 정보 없음';
      
      const now = new Date();
      const created = new Date(createdAt);
      
      // 유효한 날짜인지 확인
      if (isNaN(created.getTime())) {
        console.log('유효하지 않은 날짜:', createdAt);
        return '시간 정보 없음';
      }
      
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
    } catch (error) {
      console.error('formatTimeAgo 오류:', error, 'createdAt:', createdAt);
      return '시간 정보 없음';
    }
  };

  const getCategoryColor = (category: string) => {
    if (!category) return '#9E9E9E';
    
    switch (category) {
      case '일상':
        return '#4CAF50';
      case '사람':
        return '#2196F3';
      case '질문':
        return '#FF9800';
      case '행사':
        return '#E91E63';
      case '자유':
        return '#9C27B0';
      case '위치':
        return '#FF5722';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} />
      <View style={styles.modal}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>
              {buildingName || '알 수 없는 위치'} 근처 - 게시물
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 게시글 목록 */}
        <ScrollView style={styles.postList} showsVerticalScrollIndicator={false}>
          {posts && posts.length > 0 ? (
            posts.map((post, index) => {
              // 게시글 데이터 유효성 검사
              if (!post || !post.id || !post.title) {
                console.log(`게시글 ${index} 데이터가 유효하지 않음:`, post);
                return null;
              }
              
              return (
            <TouchableOpacity
              key={`${post.id}-${index}`}
              style={styles.postItem}
              onPress={() => {
                try {
                  onPostPress(post);
                  onClose(); // 모달 닫기
                } catch (error) {
                  console.error('PostListModal 클릭 처리 오류:', error);
                }
              }}
            >
              <View style={styles.postHeader}>
                <View style={styles.categoryContainer}>
                  <View 
                    style={[
                      styles.categoryBadge, 
                      { backgroundColor: getCategoryColor(post.category) }
                    ]}
                  >
                    <Text style={styles.categoryText}>{post.category || '기타'}</Text>
                  </View>
                </View>
                <Text style={styles.authorName}>{getDisplayNickname(post.author_nickname)}</Text>
              </View>
              
              <Text style={styles.postTitle} numberOfLines={2}>
                {post.title}
              </Text>
              
              <View style={styles.postFooter}>
                <Text style={styles.timeText}>{post.created_at ? formatTimeAgo(post.created_at) : '시간 정보 없음'}</Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>👁️</Text>
                    <Text style={styles.statText}>{post.view_count || 0}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>🤍</Text>
                    <Text style={styles.statText}>{post.heart_count || 0}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>💬</Text>
                    <Text style={styles.statText}>{post.comment_count || 0}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>게시글이 없습니다.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 1.5,
    minHeight: height * 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  postList: {
    paddingHorizontal: 20,
  },
  postItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  authorName: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  postTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 