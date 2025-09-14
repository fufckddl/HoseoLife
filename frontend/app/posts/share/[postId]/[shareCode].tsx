import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PostSharePage() {
  const { postId, shareCode } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 웹에서 접근하는 경우 웹 페이지로 리다이렉트
    if (Platform.OS === 'web') {
      router.replace(`/posts/share/web-fallback?postId=${postId}&shareCode=${shareCode}`);
      return;
    }
    
    handlePostShare();
  }, [postId, shareCode]);

  const handlePostShare = async () => {
    try {
      console.log('🔗 게시글 공유 링크 처리 시작 - Post ID:', postId, 'Share Code:', shareCode);
      
      if (!postId || !shareCode || typeof postId !== 'string' || typeof shareCode !== 'string') {
        throw new Error('유효하지 않은 공유 링크입니다.');
      }

      // 액세스 토큰 확인
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        console.log('❌ 액세스 토큰이 없습니다. 로그인 페이지로 이동');
        router.replace('/auth/login');
        return;
      }

      // 백엔드 API로 게시글 정보 가져오기
      const response = await fetch(`https://hoseolife.kro.kr/posts/${postId}/share/${shareCode}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '게시글을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      console.log('✅ 게시글 정보 가져오기 성공:', data);

      // 게시글 상세 페이지로 이동
      router.replace(`/pages/post-detail?id=${postId}`);
      
    } catch (error) {
      console.error('❌ 게시글 공유 링크 처리 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      
      // 오류 발생 시 3초 후 메인 페이지로 이동
      setTimeout(() => {
        router.replace('/');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryApp = async () => {
    try {
      // 앱 설치 여부 확인
      const canOpen = await Linking.canOpenURL('camsaw://');
      
      if (canOpen) {
        // 커스텀 스키마로 앱 열기 시도
        await Linking.openURL(`camsaw://posts/share/${postId}/${shareCode}`);
      } else {
        // 앱이 설치되지 않은 경우 네이버로 이동
        await Linking.openURL('https://naver.com');
      }
    } catch (error) {
      console.error('앱 열기 실패:', error);
      // 실패 시 네이버로 이동
      await Linking.openURL('https://naver.com');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>게시글 불러오는 중...</Text>
        <Text style={styles.subtitle}>잠시만 기다려주세요.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>오류 발생</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.subtitle}>메인 페이지로 이동합니다...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>게시글 불러오기 완료!</Text>
      <Text style={styles.subtitle}>게시글 상세 페이지로 이동합니다...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 10,
  },
});
