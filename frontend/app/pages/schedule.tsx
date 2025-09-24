import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, FlatList, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../components/layout/TopBar';
import { scheduleService, Course as APICourse } from '../services/scheduleService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 시간표 데이터 타입
interface Course {
  id: string;
  name: string;
  professor: string;
  classroom: string;
  day: number; // 0: 월, 1: 화, 2: 수, 3: 목, 4: 금, 5: 토, 6: 일
  startPeriod: number; // 0: 09:00, 1: 10:00, 2: 11:00...
  endPeriod: number;
  credits: number;
  isMajor: boolean;
  color: string;
  college?: string; // 🆕 단과대학
  department?: string; // 🆕 학과/부
  courseCode?: string; // 🆕 학수번호 (분반 구분용)
  section?: string; // 🆕 분반 (분반 구분용)
  // 🆕 분리된 시간/강의실 필드
  lectureTime?: string; // 예: "화3,4 목1"
  lectureRoom?: string; // 예: "제1공학관(아산) 402"
}

// 시간표 설정
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
// 🔧 호서대학교 교시 체계: 0교시=09:00, 1교시=10:00, 2교시=11:00...
const PERIODS = [
  { time: '09:00', period: 0 }, // 0교시
  { time: '10:00', period: 1 }, // 1교시
  { time: '11:00', period: 2 }, // 2교시
  { time: '12:00', period: 3 }, // 3교시
  { time: '13:00', period: 4 }, // 4교시
  { time: '14:00', period: 5 }, // 5교시
  { time: '15:00', period: 6 }, // 6교시
  { time: '16:00', period: 7 }, // 7교시
  { time: '17:00', period: 8 }, // 8교시
  { time: '18:00', period: 9 }, // 9교시
  { time: '19:00', period: 10 }, // 10교시
  { time: '20:00', period: 11 }, // 11교시
  { time: '21:00', period: 12 }, // 12교시
  { time: '22:00', period: 13 }, // 13교시
  { time: '23:00', period: 14 }, // 14교시
];

// 🏫 단과대학 및 학과 정보 (시간표 폴더 구조 기반)
const COLLEGE_DEPARTMENTS: { [key: string]: string[] } = {
  'AI공과대학': [
    '건축토목공학부', '건축학과', '게임소프트웨어학과', '기계공학과', '기계자동차공학부',
    '미래자동차공학과', '반도체공학과', '빅데이터AI학과', '빅데이터AI학부', '소방방재학과',
    '시스템제어공학과', '안전공학과', '안전보건학과', '안전소방학부', '자동차ICT공학과',
    '전기공학과', '전자공학과', '전자융합공학부', '전자재료공학과', '정보통신공학부',
    '지능로봇학과', '컴퓨터공학부', '화학공학과', '환경공학과'
  ],
  '글로벌융합대학': [
    '경영학부', '국제학부', '글로벌통상학과', '기계ICT공학과', '기계반도체공학과',
    '디지털금융경영학과', '디지털기술경영학과', '미디어커뮤니케이션학과', '법경찰행정학과',
    '사회복지상담학과', '사회복지학부', '산업심리학과', '산업안전공학과', '스마트경영학과',
    '안전공학과', '영어영문학과', '유아교육과', '중국학과', '청소년문화상담학과',
    '한국언어문화학과', '항공서비스학과'
  ],
  '바이오헬스대학': [
    '간호학과', '동물보건복지학과', '물리치료학과', '생명공학과', '식품공학과',
    '식품영양학과', '임상병리학과', '제약공학과', '화장품과학과', '화장품생명공학부'
  ],
  '아트앤컬처대학': [
    '골프산업학과', '공연예술학부', '기독교학과', '디자인스쿨', '디지털프로덕트디자인학과',
    '문화영상학부', '사회체육학과', '산업디자인학과', '시각디자인학과', '실내디자인학과'
  ],
  '교양대학': [
    '자유전공학부', '창의교양학부', '혁신융합학부'
  ],
  '교양': [
    '교직과정', '기본교양', '기초교양', '대학기초', '인성교양', '일반교양', '자유선택'
  ]
};

const COLLEGES = Object.keys(COLLEGE_DEPARTMENTS);

const COURSE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export default function ScheduleScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{day: number, period: number} | null>(null);
  
  // 🆕 강의 정보 모달 상태
  const [showCourseDetailModal, setShowCourseDetailModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<APICourse[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [isMajorFilter, setIsMajorFilter] = useState<boolean | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  
  // 🆕 단과대학/학과 필터 상태
  const [colleges, setColleges] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  
  // 🆕 스크롤 팝업 상태
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  
  // 하단 슬라이드 관련 상태
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.7; // 화면의 70%
  
  // 새 강의 정보
  const [newCourse, setNewCourse] = useState({
    name: '',
    professor: '',
    classroom: '',
    credits: '',
    isMajor: false,
  });

  // 🔧 학점 계산 (동일 강의 중복 제거)
  const uniqueCourses = courses.reduce((acc, course) => {
    // 같은 분반의 강의는 하나로 그룹화 (분반 구분)
    const key = `${course.name}_${course.professor}_${course.courseCode}_${course.section}`;
    if (!acc[key]) {
      acc[key] = course;
    }
    return acc;
  }, {} as { [key: string]: Course });
  
  const uniqueCourseList = Object.values(uniqueCourses);
  const totalCredits = uniqueCourseList.reduce((sum, course) => sum + course.credits, 0);
  const majorCredits = uniqueCourseList.filter(course => course.isMajor).reduce((sum, course) => sum + course.credits, 0);
  const generalCredits = totalCredits - majorCredits;

  // 하단 슬라이드 제어 함수들
  const showBottomSheet = () => {
    setIsBottomSheetVisible(true);
    Animated.timing(bottomSheetAnim, {
      toValue: SCREEN_HEIGHT - BOTTOM_SHEET_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const hideBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsBottomSheetVisible(false);
    });
  };

  // 🆕 필터 초기화
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedClassification('');
    setSelectedCollege('');
    setSelectedDepartment('');
    setIsMajorFilter(undefined);
    setSearchResults([]);
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadClassifications();
    loadColleges();
    loadSchedule();
  }, []);

  // 시간표 데이터 로드
  const loadSchedule = async () => {
    try {
      const scheduleData = await scheduleService.getSchedule();
      
      // API 응답 데이터를 프론트엔드 Course 형식으로 변환
      const mappedCourses: Course[] = (scheduleData.courses || []).map((apiCourse: any) => ({
        id: apiCourse.id.toString(),
        name: apiCourse.name,
        professor: apiCourse.professor,
        classroom: apiCourse.classroom || '',
        day: apiCourse.day,
        startPeriod: apiCourse.start_period,
        endPeriod: apiCourse.end_period,
        credits: apiCourse.credits,
        isMajor: apiCourse.is_major,
        color: apiCourse.color || '#3B82F6',
        college: apiCourse.college,
        department: apiCourse.department,
        courseCode: apiCourse.course_code, // 🔧 분반 구분용
        section: apiCourse.section, // 🔧 분반 구분용
        // 🆕 새 필드 매핑
        lectureTime: apiCourse.lecture_time,
        lectureRoom: apiCourse.lecture_room
      }));
      
      setCourses(mappedCourses);
      console.log(`✅ 시간표 로드 완료: ${mappedCourses.length}개 강의`);
    } catch (error: any) {
      console.log('시간표 로드 실패:', error); // console.error 대신 console.log 사용
      
      // 시간표가 없는 경우 사용자에게 안내
      if (error.message?.includes('시간표를 찾을 수 없습니다') || 
          error.message?.includes('404') ||
          error.response?.status === 404) {
        Alert.alert(
          '시간표 정보 없음',
          '아직 등록된 강의가 없습니다.\n과목을 검색해서 시간표에 추가해보세요.',
          [{ text: '확인' }]
        );
      } else {
        Alert.alert(
          '시간표 로드 오류',
          '시간표 정보를 불러오는데 실패했습니다.\n잠시 후 다시 시도해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '다시 시도', onPress: () => loadSchedule() }
          ]
        );
      }
      
      // 에러가 발생해도 빈 배열로 초기화
      setCourses([]);
    }
  };

  // 이수구분 목록 로드
  const loadClassifications = async () => {
    try {
      const data = await scheduleService.getClassifications();
      setClassifications(data);
    } catch (error: any) {
      console.log('이수구분 목록 로드 실패:', error); // console.error 대신 console.log 사용
      // 이수구분 로드 실패는 치명적이지 않으므로 조용히 처리
      setClassifications([]);
    }
  };

  // 🆕 단과대학 목록 로드 (DB에서 실제 데이터 가져오기)
  const loadColleges = async () => {
    try {
      const collegeList = await scheduleService.getColleges();
      setColleges(collegeList);
      console.log(`✅ 단과대학 목록 로드: ${collegeList.length}개`);
    } catch (error: any) {
      console.log('단과대학 목록 로드 실패:', error);
      // 실패 시 로컬 데이터 사용
      setColleges(COLLEGES);
    }
  };

  // 🆕 학과 목록 로드 (DB에서 실제 데이터 가져오기)
  const loadDepartments = async (college?: string) => {
    try {
      const departmentList = await scheduleService.getDepartments(college);
      setDepartments(departmentList);
      console.log(`✅ ${college} 학과 목록 로드: ${departmentList.length}개`);
    } catch (error: any) {
      console.log('학과 목록 로드 실패:', error);
      // 실패 시 로컬 데이터 사용
      if (college && COLLEGE_DEPARTMENTS[college]) {
        setDepartments(COLLEGE_DEPARTMENTS[college]);
      } else {
        setDepartments([]);
      }
    }
  };

  // 단과대학 변경 시 학과 목록 업데이트
  useEffect(() => {
    if (selectedCollege) {
      loadDepartments(selectedCollege);
      setSelectedDepartment(''); // 학과 선택 초기화
    } else {
      setDepartments([]);
      setSelectedDepartment('');
    }
  }, [selectedCollege]);

  // 과목 검색
  const searchCourses = async () => {
    // 🆕 검색어가 없어도 필터가 있으면 검색 실행
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasFilters = selectedClassification || selectedCollege || selectedDepartment || isMajorFilter !== undefined;
    
    if (!hasSearchQuery && !hasFilters) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await scheduleService.searchCourses(
        searchQuery || undefined, // 빈 문자열이면 undefined로 전달
        selectedClassification || undefined,
        selectedCollege || undefined,
        selectedDepartment || undefined,
        isMajorFilter,
        50
      );
      setSearchResults(results);
    } catch (error: any) {
      console.log('과목 검색 실패:', error); // console.error 대신 console.log 사용
      Alert.alert(
        '검색 실패', 
        '과목 검색에 실패했습니다.\n네트워크 연결을 확인하고 다시 시도해주세요.',
        [{ text: '확인' }]
      );
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 변경 시 자동 검색 (디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      // 🆕 검색어가 있거나 필터가 있으면 검색 실행
      const hasSearchQuery = searchQuery.trim().length > 0;
      const hasFilters = selectedClassification || selectedCollege || selectedDepartment || isMajorFilter !== undefined;
      
      if (hasSearchQuery || hasFilters) {
        searchCourses();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedClassification, selectedCollege, selectedDepartment, isMajorFilter]);

  // 검색된 과목을 시간표에 자동 시간 할당으로 추가
  const addSearchedCourseToSchedule = async (apiCourse: APICourse) => {
    try {
      Alert.alert(
        '시간표에 추가',
        `${apiCourse.name} 강의를 자동으로 시간표에 추가하시겠습니까?\n(개설과목의 원래 시간대에 추가됩니다)`,
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '추가', 
            onPress: async () => {
              try {
                // API를 통해 과목 자동 추가
                const addedCourse = await scheduleService.addCourseToSchedule(apiCourse.id);
                
                // 시간표 새로고침
                await loadSchedule();
                
                // 성공 메시지에 시간 정보 포함
                const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
                const dayName = addedCourse.day !== undefined ? dayNames[addedCourse.day] || '알 수 없음' : '알 수 없음';
                const timeStr = `${dayName}요일 ${addedCourse.start_period ?? 0}교시`;
                
                Alert.alert('성공', `${apiCourse.name} 강의가 ${timeStr}에 추가되었습니다.`);
              } catch (error: any) {
                console.log('과목 추가 실패:', error); // console.error 대신 console.log 사용
                
                // 시간 충돌 오류인 경우 상세한 안내
                if (error.message?.includes('이미') && error.message?.includes('강의가 있습니다')) {
                  Alert.alert('시간 충돌', error.message);
                } else if (error.message?.includes('시간 정보가 없어')) {
                  Alert.alert(
                    '시간 정보 없음', 
                    '이 과목은 시간 정보가 없어 시간표에 추가할 수 없습니다.\n다른 과목을 선택해주세요.'
                  );
                } else {
                  Alert.alert(
                    '추가 실패', 
                    '과목 추가에 실패했습니다.\n네트워크 연결을 확인하고 다시 시도해주세요.'
                  );
                }
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.log('과목 추가 준비 실패:', error); // console.error 대신 console.log 사용
      Alert.alert('오류', '과목 추가 준비에 실패했습니다.');
    }
  };



  // 시간표 셀 클릭 핸들러
  const handleCellPress = (day: number, period: number) => {
    // 해당 시간에 이미 강의가 있는지 확인
    const existingCourse = courses.find(course => 
      course.day === day && 
      course.startPeriod <= period && 
      course.endPeriod >= period
    );
    
    if (existingCourse) {
      // 🆕 기존 강의 정보 표시
      setSelectedCourse(existingCourse);
      setShowCourseDetailModal(true);
    } else {
      // 새 강의 추가 - 직접 추가 모달 열기
      setSelectedCell({ day, period });
      setShowAddModal(true);
    }
  };

  // 강의 추가
  const addCourse = () => {
    if (!selectedCell || !newCourse.name || !newCourse.professor || !newCourse.classroom || !newCourse.credits) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    const credits = parseInt(newCourse.credits);
    if (isNaN(credits) || credits <= 0) {
      Alert.alert('오류', '올바른 학점을 입력해주세요.');
      return;
    }

    // 시간 충돌 확인
    const hasConflict = courses.some(course => 
      course.day === selectedCell.day && 
      course.startPeriod <= selectedCell.period && 
      course.endPeriod >= selectedCell.period
    );

    if (hasConflict) {
      Alert.alert('오류', '해당 시간에 이미 강의가 있습니다.');
      return;
    }

    const course: Course = {
      id: Date.now().toString(),
      name: newCourse.name,
      professor: newCourse.professor,
      classroom: newCourse.classroom,
      day: selectedCell.day,
      startPeriod: selectedCell.period,
      endPeriod: selectedCell.period, // 기본적으로 1시간 강의
      credits: credits,
      isMajor: newCourse.isMajor,
      color: COURSE_COLORS[courses.length % COURSE_COLORS.length]
    };

    setCourses([...courses, course]);
    setShowAddModal(false);
    setSelectedCell(null);
    setNewCourse({ name: '', professor: '', classroom: '', credits: '', isMajor: false });
  };

  // 강의 삭제
  const deleteCourse = async (courseId: string) => {
    try {
      // API를 통해 강의 삭제
      await scheduleService.deleteCourse(parseInt(courseId));
      
      // 시간표 새로고침
      await loadSchedule();
      
      Alert.alert('성공', '강의가 삭제되었습니다.');
    } catch (error: any) {
      console.log('강의 삭제 실패:', error); // console.error 대신 console.log 사용
      Alert.alert(
        '삭제 실패', 
        '강의 삭제에 실패했습니다.\n네트워크 연결을 확인하고 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  // 🔧 같은 분반의 모든 블록 삭제
  const deleteAllCourseBlocks = async (selectedCourse: Course) => {
    try {
      // 같은 분반의 모든 블록 찾기 (분반 구분)
      const allBlocks = courses.filter(c => 
        c.name === selectedCourse.name && 
        c.professor === selectedCourse.professor &&
        c.courseCode === selectedCourse.courseCode &&
        c.section === selectedCourse.section
      );
      
      console.log(`🗑️ ${selectedCourse.name} 전체 블록 삭제: ${allBlocks.length}개`);
      
      // 각 블록을 개별적으로 삭제
      for (const block of allBlocks) {
        await scheduleService.deleteCourse(parseInt(block.id));
      }
      
      // 시간표 새로고침
      await loadSchedule();
      
      Alert.alert('성공', `${selectedCourse.name} 강의가 모든 시간에서 삭제되었습니다.`);
    } catch (error: any) {
      console.log('강의 삭제 실패:', error);
      Alert.alert(
        '삭제 실패', 
        '강의 삭제에 실패했습니다.\n네트워크 연결을 확인하고 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    }
  };

  // 시간표 그리드 렌더링
  const renderScheduleGrid = () => {
    return (
      <View style={styles.gridContainer}>
        {/* 요일 헤더 */}
        <View style={styles.headerRow}>
          <View style={styles.timeColumn} />
          {DAYS.map((day, index) => (
            <View key={index} style={styles.dayHeader}>
              <Text style={styles.dayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* 시간표 행들 */}
        {PERIODS.map((period, periodIndex) => (
          <View key={periodIndex} style={styles.timeRow}>
            {/* 시간 표시 */}
            <View style={styles.timeColumn}>
              <Text style={styles.timeText}>{period.time}</Text>
            </View>
            
            {/* 각 요일 셀 */}
            {DAYS.map((_, dayIndex) => {
              // 🔧 해당 시간에 강의 찾기 (불연속/다중 블록 지원)
              const course = courses.find(c => 
                c.day === dayIndex && 
                c.startPeriod <= periodIndex && 
                c.endPeriod >= periodIndex
              );
              
              // 🔧 연속 교시 처리: 첫 번째 교시인지 확인
              const isFirstPeriod = course && course.startPeriod === periodIndex;
              const isMiddlePeriod = course && course.startPeriod < periodIndex;
              
              return (
                <TouchableOpacity
                  key={dayIndex}
                  style={[
                    styles.cell,
                    // 🆕 모든 해당 교시 셀에 배경색 적용
                    course && { backgroundColor: course.color },
                    selectedCell && selectedCell.day === -1 && styles.cellSelectMode
                  ]}
                  onPress={() => handleCellPress(dayIndex, periodIndex)}
                >
                  {course && (
                    // 🆕 모든 교시: 강의 정보 표시
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseName} numberOfLines={2}>
                        {course.name}
                      </Text>
                      <Text style={styles.courseDetail} numberOfLines={1}>
                        {course.professor}
                      </Text>
                      <Text style={styles.courseDetail} numberOfLines={1}>
                        {course.classroom}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TopBar 
        title="강의 시간표"
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      {/* 학점 정보 */}
      <View style={styles.creditInfo}>
        <View style={styles.creditItem}>
          <Text style={styles.creditLabel}>총 학점</Text>
          <Text style={styles.creditValue}>{totalCredits}학점</Text>
        </View>
        <View style={styles.creditItem}>
          <Text style={styles.creditLabel}>전공</Text>
          <Text style={styles.creditValue}>{majorCredits}학점</Text>
        </View>
        <View style={styles.creditItem}>
          <Text style={styles.creditLabel}>교양</Text>
          <Text style={styles.creditValue}>{generalCredits}학점</Text>
        </View>
        
        {/* 검색 버튼 */}
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={showBottomSheet}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.searchButtonText}>과목 검색</Text>
        </TouchableOpacity>
      </View>

      {/* 시간표 - 스크롤 가능 */}
      <ScrollView 
        style={styles.scheduleScrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.scheduleContainer}>
            {renderScheduleGrid()}
          </View>
        </ScrollView>
      </ScrollView>

      {/* 하단 슬라이드 검색 영역 */}
      {isBottomSheetVisible && (
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={hideBottomSheet}
        />
      )}
      
      <Animated.View 
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: bottomSheetAnim }]
          }
        ]}
      >
        {/* 핸들 바 */}
        <View style={styles.bottomSheetHandle} />
        
        {/* 헤더 */}
        <View style={styles.bottomSheetHeader}>
          <Text style={styles.bottomSheetTitle}>과목 검색</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetFilters}
            >
              <Text style={styles.resetButtonText}>초기화</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={hideBottomSheet}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 검색 입력 */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="과목명, 교수명, 학수번호로 검색 (선택사항)"
            placeholderTextColor="#888"
          />
          <TouchableOpacity 
            style={styles.searchIconButton}
            onPress={searchCourses}
          >
            <Ionicons name="search" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* 🆕 단과대학 필터 */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>단과대학</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowCollegeModal(true)}
          >
            <Text style={styles.selectButtonText}>
              {selectedCollege || '전체'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* 🆕 학과/부 필터 */}
        {selectedCollege && (
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>학과/부</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowDepartmentModal(true)}
            >
              <Text style={styles.selectButtonText}>
                {selectedDepartment || '전체'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* 이수구분 필터 */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>이수구분</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedClassification === '' && styles.filterButtonActive
              ]}
              onPress={() => setSelectedClassification('')}
            >
              <Text style={[
                styles.filterButtonText,
                selectedClassification === '' && styles.filterButtonTextActive
              ]}>
                전체
              </Text>
            </TouchableOpacity>
            {classifications.map((classification) => (
              <TouchableOpacity
                key={classification}
                style={[
                  styles.filterButton,
                  selectedClassification === classification && styles.filterButtonActive
                ]}
                onPress={() => setSelectedClassification(classification)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedClassification === classification && styles.filterButtonTextActive
                ]}>
                  {classification}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 전공/교양 필터 */}
        <View style={styles.majorFilterContainer}>
          <TouchableOpacity
            style={styles.majorFilterButton}
            onPress={() => setIsMajorFilter(undefined)}
          >
            <Ionicons 
              name={isMajorFilter === undefined ? "radio-button-on" : "radio-button-off"} 
              size={20} 
              color={isMajorFilter === undefined ? "#000" : "#ccc"} 
            />
            <Text style={styles.majorFilterText}>전체</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.majorFilterButton}
            onPress={() => setIsMajorFilter(true)}
          >
            <Ionicons 
              name={isMajorFilter === true ? "radio-button-on" : "radio-button-off"} 
              size={20} 
              color={isMajorFilter === true ? "#000" : "#ccc"} 
            />
            <Text style={styles.majorFilterText}>전공</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.majorFilterButton}
            onPress={() => setIsMajorFilter(false)}
          >
            <Ionicons 
              name={isMajorFilter === false ? "radio-button-on" : "radio-button-off"} 
              size={20} 
              color={isMajorFilter === false ? "#000" : "#ccc"} 
            />
            <Text style={styles.majorFilterText}>교양</Text>
          </TouchableOpacity>
        </View>

        {/* 검색 결과 */}
        <View style={styles.searchResultsContainer}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>검색 중...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => {
                    addSearchedCourseToSchedule(item);
                    hideBottomSheet();
                  }}
                >
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultDetail}>
                      {item.professor} • {item.credits}학점 • {item.classification}
                    </Text>
                    {(item.college || item.department) && (
                      <Text style={styles.searchResultCollege}>
                        {item.college} {item.department}
                      </Text>
                    )}
                    {item.course_code && (
                      <Text style={styles.searchResultCode}>학수번호: {item.course_code}</Text>
                    )}
                    {/* 🆕 분리된 필드 우선 사용 */}
                    {item.lecture_time && (
                      <Text style={styles.searchResultTime}>
                        시간: {item.lecture_time}
                      </Text>
                    )}
                    {item.lecture_room && (
                      <Text style={styles.searchResultTime}>
                        강의실: {item.lecture_room}
                      </Text>
                    )}
                    {/* 🔄 호환성: 분리된 필드가 없을 때만 기존 필드 사용 */}
                    {!item.lecture_time && item.lecture_time_room && (
                      <Text style={styles.searchResultTime}>
                        시간: {item.lecture_time_room}
                      </Text>
                    )}
                  </View>
                  <Ionicons 
                    name="add-circle" 
                    size={24} 
                    color="#007AFF" 
                  />
                </TouchableOpacity>
              )}
              style={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
            />
          ) : (searchQuery.trim() || selectedClassification || selectedCollege || selectedDepartment || isMajorFilter !== undefined) ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>
            </View>
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>단과대학/학과를 선택하거나 검색어를 입력해보세요.</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* 🆕 단과대학 선택 모달 */}
      <Modal
        visible={showCollegeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCollegeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scrollModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>단과대학 선택</Text>
              <TouchableOpacity onPress={() => setShowCollegeModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollModalList}>
              <TouchableOpacity
                style={[
                  styles.scrollModalItem,
                  selectedCollege === '' && styles.scrollModalItemSelected
                ]}
                onPress={() => {
                  setSelectedCollege('');
                  setShowCollegeModal(false);
                }}
              >
                <Text style={[
                  styles.scrollModalItemText,
                  selectedCollege === '' && styles.scrollModalItemTextSelected
                ]}>
                  전체
                </Text>
                {selectedCollege === '' && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
              
              {COLLEGES.map((college) => (
                <TouchableOpacity
                  key={college}
                  style={[
                    styles.scrollModalItem,
                    selectedCollege === college && styles.scrollModalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCollege(college);
                    setShowCollegeModal(false);
                  }}
                >
                  <Text style={[
                    styles.scrollModalItemText,
                    selectedCollege === college && styles.scrollModalItemTextSelected
                  ]}>
                    {college}
                  </Text>
                  {selectedCollege === college && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🆕 학과/부 선택 모달 */}
      <Modal
        visible={showDepartmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scrollModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>학과/부 선택</Text>
              <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollModalList}>
              <TouchableOpacity
                style={[
                  styles.scrollModalItem,
                  selectedDepartment === '' && styles.scrollModalItemSelected
                ]}
                onPress={() => {
                  setSelectedDepartment('');
                  setShowDepartmentModal(false);
                }}
              >
                <Text style={[
                  styles.scrollModalItemText,
                  selectedDepartment === '' && styles.scrollModalItemTextSelected
                ]}>
                  전체
                </Text>
                {selectedDepartment === '' && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
              
              {departments.map((department) => (
                <TouchableOpacity
                  key={department}
                  style={[
                    styles.scrollModalItem,
                    selectedDepartment === department && styles.scrollModalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedDepartment(department);
                    setShowDepartmentModal(false);
                  }}
                >
                  <Text style={[
                    styles.scrollModalItemText,
                    selectedDepartment === department && styles.scrollModalItemTextSelected
                  ]}>
                    {department}
                  </Text>
                  {selectedDepartment === department && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🆕 강의 정보 모달 */}
      <Modal
        visible={showCourseDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCourseDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>강의 정보</Text>
              <TouchableOpacity onPress={() => setShowCourseDetailModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {selectedCourse && (
              <View style={styles.courseDetailContainer}>
                {/* 강의명 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>과목명</Text>
                  <Text style={styles.detailValue}>{selectedCourse.name}</Text>
                </View>

                {/* 교수명 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>교수</Text>
                  <Text style={styles.detailValue}>{selectedCourse.professor}</Text>
                </View>

                {/* 학점 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>학점</Text>
                  <Text style={styles.detailValue}>{selectedCourse.credits}학점</Text>
                </View>


                {/* 🆕 시간 정보 - 새 필드 우선 사용 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>시간</Text>
                  <Text style={[styles.detailValue, styles.detailValueMultiLine]}>
                    {selectedCourse.lectureTime || '시간 정보 없음'}
                  </Text>
                </View>

                {/* 🆕 강의실 정보 - 새 필드 우선 사용 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>강의실</Text>
                  <Text style={[styles.detailValue, styles.detailValueMultiLine]}>
                    {selectedCourse.lectureRoom || selectedCourse.classroom || '미정'}
                  </Text>
                </View>

                {/* 단과대학/학과 */}
                {(selectedCourse.college || selectedCourse.department) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>소속</Text>
                    <Text style={styles.detailValue}>
                      {selectedCourse.college} {selectedCourse.department}
                    </Text>
                  </View>
                )}

                {/* 전공/교양 구분 */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>구분</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: selectedCourse.isMajor ? '#007AFF' : '#FF6B6B' }
                  ]}>
                    {selectedCourse.isMajor ? '전공과목' : '교양과목'}
                  </Text>
                </View>
              </View>
            )}

            {/* 하단 버튼 */}
            <View style={styles.courseDetailButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCourseDetailModal(false)}
              >
                <Text style={styles.cancelButtonText}>닫기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={() => {
                  if (selectedCourse) {
                    setShowCourseDetailModal(false);
                    // 강의 삭제 확인
                    Alert.alert(
                      '강의 제거',
                      `${selectedCourse.name} 강의를 시간표에서 제거하시겠습니까?`,
                      [
                        { text: '취소', style: 'cancel' },
                        { 
                          text: '제거', 
                          style: 'destructive',
                          onPress: () => deleteAllCourseBlocks(selectedCourse)
                        }
                      ]
                    );
                  }
                }}
              >
                <Ionicons name="trash" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.deleteButtonText}>강의 제거</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 강의 추가 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>강의 추가</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>과목명</Text>
              <TextInput
                style={styles.input}
                value={newCourse.name}
                onChangeText={(text) => setNewCourse({...newCourse, name: text})}
                placeholder="과목명을 입력하세요"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>교수명</Text>
              <TextInput
                style={styles.input}
                value={newCourse.professor}
                onChangeText={(text) => setNewCourse({...newCourse, professor: text})}
                placeholder="교수명을 입력하세요"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>강의실</Text>
              <TextInput
                style={styles.input}
                value={newCourse.classroom}
                onChangeText={(text) => setNewCourse({...newCourse, classroom: text})}
                placeholder="강의실을 입력하세요"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>학점</Text>
              <TextInput
                style={styles.input}
                value={newCourse.credits}
                onChangeText={(text) => setNewCourse({...newCourse, credits: text})}
                placeholder="학점을 입력하세요"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setNewCourse({...newCourse, isMajor: !newCourse.isMajor})}
            >
              <Ionicons 
                name={newCourse.isMajor ? "checkbox" : "square-outline"} 
                size={24} 
                color={newCourse.isMajor ? "#000" : "#ccc"} 
              />
              <Text style={styles.checkboxLabel}>전공과목</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={addCourse}
              >
                <Text style={styles.addButtonText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  creditInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  creditItem: {
    alignItems: 'center',
  },
  creditLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  creditValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  // 검색 버튼 스타일
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 16,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  
  // 시간표 스크롤 컨테이너
  scheduleScrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scheduleContainer: {
    width: 500, // 고정 너비로 격자 안정화
    padding: 10,
  },
  gridContainer: {
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  timeColumn: {
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  dayHeader: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  dayText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  timeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  cell: {
    flex: 1,
    height: 60,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cellSelectMode: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  courseInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  courseName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',  // 🔧 검은색으로 변경
    textAlign: 'center',
    marginBottom: 2,
  },
  courseDetail: {
    fontSize: 9,
    color: '#000',  // 🔧 검은색으로 변경
    textAlign: 'center',
    opacity: 0.8,   // 🔧 투명도 조정 (검은색에 맞게)
    lineHeight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addButton: {
    backgroundColor: '#000',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  addButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  // 🆕 강의 정보 모달 스타일
  courseDetailContainer: {
    paddingVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 16,
    color: '#000',
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  // 🆕 다중 줄 표시용 스타일
  detailValueMultiLine: {
    textAlign: 'right',
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  courseDetailButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  // 하단 슬라이드 스타일
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.7,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginRight: 12,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  // 🆕 선택 버튼 스타일
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  // 🆕 스크롤 모달 스타일
  scrollModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '75%', // 🔧 높이 증가
    width: '92%', // 🔧 너비 증가
    marginHorizontal: '4%',
  },
  scrollModalList: {
    maxHeight: 450, // 🔧 최대 높이 증가
  },
  scrollModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18, // 🔧 패딩 증가로 더 넓은 터치 영역
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 54, // 🆕 최소 높이 보장
  },
  scrollModalItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  scrollModalItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    flexWrap: 'wrap', // 🆕 텍스트 줄바꿈 허용
    lineHeight: 22, // 🆕 줄 간격 설정
  },
  scrollModalItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f8f9fa',
  },
  searchIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  searchIconButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  // 🆕 필터 섹션 스타일
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  majorFilterContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  majorFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  majorFilterText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 5,
  },
  searchResultsContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  searchResultItemSelected: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  searchResultDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  searchResultCode: {
    fontSize: 12,
    color: '#888',
  },
  searchResultTime: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 2,
  },
  searchResultCollege: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
  },
});
