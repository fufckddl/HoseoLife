import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { reportService, ReportType, ReportCreateData } from '../services/reportService';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: number;
  targetContent?: string; // 신고 대상 내용 미리보기
}

export default function ReportModal({ 
  visible, 
  onClose, 
  targetType, 
  targetId, 
  targetContent 
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reportTypes = [
    ReportType.SPAM,
    ReportType.HARASSMENT,
    ReportType.SEXUAL,
    ReportType.ILLEGAL,
    ReportType.PERSONAL_INFO,
    ReportType.COPYRIGHT,
    ReportType.MISLEADING,
    ReportType.OTHER
  ];

  const getTargetTypeText = () => {
    switch (targetType) {
      case 'post': return '게시글';
      case 'comment': return '댓글';
      case 'user': return '사용자';
      default: return '내용';
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('알림', '신고 사유를 선택해주세요.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('알림', '상세 사유를 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      
      // 중복 신고 확인
      try {
        const duplicateCheck = await reportService.checkDuplicate(targetType, targetId);
        if (duplicateCheck.is_duplicate) {
          const targetTypeText = getTargetTypeText();
          Alert.alert('알림', `이미 신고한 ${targetTypeText}입니다.`);
          setSubmitting(false);
          return;
        }
      } catch (error) {
        console.error('중복 신고 확인 실패:', error);
        // 중복 확인 실패 시에도 신고는 진행
      }
      
      const reportData: ReportCreateData = {
        target_type: targetType,
        target_id: targetId,
        report_type: selectedType,
        reason: reason.trim()
      };

      await reportService.createReport(reportData);
      
      Alert.alert(
        '신고 완료',
        '신고가 성공적으로 접수되었습니다. 검토 후 처리됩니다.',
        [{ text: '확인', onPress: () => {
          setSelectedType(null);
          setReason('');
          setSubmitting(false);
          onClose();
        }}]
      );
    } catch (error: any) {
      console.error('신고 제출 실패:', error);
      
      // 이미 신고한 대상인 경우 구체적인 메시지 표시
      if (error.response?.data?.detail === '이미 신고한 대상입니다.') {
        const targetTypeText = getTargetTypeText();
        Alert.alert('알림', `이미 신고한 ${targetTypeText}입니다.`);
      } else if (error.response?.data?.detail) {
        // 백엔드에서 제공하는 구체적인 에러 메시지 표시
        Alert.alert('오류', `신고 제출 실패: ${error.response.data.detail}`);
      } else {
        Alert.alert('오류', '신고 제출에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setReason('');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>{getTargetTypeText()} 신고</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 신고 대상 미리보기 */}
            {targetContent && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>신고 대상:</Text>
                <Text style={styles.previewContent} numberOfLines={3}>
                  {targetContent}
                </Text>
              </View>
            )}

            {/* 신고 사유 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>신고 사유를 선택해주세요</Text>
              <View style={styles.typeContainer}>
                {reportTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      selectedType === type && styles.typeButtonSelected
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      selectedType === type && styles.typeButtonTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 상세 사유 입력 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>상세 사유를 입력해주세요</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="신고 사유를 자세히 설명해주세요..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999999"
              />
            </View>

            {/* 안내 문구 */}
            <View style={styles.noticeContainer}>
              <Text style={styles.noticeText}>
                • 허위 신고는 신고자에게 불이익을 줄 수 있습니다.{'\n'}
                • 신고 내용은 관리자 검토 후 처리됩니다.{'\n'}
                • 개인정보 보호를 위해 신고자 정보는 비공개됩니다.
              </Text>
            </View>
          </ScrollView>

          {/* 하단 버튼 */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>신고 제출</Text>
              )}
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
  modalContainer: {
    width: '95%',
    maxHeight: '70%',
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
  closeButtonText: {
    fontSize: 20,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  previewContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'GmarketSans',
  },
  previewContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'GmarketSans',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 14,
    fontFamily: 'GmarketSans',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeButtonSelected: {
    backgroundColor: '#2D3A4A',
    borderColor: '#2D3A4A',
  },
  typeButtonText: {
    fontSize: 15,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  typeButtonTextSelected: {
    color: '#FFFFFF',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 150,
    textAlignVertical: 'top',
    fontFamily: 'GmarketSans',
  },
  noticeContainer: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  noticeText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
    fontFamily: 'GmarketSans',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2D3A4A',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#999999',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
}); 