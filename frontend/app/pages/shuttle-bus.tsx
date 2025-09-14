import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shuttleBusService, ShuttleBus } from '../services/shuttleBusService';

export default function ShuttleBusScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'shuttle' | 'city'>('shuttle');
  const [expandedBus, setExpandedBus] = useState<number | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // 상태 관리
  const [shuttleBuses, setShuttleBuses] = useState<ShuttleBus[]>([]);
  const [cityBuses, setCityBuses] = useState<ShuttleBus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드 함수
  const loadBuses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [shuttleData, cityData] = await Promise.all([
        shuttleBusService.getShuttleBuses(0, 100, 'shuttle', true),
        shuttleBusService.getShuttleBuses(0, 100, 'city', true),
      ]);

      setShuttleBuses(shuttleData.items);
      setCityBuses(cityData.items);
    } catch (err) {
      console.error('버스 데이터 로드 실패:', err);
      setError('버스 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadBuses();
  }, []);

  const currentBuses = activeTab === 'shuttle' ? shuttleBuses : cityBuses;

  const renderBusItem = (bus: ShuttleBus) => {
    const isExpanded = expandedBus === bus.id;
    
    return (
      <View key={bus.id} style={styles.busCard}>
        <TouchableOpacity
          style={styles.busHeader}
          onPress={() => setExpandedBus(isExpanded ? null : bus.id)}
          activeOpacity={0.7}
        >
          
          <View style={styles.busHeaderContent}>
            <View style={styles.busInfo}>
              <Text style={styles.busName}>{bus.name}</Text>
              {/* <Text style={styles.busRoute}>{bus.route}</Text> */}
              {/* <Text style={styles.busTime}>{bus.time}</Text> */}
              {bus.description && (
                <Text style={styles.busDescription}>{bus.description}</Text>
              )}
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#666"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* 경유 정류소 */}
            {bus.stops && bus.stops.length > 0 && (
              <View style={styles.stopsContainer}>
                <Text style={styles.stopsHeader}>경유 정류소</Text>
                <View style={styles.stopsList}>
                  {bus.stops.map((stop, index) => (
                    <View key={index} style={styles.stopItem}>
                      <View style={styles.stopNumber}>
                        <Text style={styles.stopNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.stopName}>{stop}</Text>
                      {index < bus.stops!.length - 1 && (
                        <View style={styles.arrowContainer}>
                          <Ionicons name="arrow-down" size={12} color="#666" />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 상세 시간표 */}
            {(bus.schedule || bus.saturday_schedule || bus.sunday_schedule) && (
              <View style={styles.scheduleContainer}>
                <Text style={styles.scheduleHeader}>상세 시간표</Text>
                
                {/* 평일 시간표 */}
                {bus.schedule && (
                  <View style={styles.scheduleSection}>
                    <TouchableOpacity
                      style={styles.scheduleSectionHeader}
                      onPress={() => setExpandedSchedule(expandedSchedule === `${bus.id}-weekday` ? null : `${bus.id}-weekday`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.scheduleSectionTitle}>평일 (월~금)</Text>
                      <Ionicons
                        name={expandedSchedule === `${bus.id}-weekday` ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {expandedSchedule === `${bus.id}-weekday` && (
                      <View style={styles.scheduleScrollView}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.scheduleTable}>
                              {/* 헤더 */}
                              <View style={styles.scheduleRow}>
                                {bus.stops?.map((stop, index) => (
                                  <Text key={index} style={[styles.scheduleCell, styles.scheduleHeaderCell, { width: 80 }]}>
                                    {stop}
                                  </Text>
                                ))}
                              </View>
                              {/* 데이터 */}
                              {bus.schedule.map((row, index) => (
                                <View key={index} style={styles.scheduleRow}>
                                  {bus.stops?.map((stop, stopIndex) => (
                                    <Text key={stopIndex} style={[styles.scheduleCell, { width: 80 }]}>
                                      {row[stop] || '-'}
                                    </Text>
                                  ))}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* 토요일 시간표 */}
                {bus.saturday_schedule && (
                  <View style={styles.scheduleSection}>
                    <TouchableOpacity
                      style={styles.scheduleSectionHeader}
                      onPress={() => setExpandedSchedule(expandedSchedule === `${bus.id}-saturday` ? null : `${bus.id}-saturday`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.scheduleSectionTitle}>토요일</Text>
                      <Ionicons
                        name={expandedSchedule === `${bus.id}-saturday` ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {expandedSchedule === `${bus.id}-saturday` && (
                      <View style={styles.scheduleScrollView}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.scheduleTable}>
                              {/* 헤더 */}
                              <View style={styles.scheduleRow}>
                                {bus.stops?.map((stop, index) => (
                                  <Text key={index} style={[styles.scheduleCell, styles.scheduleHeaderCell, { width: 80 }]}>
                                    {stop}
                                  </Text>
                                ))}
                              </View>
                              {/* 데이터 */}
                              {bus.saturday_schedule.map((row, index) => (
                                <View key={index} style={styles.scheduleRow}>
                                  {bus.stops?.map((stop, stopIndex) => (
                                    <Text key={stopIndex} style={[styles.scheduleCell, { width: 80 }]}>
                                      {row[stop] || '-'}
                                    </Text>
                                  ))}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* 일요일 시간표 */}
                {bus.sunday_schedule && (
                  <View style={styles.scheduleSection}>
                    <TouchableOpacity
                      style={styles.scheduleSectionHeader}
                      onPress={() => setExpandedSchedule(expandedSchedule === `${bus.id}-sunday` ? null : `${bus.id}-sunday`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.scheduleSectionTitle}>일요일</Text>
                      <Ionicons
                        name={expandedSchedule === `${bus.id}-sunday` ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#007AFF"
                      />
                    </TouchableOpacity>

                    {expandedSchedule === `${bus.id}-sunday` && (
                      <View style={styles.scheduleScrollView}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.scheduleTable}>
                              {/* 헤더 */}
                              <View style={styles.scheduleRow}>
                                {bus.stops?.map((stop, index) => (
                                  <Text key={index} style={[styles.scheduleCell, styles.scheduleHeaderCell, { width: 80 }]}>
                                    {stop}
                                  </Text>
                                ))}
                              </View>
                              {/* 데이터 */}
                              {bus.sunday_schedule.map((row, index) => (
                                <View key={index} style={styles.scheduleRow}>
                                  {bus.stops?.map((stop, stopIndex) => (
                                    <Text key={stopIndex} style={[styles.scheduleCell, { width: 80 }]}>
                                      {row[stop] || '-'}
                                    </Text>
                                  ))}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>셔틀버스</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>버스 정보를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>셔틀버스</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6B35" />
          <Text style={styles.errorText}>버스 정보를 불러올 수 없습니다.</Text>
          <Text style={styles.errorSubText}>잠시 후 다시 시도해주세요.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#fff' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>셔틀버스</Text>
      </View>

      {/* 공휴일 안내 */}
      <View style={styles.noticeContainer}>
        <View style={styles.noticeContent}>
          <Ionicons name="information-circle" size={16} color="#FF6B35" />
          <Text style={styles.noticeText}>
            공휴일에는 셔틀버스 운행이 중단됩니다. 시내버스 이용을 권장합니다.
          </Text>
        </View>
      </View>

      {/* 탭 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'shuttle' && styles.activeTabButton]}
          onPress={() => setActiveTab('shuttle')}
        >
          <Ionicons 
            name="bus" 
            size={20} 
            color={activeTab === 'shuttle' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'shuttle' && styles.activeTabText]}>
            셔틀버스
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'city' && styles.activeTabButton]}
          onPress={() => setActiveTab('city')}
        >
          <Ionicons 
            name="bus-outline" 
            size={20} 
            color={activeTab === 'city' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'city' && styles.activeTabText]}>
            시내버스
          </Text>
        </TouchableOpacity>
      </View>

      {/* 버스 목록 */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.busList}>
          {currentBuses && currentBuses.length > 0 ? (
            currentBuses.map(renderBusItem)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="bus-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>버스 정보가 없습니다.</Text>
            </View>
          )}
        </View>
        
        {/* 하단 안내 텍스트 */}
        <View style={styles.bottomNoticeContainer}>
          <Text style={styles.bottomNoticeText}>
            더욱 정확한 셔틀버스 정보는 호서대학교 홈페이지 참고바랍니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  noticeContainer: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#E65100',
    fontWeight: '500',
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTabButton: {
    backgroundColor: '#E3F2FD',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  busList: {
    padding: 16,
  },
  busCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  busHeader: {
    padding: 16,
  },
  busHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busInfo: {
    flex: 1,
  },
  busName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  busRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  busTime: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  busDescription: {
    fontSize: 12,
    color: '#888',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  stopsContainer: {
    marginTop: 16,
  },
  stopsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  stopsList: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stopNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stopName: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
    flex: 1,
  },
  arrowContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scheduleContainer: {
    marginTop: 16,
  },
  scheduleHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  scheduleSection: {
    marginBottom: 5,
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scheduleScrollView: {
    maxHeight: 400,
  },
  scheduleTable: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scheduleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  scheduleHeaderCell: {
    backgroundColor: '#f8f9fa',
    fontWeight: '600',
    color: '#333',
  },
  holidayNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginTop: 16,
  },
  holidayNoticeText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#E65100',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  bottomNoticeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  bottomNoticeText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
});
