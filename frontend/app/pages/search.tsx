import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postService, PostListResponse } from '../services/postService';
import { getDisplayNickname } from '../utils/userUtils'; // 🆕 유틸리티 함수 import

interface RecentSearch {
  id: number;
  keyword: string;
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchText, setSearchText] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [searchResults, setSearchResults] = useState<PostListResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);

  // 앱 시작 시 저장된 데이터 불러오기
  useEffect(() => {
    loadSavedData();
  }, []);

  // URL 파라미터 처리
  useEffect(() => {
    // URL 파라미터에서 카테고리 정보 가져오기
    if (params.category) {
      setCategory(params.category as string);
    }
    
    // URL 파라미터에서 검색어 가져오기
    if (params.query) {
      const query = decodeURIComponent(params.query as string);
      setSearchText(query);
      // 검색어가 있으면 자동으로 검색 실행 (카테고리 설정 후)
      setTimeout(() => {
        performSearch(query, params.category as string);
      }, 100);
    }
  }, [params.category, params.query]);

  // 최근 검색어가 변경될 때마다 저장
  useEffect(() => {
    saveRecentSearches();
  }, [recentSearches]);

  // 검색어와 검색 결과가 변경될 때마다 저장
  useEffect(() => {
    saveSearchData();
  }, [searchText, searchResults]);

  const loadSavedData = async () => {
    try {
      // 최근 검색어 불러오기
      const savedSearches = await AsyncStorage.getItem('recentSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }

      // 검색어와 검색 결과 불러오기
      const savedSearchText = await AsyncStorage.getItem('searchText');
      const savedSearchResults = await AsyncStorage.getItem('searchResults');
      
      if (savedSearchText) {
        setSearchText(savedSearchText);
      }
      
      if (savedSearchResults) {
        setSearchResults(JSON.parse(savedSearchResults));
      }
    } catch (error) {
      console.error('저장된 데이터 불러오기 실패:', error);
    }
  };

  const saveRecentSearches = async () => {
    try {
      await AsyncStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    } catch (error) {
      console.error('최근 검색어 저장 실패:', error);
    }
  };

  const saveSearchData = async () => {
    try {
      await AsyncStorage.setItem('searchText', searchText);
      await AsyncStorage.setItem('searchResults', JSON.stringify(searchResults));
    } catch (error) {
      console.error('검색 데이터 저장 실패:', error);
    }
  };

  const performSearch = async (query: string, searchCategory?: string) => {
    if (query.trim()) {
      // 검색어를 최근 검색어에 추가
      const newSearch: RecentSearch = {
        id: Date.now(),
        keyword: query.trim(),
      };
      
      // 중복 검색어 제거하고 최신 검색어를 맨 앞에 추가
      const filteredSearches = recentSearches.filter(
        search => search.keyword !== newSearch.keyword
      );
      setRecentSearches([newSearch, ...filteredSearches.slice(0, 4)]); // 최대 5개 유지
      
      // 실제 검색 실행
      try {
        setIsSearching(true);
        const results = await postService.getPosts(0, 50, searchCategory || category, undefined, query.trim(), undefined, false);
        setSearchResults(results);
      } catch (error) {
        console.error('검색 오류:', error);
        Alert.alert('검색 실패', '검색 중 오류가 발생했습니다.');
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleSearch = async () => {
    await performSearch(searchText, category);
  };

  const removeRecentSearch = (id: number) => {
    setRecentSearches(recentSearches.filter(search => search.id !== id));
  };

  const selectRecentSearch = async (keyword: string) => {
    setSearchText(keyword);
    // 선택된 검색어로 검색 실행
    await performSearch(keyword, category);
  };

  const renderSearchResult = (post: PostListResponse) => (
    <TouchableOpacity 
      key={post.id} 
      style={styles.searchResultCard}
      onPress={() => router.push(`/pages/post-detail?id=${post.id}`)}
    >
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{getDisplayNickname(post.author_nickname)}</Text>
          <Text style={styles.postTime}>
            {new Date(post.created_at).toLocaleDateString('ko-KR')}
          </Text>
        </View>
      </View>
      
      <Text style={styles.postTitle} numberOfLines={2}>
        {post.title}
      </Text>
      
      <View style={styles.postFooter}>
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{post.view_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{post.comment_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={16} color="#6c757d" />
            <Text style={styles.statText}>{post.heart_count}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>검색하기</Text>
        <View style={styles.placeholderButton} />
      </View>

      {/* 검색 입력 필드 */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="검색어를 입력하세요."
            placeholderTextColor="#999999"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus={true}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchText('');
                setSearchResults([]);
                // 저장된 검색 데이터도 삭제
                AsyncStorage.removeItem('searchText');
                AsyncStorage.removeItem('searchResults');
              }}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 최근 검색어 섹션 */}
      {recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>최근검색어</Text>
          <View style={styles.recentTagsContainer}>
            {recentSearches.map((search) => (
              <TouchableOpacity
                key={search.id}
                style={styles.recentTag}
                onPress={() => selectRecentSearch(search.keyword)}
              >
                <Text style={styles.recentTagText}>{search.keyword}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeRecentSearch(search.id)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 검색 결과 영역 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2D3A4A" />
            <Text style={styles.loadingText}>검색 중...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            <Text style={styles.resultsTitle}>
              "{searchText}" 검색 결과 ({searchResults.length}개)
              {category && ` - ${category} 게시판`}
            </Text>
            {searchResults.map(renderSearchResult)}
          </View>
        ) : searchText.length > 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>
              "{searchText}"에 대한 검색 결과가 없습니다.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  placeholderButton: {
    width: 40,
  },
  searchContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  recentSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  recentTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  recentTagText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  removeButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 10,
    color: '#666666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  searchResults: {
    padding: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  searchResultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  postTime: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
    lineHeight: 22,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 4,
  },
}); 