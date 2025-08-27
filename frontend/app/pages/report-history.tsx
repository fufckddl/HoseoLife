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
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { reportService, ReportListData, UserPenaltyData } from '../services/reportService';

export default function ReportHistoryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'reports' | 'penalties'>('reports');
  const [reports, setReports] = useState<ReportListData[]>([]);
  const [penalties, setPenalties] = useState<UserPenaltyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'reports') {
        const reportsData = await reportService.getUserReports(0, 50);
        setReports(reportsData);
      } else {
        const penaltiesData = await reportService.getUserActivePenalties();
        setPenalties(penaltiesData);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  const getPenaltyColor = (type: string) => {
    switch (type) {
      case '경고': return '#FF8800';
      case '임시정지': return '#FF4444';
      case '영구정지': return '#CC0000';
      default: return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getTargetTypeText = (type: string) => {
    switch (type) {
      case 'post': return '게시글';
      case 'comment': return '댓글';
      case 'user': return '사용자';
      default: return type;
    }
  };

  const calculateRemainingDays = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
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
        <Text style={styles.title}>신고내역</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 탭 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reports' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            내가 신고한 내역 ({reports.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'penalties' && styles.tabButtonActive]}
          onPress={() => setActiveTab('penalties')}
        >
          <Text style={[styles.tabText, activeTab === 'penalties' && styles.tabTextActive]}>
            받은 제재({penalties.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'reports' ? (
          // 신고 내역
          <>
            {reports.map((report) => (
              <View key={report.id} style={styles.reportItem}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportMeta}>
                    <Text style={styles.reportType}>{getTargetTypeText(report.target_type)}</Text>
                    <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                </View>
                
                <View style={styles.reportContent}>
                  <Text style={styles.reportReason} numberOfLines={2}>
                    {report.reason}
                  </Text>
                  
                  {report.target_content && (
                    <Text style={styles.targetContent} numberOfLines={1}>
                      대상: {report.target_content}
                    </Text>
                  )}
                </View>
                
                <View style={styles.reportFooter}>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeColor(report.report_type) }]}>
                    <Text style={styles.typeText}>{report.report_type}</Text>
                  </View>
                </View>
              </View>
            ))}
            
            {reports.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>신고한 내역이 없습니다.</Text>
              </View>
            )}
          </>
        ) : (
          // 처벌 내역
          <>
            {penalties.map((penalty) => (
              <View key={penalty.id} style={styles.penaltyItem}>
                <View style={styles.penaltyHeader}>
                  <View style={styles.penaltyMeta}>
                    <Text style={styles.penaltyType}>{penalty.penalty_type}</Text>
                    <Text style={styles.penaltyDate}>{formatDate(penalty.start_date)}</Text>
                  </View>
                  <View style={[styles.penaltyBadge, { backgroundColor: getPenaltyColor(penalty.penalty_type) }]}>
                    <Text style={styles.penaltyBadgeText}>{penalty.is_active ? '활성' : '만료'}</Text>
                  </View>
                </View>
                
                <View style={styles.penaltyContent}>
                  <Text style={styles.penaltyReason} numberOfLines={2}>
                    {penalty.reason}
                  </Text>
                  
                  {penalty.penalty_type === '임시정지' && penalty.end_date && (
                    <View style={styles.temporaryBanInfo}>
                      <Text style={styles.remainingDays}>
                        남은 정지 기간: {calculateRemainingDays(penalty.end_date)}일
                      </Text>
                      <Text style={styles.endDate}>
                        해제 예정일: {formatDate(penalty.end_date)}
                      </Text>
                    </View>
                  )}
                  {penalty.penalty_type === '영구정지' && (
                    <Text style={styles.permanentBanWarning}>
                      ⚠️ 영구 정지로 인해 계정이 제한되었습니다.
                    </Text>
                  )}
                </View>
              </View>
            ))}
            
            {penalties.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>받은 제재 내역이 없습니다.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  tabButtonActive: {
    backgroundColor: '#000000',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  reportItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportType: {
    fontSize: 12,
    color: '#666666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontFamily: 'GmarketSans',
  },
  reportDate: {
    fontSize: 12,
    color: '#999999',
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
  reportContent: {
    marginBottom: 8,
  },
  reportReason: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: 'GmarketSans',
  },
  targetContent: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    fontFamily: 'GmarketSans',
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  penaltyItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
  },
  penaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  penaltyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  penaltyType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  penaltyDate: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
  penaltyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  penaltyBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'GmarketSans',
  },
  penaltyContent: {
    gap: 8,
  },
  penaltyReason: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
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
  permanentBanWarning: {
    fontSize: 14,
    color: '#721C24',
    fontWeight: 'bold',
    marginTop: 8,
    fontFamily: 'GmarketSans',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    fontFamily: 'GmarketSans',
  },
}); 