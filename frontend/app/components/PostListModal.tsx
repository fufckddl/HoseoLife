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
          {posts.map((post, index) => (
            <TouchableOpacity
              key={`${post.id}-${index}`}
              style={styles.postItem}
              onPress={() => {
                console.log('=== PostListModal 게시글 클릭됨 ===');
                console.log('게시글 ID:', post.id);
                console.log('게시글 제목:', post.title);
                console.log('onPostPress 함수:', onPostPress);
                console.log('onClose 함수:', onClose);
                
                try {
                  onPostPress(post);
                  console.log('onPostPress 호출 완료');
                  onClose(); // 모달 닫기
                  console.log('onClose 호출 완료');
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
                    <Text style={styles.categoryText}>{post.category}</Text>
                  </View>
                </View>
                <Text style={styles.authorName}>{post.author_nickname}</Text>
              </View>
              
              <Text style={styles.postTitle} numberOfLines={2}>
                {post.title}
              </Text>
              
              <View style={styles.postFooter}>
                <Text style={styles.timeText}>{formatTimeAgo(post.created_at)}</Text>
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
          ))}
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
}); 