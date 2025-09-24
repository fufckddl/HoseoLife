import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDisplayNickname } from '../../utils/userUtils'; // 🆕 유틸리티 함수 import

export default function PostWebFallback() {
  const { postId, shareCode } = useLocalSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [postInfo, setPostInfo] = useState<{
    id: number;
    title: string;
    content: string;
    category: string;
    building_name?: string;
    author_nickname: string;
    author_profile_image_url?: string;
    image_urls?: string[];
    view_count: number;
    heart_count: number;
    comment_count: number;
    created_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 게시글 정보 가져오기
    const fetchPostInfo = async () => {
      try {
        if (!postId || !shareCode || typeof postId !== 'string' || typeof shareCode !== 'string') {
          setError('유효하지 않은 공유 링크입니다');
          setLoading(false);
          return;
        }

        const response = await fetch(`https://hoseolife.kro.kr/posts/${postId}/share/${shareCode}`, {
          headers: {
            'Accept': 'application/json; charset=utf-8',
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.detail || '게시글 정보를 가져올 수 없습니다');
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        // 한글 깨짐 처리 - 깨진 문자 패턴 감지
        const isCorrupted = (text: string) => {
          if (!text) return false;
          // 깨진 한글 패턴 감지 (특수문자나 이상한 문자 포함)
          return /[^\u0000-\u007F\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\s]/.test(text) || 
                 text.includes('') || 
                 text.includes('') ||
                 text.length < 2;
        };
        
        if (isCorrupted(data.title)) {
          data.title = '게시글 제목';
        }
        if (isCorrupted(data.content)) {
          data.content = '게시글 내용을 확인하려면 앱에서 보세요.';
        }
        if (isCorrupted(data.category)) {
          data.category = '일반';
        }
        if (isCorrupted(data.building_name)) {
          data.building_name = '호서대학교';
        }
        
        setPostInfo(data);
      } catch (error) {
        console.error('게시글 정보 조회 실패:', error);
        setError('게시글 정보를 가져올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchPostInfo();

    // 카운트다운 타이머
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 5초 후 네이버로 이동
          Linking.openURL('https://naver.com');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [postId, shareCode]);

  const handleAppStoreRedirect = () => {
    // 앱스토어 링크 (현재는 네이버로 대체)
    Linking.openURL('https://naver.com');
  };

  const handleRetryApp = async () => {
    try {
      // 앱이 설치되어 있는지 확인
      const canOpenApp = await Linking.canOpenURL('camsaw://');
      
      if (canOpenApp) {
        // 앱으로 이동
        const appUrl = `camsaw://posts/share/${postId}/${shareCode}`;
        Linking.openURL(appUrl);
      } else {
        // 앱이 설치되어 있지 않음 - 네이버로 이동
        Linking.openURL('https://naver.com');
      }
    } catch (error) {
      console.error('앱 확인 실패:', error);
      // 오류 발생 시 네이버로 이동
      Linking.openURL('https://naver.com');
    }
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
    const colors: { [key: string]: string } = {
      '자유': '#FF6B6B',
      '정보': '#4ECDC4',
      '홍보': '#45B7D1',
      '이벤트': '#96CEB4',
      '동아리': '#FFEAA7',
      '비밀': '#DDA0DD',
      '신입생': '#98D8C8',
      '위치': '#F7DC6F',
      '뉴스': '#BB8FCE',
      '공지': '#85C1E9',
    };
    return colors[category] || '#000000';
  };

  // 웹에서 UTF-8 메타 태그 추가
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const meta = document.createElement('meta');
      meta.setAttribute('charset', 'UTF-8');
      document.head.appendChild(meta);
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="document-text" size={80} color="#007AFF" />
          </View>
          <Text style={styles.title}>호서라이프</Text>
          <Text style={styles.subtitle}>게시글 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" size={80} color="#FF6B6B" />
          </View>
          <Text style={styles.title}>오류 발생</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAppStoreRedirect}>
            <Ionicons name="storefront" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>앱 설치하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="document-text" size={80} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>호서라이프</Text>
        <Text style={styles.subtitle}>게시글이 공유되었습니다</Text>
        
        {/* 게시글 정보 표시 */}
        {postInfo && (
          <View style={styles.postInfoContainer}>
            {/* 카테고리 및 작성자 */}
            <View style={styles.tagContainer}>
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(postInfo.category) }]}>
                <Text style={styles.categoryText}>{postInfo.category}</Text>
              </View>
              <View style={styles.authorTag}>
                <Text style={styles.authorText}>{getDisplayNickname(postInfo.author_nickname)}</Text>
              </View>
            </View>

            {/* 게시글 제목 */}
            <Text style={styles.postTitle}>{postInfo.title}</Text>

            {/* 게시글 내용 */}
            <Text style={styles.postContent} numberOfLines={3}>
              {postInfo.content}
            </Text>

            {/* 위치 정보 */}
            {postInfo.building_name && (
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.locationText}>{postInfo.building_name}</Text>
              </View>
            )}

            {/* 이미지 미리보기 */}
            {postInfo.image_urls && postInfo.image_urls.length > 0 && (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: postInfo.image_urls[0] }} 
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                {postInfo.image_urls.length > 1 && (
                  <View style={styles.imageCountBadge}>
                    <Text style={styles.imageCountText}>+{postInfo.image_urls.length - 1}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 참여도 지표 */}
            <View style={styles.engagementContainer}>
              <View style={styles.engagementItem}>
                <Ionicons name="heart-outline" size={16} color="#FF3B30" />
                <Text style={styles.engagementText}>{postInfo.heart_count}</Text>
              </View>
              <View style={styles.engagementItem}>
                <Ionicons name="chatbubble-outline" size={16} color="#333" />
                <Text style={styles.engagementText}>{postInfo.comment_count}</Text>
              </View>
              <View style={styles.engagementItem}>
                <Ionicons name="eye-outline" size={16} color="#333" />
                <Text style={styles.engagementText}>{postInfo.view_count}</Text>
              </View>
              <Text style={styles.timeText}>{formatTimeAgo(postInfo.created_at)}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRetryApp}>
            <Ionicons name="phone-portrait" size={20} color="white" />
            <Text style={styles.primaryButtonText}>앱에서 보기</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={handleAppStoreRedirect}>
            <Ionicons name="storefront" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>앱 설치하기</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.countdownText}>
          {countdown}초 후 네이버로 이동합니다
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  postInfoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
  postContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  engagementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  countdownText: {
    marginTop: 32,
    fontSize: 14,
    color: '#999',
  },
});
