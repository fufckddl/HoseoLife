// 참여 가능한 그룹 목록 화면
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '../stores/groupStore';

export default function AvailableGroupsScreen() {
  const router = useRouter();
  const { 
    availableGroups, 
    loading, 
    error, 
    fetchAvailableGroups, 
    joinGroup,
    clearError 
  } = useGroupStore();

  useEffect(() => {
    loadAvailableGroups();
  }, []);

  const loadAvailableGroups = async () => {
    try {
      await fetchAvailableGroups();
    } catch (error) {
      Alert.alert('오류', '그룹 목록을 불러오는데 실패했습니다');
    }
  };

  const handleJoinGroup = (roomId: number, name: string) => {
    Alert.alert(
      '그룹 참여',
      `"${name}" 그룹에 참여하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '참여',
          style: 'default',
          onPress: async () => {
            try {
              await joinGroup(roomId);
              Alert.alert(
                '참여 완료', 
                '그룹에 참여되었습니다.',
                [
                  {
                    text: '확인',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              Alert.alert('오류', '그룹 참여에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const renderGroupItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => handleJoinGroup(item.roomId, item.name)}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription}>{item.description}</Text>
        )}
        <View style={styles.groupMeta}>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={16} color="#666666" />
            <Text style={styles.memberCountText}>{item.memberCount}명</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.joinButton}>
        <Ionicons name="add-circle-outline" size={24} color="#2D3A4A" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>참여 가능한 그룹</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 내용 */}
      <View style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2D3A4A" />
            <Text style={styles.loadingText}>로딩 중...</Text>
          </View>
        ) : availableGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>참여 가능한 그룹이 없습니다</Text>
            <Text style={styles.emptySubtext}>
              새로운 그룹을 생성하거나 나중에 다시 확인해보세요
            </Text>
          </View>
        ) : (
          <FlatList
            data={availableGroups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.roomId.toString()}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadAvailableGroups} />
            }
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>

      {/* 새 그룹 생성 버튼 */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/pages/group-create')}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.createButtonText}>새 그룹 생성</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flex: 1,
    fontFamily: 'GmarketSans',
  },
  errorDismiss: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  listContainer: {
    padding: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  groupDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCountText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  joinButton: {
    padding: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D3A4A',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 15,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
});
