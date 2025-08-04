import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { reportService, UserPenaltyData, PenaltyType } from '../services/reportService';
import { useAuth } from '../contexts/AuthContext';

interface SuspensionModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SuspensionModal({ visible, onClose }: SuspensionModalProps) {
  const { markPenaltyNotificationAsShown } = useAuth();
  const [penalties, setPenalties] = useState<UserPenaltyData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPenalties();
    }
  }, [visible]);

  const loadPenalties = async () => {
    try {
      setLoading(true);
      const data = await reportService.getUserActivePenalties();
      // 임시 정지와 영구 정지만 필터링
      const suspensionPenalties = data.filter(penalty => 
        penalty.penalty_type === PenaltyType.TEMPORARY_BAN || 
        penalty.penalty_type === PenaltyType.PERMANENT_BAN
      );
      setPenalties(suspensionPenalties);
    } catch (error) {
      console.error('정지 정보 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPenaltyIcon = (type: PenaltyType) => {
    switch (type) {
      case PenaltyType.TEMPORARY_BAN:
        return '⏰';
      case PenaltyType.PERMANENT_BAN:
        return '🚫';
      default:
        return '❌';
    }
  };

  const getPenaltyColor = (type: PenaltyType) => {
    switch (type) {
      case PenaltyType.TEMPORARY_BAN:
        return '#FF4444';
      case PenaltyType.PERMANENT_BAN:
        return '#CC0000';
      default:
        return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const calculateRemainingDays = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>계정 정지 알림</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2D3A4A" />
              <Text style={styles.loadingText}>정지 정보를 불러오는 중...</Text>
            </View>
          ) : penalties.length > 0 ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {penalties.map((penalty) => (
                <View key={penalty.id} style={styles.penaltyItem}>
                  <View style={styles.penaltyHeader}>
                    <Text style={styles.penaltyIcon}>{getPenaltyIcon(penalty.penalty_type)}</Text>
                    <View style={styles.penaltyInfo}>
                      <Text style={[styles.penaltyType, { color: getPenaltyColor(penalty.penalty_type) }]}>
                        {penalty.penalty_type}
                      </Text>
                      <Text style={styles.penaltyDate}>
                        {formatDate(penalty.start_date)} 부터
                      </Text>
                    </View>
                  </View>

                  <View style={styles.penaltyDetails}>
                    <Text style={styles.penaltyReason}>{penalty.reason}</Text>
                    
                    {penalty.penalty_type === PenaltyType.TEMPORARY_BAN && penalty.end_date && (
                      <View style={styles.temporaryBanInfo}>
                        <Text style={styles.remainingDays}>
                          남은 정지 기간: {calculateRemainingDays(penalty.end_date)}일
                        </Text>
                        <Text style={styles.endDate}>
                          해제 예정일: {formatDate(penalty.end_date)}
                        </Text>
                        <Text style={styles.restrictionText}>
                          ⚠️ 정지 기간 동안 게시글과 댓글 작성이 제한됩니다.
                        </Text>
                      </View>
                    )}

                    {penalty.penalty_type === PenaltyType.PERMANENT_BAN && (
                      <View style={styles.permanentBanInfo}>
                        <Text style={styles.permanentBanWarning}>
                          ⚠️ 영구 정지로 인해 계정이 제한되었습니다.
                        </Text>
                        <Text style={styles.restrictionText}>
                          • 게시글 작성 불가{'\n'}
                          • 댓글 작성 불가{'\n'}
                          • 계정 복구 불가
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>현재 정지 상태가 아닙니다.</Text>
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.confirmButton} 
              onPress={async () => {
                await markPenaltyNotificationAsShown();
                onClose();
              }}
            >
              <Text style={styles.confirmButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '95%',
    maxHeight: '90%',
    minHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  closeButton: {
    padding: 5,
  },
  closeIcon: {
    fontSize: 20,
    color: '#666666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 10,
    fontFamily: 'GmarketSans',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  penaltyItem: {
    marginBottom: 24,
    padding: 18,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  penaltyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  penaltyInfo: {
    flex: 1,
  },
  penaltyType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  penaltyDate: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  penaltyDetails: {
    gap: 8,
  },
  penaltyReason: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
    fontFamily: 'GmarketSans',
  },
  temporaryBanInfo: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
  },
  remainingDays: {
    fontSize: 14,
    color: '#856404',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  endDate: {
    fontSize: 12,
    color: '#856404',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  restrictionText: {
    fontSize: 12,
    color: '#856404',
    marginTop: 8,
    lineHeight: 16,
    fontFamily: 'GmarketSans',
  },
  permanentBanInfo: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  permanentBanWarning: {
    fontSize: 14,
    color: '#721C24',
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  confirmButton: {
    backgroundColor: '#2D3A4A',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 