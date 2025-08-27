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
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { reportService, ReportListData, ReportStats } from '../../services/reportService';

export default function ReportManagementScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportListData[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, statsData] = await Promise.all([
        reportService.getAllReports(0, 50),
        reportService.getReportStats()
      ]);
      console.log('로드된 신고 데이터:', reportsData);
      console.log('로드된 통계 데이터:', statsData);
      setReports(reportsData || []);
      setStats(statsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      // 에러가 발생해도 빈 데이터로 설정하여 UI가 깨지지 않도록 함
      setReports([]);
      setStats({
        total_reports: 0,
        pending_reports: 0,
        reviewed_reports: 0,
        resolved_reports: 0,
        reports_by_type: {},
        reports_by_status: {}
      });
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

  const filteredReports = reports.filter(report => {
    const matchesFilter = selectedFilter === 'all' || report.status === selectedFilter;
    const matchesSearch = report.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.reporter_nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (report.target_content && report.target_content.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>신고 목록을 불러오는 중...</Text>
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
        <Text style={styles.title}>신고 관리</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 통계 섹션 */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total_reports}</Text>
            <Text style={styles.statLabel}>전체</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#FF8800' }]}>{stats.pending_reports}</Text>
            <Text style={styles.statLabel}>대기중</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#007AFF' }]}>{stats.reviewed_reports}</Text>
            <Text style={styles.statLabel}>검토완료</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.resolved_reports}</Text>
            <Text style={styles.statLabel}>처리완료</Text>
          </View>
        </View>
      )}

      {/* 검색 및 필터 */}
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="신고 내용, 신고자, 대상으로 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999999"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>전체</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === '대기중' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('대기중')}
          >
            <Text style={[styles.filterText, selectedFilter === '대기중' && styles.filterTextActive]}>대기중</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === '검토완료' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('검토완료')}
          >
            <Text style={[styles.filterText, selectedFilter === '검토완료' && styles.filterTextActive]}>검토완료</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === '처리완료' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('처리완료')}
          >
            <Text style={[styles.filterText, selectedFilter === '처리완료' && styles.filterTextActive]}>처리완료</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 신고 목록 */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredReports.map((report) => (
          <TouchableOpacity
            key={report.id}
            style={styles.reportItem}
            onPress={() => router.push(`/pages/admin/report-detail?id=${report.id}` as any)}
          >
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
              <Text style={styles.reporterText}>신고자: {report.reporter_nickname}</Text>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(report.report_type) }]}>
                <Text style={styles.typeText}>{report.report_type}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        
        {filteredReports.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>신고가 없습니다.</Text>
          </View>
        )}
      </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    fontFamily: 'GmarketSans',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontFamily: 'GmarketSans',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
    fontFamily: 'GmarketSans',
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#000000',
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'GmarketSans',
  },
  filterTextActive: {
    color: '#FFFFFF',
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reporterText: {
    fontSize: 12,
    color: '#666666',
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