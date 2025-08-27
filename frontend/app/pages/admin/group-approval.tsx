// 관리자용 그룹 승인 화면
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
import { useGroupStore } from '../../stores/groupStore';

export default function AdminGroupApprovalScreen() {
  const router = useRouter();
  const { 
    pendingRequests, 
    loading, 
    error, 
    fetchPendingRequests, 
    approveGroupRequest, 
    rejectGroupRequest,
    clearError 
  } = useGroupStore();

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      await fetchPendingRequests();
    } catch (error) {
      Alert.alert('오류', '요청 목록을 불러오는데 실패했습니다');
    }
  };

  const handleApprove = (id: number, name: string) => {
    Alert.alert(
      '그룹 승인',
      `"${name}" 그룹을 승인하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '승인',
          style: 'default',
          onPress: async () => {
            try {
              await approveGroupRequest(id);
              Alert.alert('승인 완료', '그룹이 승인되었습니다');
            } catch (error) {
              Alert.alert('오류', '그룹 승인에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const handleReject = (id: number, name: string) => {
    Alert.alert(
      '그룹 거부',
      `"${name}" 그룹을 거부하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거부',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectGroupRequest(id);
              Alert.alert('거부 완료', '그룹이 거부되었습니다');
            } catch (error) {
              Alert.alert('오류', '그룹 거부에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: any }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.requestDescription}>{item.description}</Text>
        )}
        <Text style={styles.requestMeta}>
          요청자 ID: {item.requesterId} | {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.id, item.name)}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>승인</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id, item.name)}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>거부</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>그룹 승인 관리</Text>
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
        ) : pendingRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>대기 중인 그룹 요청이 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderRequestItem}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadPendingRequests} />
            }
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
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
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'GmarketSans',
  },
  listContainer: {
    padding: 20,
  },
  requestItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  requestDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  requestMeta: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 5,
  },
  approveButton: {
    backgroundColor: '#28A745',
  },
  rejectButton: {
    backgroundColor: '#DC3545',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
});
