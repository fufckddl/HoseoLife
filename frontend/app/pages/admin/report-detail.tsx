import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { reportService, ReportData, ReportReviewData, PenaltyType } from '../../services/reportService';

export default function ReportDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const reportId = Number(id);
  
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [selectedPenalty, setSelectedPenalty] = useState<PenaltyType | null>(null);
  const [penaltyReason, setPenaltyReason] = useState('');
  const [durationDays, setDurationDays] = useState('');

  useEffect(() => {
    if (reportId) {
      loadReportDetail();
    }
  }, [reportId]);

  const loadReportDetail = async () => {
    try {
      setLoading(true);
      const reportData = await reportService.getReportDetail(reportId);
      setReport(reportData);
      if (reportData.admin_response) {
        setAdminResponse(reportData.admin_response);
      }
    } catch (error) {
      console.error('신고 상세 조회 실패:', error);
      Alert.alert('오류', '신고 상세 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setSubmitting(true);
      
      const reviewData: ReportReviewData = {
        status: newStatus as any,
        admin_response: adminResponse.trim() || undefined
      };

      await reportService.reviewReport(reportId, reviewData);
      
      Alert.alert('성공', '상태가 변경되었습니다.');
      loadReportDetail(); // 데이터 새로고침
    } catch (error) {
      console.error('상태 변경 실패:', error);
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePenaltySubmit = async () => {
    if (!selectedPenalty) {
      Alert.alert('알림', '처벌 유형을 선택해주세요.');
      return;
    }

    if (!penaltyReason.trim()) {
      Alert.alert('알림', '처벌 사유를 입력해주세요.');
      return;
    }

    if (selectedPenalty === PenaltyType.TEMPORARY_BAN && !durationDays.trim()) {
      Alert.alert('알림', '임시 정지 기간을 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      
      const reviewData: ReportReviewData = {
        status: '처리완료' as any,
        admin_response: adminResponse.trim() || undefined,
        penalty_type: selectedPenalty,
        penalty_reason: penaltyReason.trim(),
        duration_days: selectedPenalty === PenaltyType.TEMPORARY_BAN ? Number(durationDays) : undefined
      };

      await reportService.reviewReport(reportId, reviewData);
      
      Alert.alert('성공', '처벌이 적용되었습니다.');
      setShowPenaltyModal(false);
      loadReportDetail(); // 데이터 새로고침
    } catch (error) {
      console.error('처벌 적용 실패:', error);
      Alert.alert('오류', '처벌 적용에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '대기중': return '#FF8800';
      case '검토완료': return '#007AFF';
      case '처리완료': return '#4CAF50';
      default: return '#666666';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '스팸/광고': return '#FF4444';
      case '욕설/폭력': return '#FF8800';
      case '음란물': return '#E91E63';
      case '불법행위': return '#9C27B0';
      case '개인정보': return '#2196F3';
      case '저작권 침해': return '#FF9800';
      case '허위정보': return '#795548';
      case '기타': return '#607D8B';
      default: return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getTargetTypeText = (type: string) => {
    switch (type) {
      case 'post': return '게시글';
      case 'comment': return '댓글';
      case 'user': return '사용자';
      default: return type;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>신고 상세 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>신고 정보를 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.title}>신고 상세</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 신고 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신고 정보</Text>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>신고 유형:</Text>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(report.report_type) }]}>
                <Text style={styles.typeText}>{report.report_type}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>신고 대상:</Text>
              <Text style={styles.infoValue}>{getTargetTypeText(report.target_type)} (ID: {report.target_id})</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>신고자:</Text>
              <Text style={styles.infoValue}>{report.reporter_nickname}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>신고 일시:</Text>
              <Text style={styles.infoValue}>{formatDate(report.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>현재 상태:</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                <Text style={styles.statusText}>{report.status}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 신고 사유 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신고 사유</Text>
          <View style={styles.reasonContainer}>
            <Text style={styles.reasonText}>{report.reason}</Text>
          </View>
        </View>

        {/* 관리자 답변 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>관리자 답변</Text>
          <TextInput
            style={[
              styles.responseInput,
              report.status !== '대기중' && styles.responseInputDisabled
            ]}
            placeholder="신고자에게 전달할 답변을 입력하세요..."
            value={adminResponse}
            onChangeText={setAdminResponse}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999999"
            editable={report.status === '대기중'}
          />
        </View>

        {/* 처리 버튼들 */}
        {report.status === '대기중' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>처리 옵션</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  styles.reviewButton,
                  !adminResponse.trim() && styles.actionButtonDisabled
                ]}
                onPress={() => handleStatusChange('검토완료')}
                disabled={submitting || !adminResponse.trim()}
              >
                <Text style={[
                  styles.actionButtonText,
                  !adminResponse.trim() && styles.actionButtonTextDisabled
                ]}>검토완료</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton, 
                  styles.penaltyButton,
                  !adminResponse.trim() && styles.actionButtonDisabled
                ]}
                onPress={() => setShowPenaltyModal(true)}
                disabled={submitting || !adminResponse.trim()}
              >
                <Text style={[
                  styles.actionButtonText,
                  !adminResponse.trim() && styles.actionButtonTextDisabled
                ]}>처벌 적용</Text>
              </TouchableOpacity>
            </View>
            {!adminResponse.trim() && (
              <Text style={styles.warningText}>관리자 답변을 입력해주세요.</Text>
            )}
          </View>
        )}

        {/* 기존 관리자 답변 표시 */}
        {report.admin_response && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기존 관리자 답변</Text>
            <View style={styles.existingResponseContainer}>
              <Text style={styles.existingResponseText}>{report.admin_response}</Text>
              {report.admin_nickname && (
                <Text style={styles.adminName}>- {report.admin_nickname}</Text>
              )}
              {report.reviewed_at && (
                <Text style={styles.reviewDate}>{formatDate(report.reviewed_at)}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 처벌 모달 */}
      <Modal
        visible={showPenaltyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPenaltyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>처벌 적용</Text>
              <TouchableOpacity onPress={() => setShowPenaltyModal(false)}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* 처벌 유형 선택 */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>처벌 유형</Text>
                <View style={styles.penaltyTypeContainer}>
                  {Object.values(PenaltyType).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.penaltyTypeButton,
                        selectedPenalty === type && styles.penaltyTypeButtonSelected
                      ]}
                      onPress={() => setSelectedPenalty(type)}
                    >
                      <Text style={[
                        styles.penaltyTypeText,
                        selectedPenalty === type && styles.penaltyTypeTextSelected
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 임시 정지 기간 */}
              {selectedPenalty === PenaltyType.TEMPORARY_BAN && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>정지 기간 (일)</Text>
                  <TextInput
                    style={styles.durationInput}
                    placeholder="예: 7"
                    value={durationDays}
                    onChangeText={setDurationDays}
                    keyboardType="numeric"
                    placeholderTextColor="#999999"
                  />
                </View>
              )}

              {/* 처벌 사유 */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>처벌 사유</Text>
                <TextInput
                  style={styles.penaltyReasonInput}
                  placeholder="처벌 사유를 입력하세요..."
                  value={penaltyReason}
                  onChangeText={setPenaltyReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor="#999999"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPenaltyModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
                onPress={handlePenaltySubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>처벌 적용</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 16,
    color: '#666666',
    marginTop: 10,
    fontFamily: 'GmarketSans',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'GmarketSans',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
    fontFamily: 'GmarketSans',
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  infoValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    fontFamily: 'GmarketSans',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  reasonContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'GmarketSans',
  },
  responseInputDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#999999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButton: {
    backgroundColor: '#007AFF',
  },
  penaltyButton: {
    backgroundColor: '#FF4444',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  actionButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  actionButtonTextDisabled: {
    color: '#999999',
  },
  warningText: {
    fontSize: 12,
    color: '#FF4444',
    marginTop: 8,
    fontFamily: 'GmarketSans',
  },
  existingResponseContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
  },
  existingResponseText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  adminName: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    fontFamily: 'GmarketSans',
  },
  reviewDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    maxHeight: '90%',
    minHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },

  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 14,
    fontFamily: 'GmarketSans',
  },
  penaltyTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  penaltyTypeButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  penaltyTypeButtonSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  penaltyTypeText: {
    fontSize: 15,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  penaltyTypeTextSelected: {
    color: '#FFFFFF',
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'GmarketSans',
  },
  penaltyReasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: 'GmarketSans',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF4444',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#999999',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 