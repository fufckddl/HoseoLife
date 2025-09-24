"""
시간표 Excel 파일 import 유틸리티
2025년 2학기 호서대학교 시간표 데이터를 데이터베이스에 import합니다.
"""
import pandas as pd
import os
import re
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional, Tuple
from app.models.schedule import Course
from app.db.database import get_db

class ScheduleImporter:
    def __init__(self):
        self.semester = "2학기"  # 2025년 2학기
        self.year = 2025
        self.base_path = "시간표"
        
        # 단과대학 매핑
        self.college_mapping = {
            "AI공과대학": "AI공과대학",
            "교양대학": "교양대학", 
            "글로벌융합대학": "글로벌융합대학",
            "바이오헬스대학": "바이오헬스대학",
            "아트앤컬처대학": "아트앤컬처대학",
            "교양": "교양"
        }
    
    def generate_course_color(self, course_name: str, course_code: str = None) -> str:
        """
        과목명과 학수번호를 기반으로 색상 생성
        """
        # 🎨 밝은 색상 팔레트 (검은 글자와 대비가 좋은 색상들만)
        colors = [
            '#FFE5E5', '#E5F9F6', '#E5F3FF', '#F0FFF0', '#FFF8DC',
            '#F0E6FF', '#E5F9F6', '#FFF9C4', '#F5E6FF', '#E3F2FD',
            '#FFF3E0', '#E8F5E8', '#FFE0E6', '#E1F5FE', '#F3E5F5',
            '#E8F6F3', '#FFF8E1', '#FFEBEE', '#E8EAF6', '#F1F8E9',
            '#FFF3E0', '#FCE4EC', '#E0F2F1', '#F9FBE7', '#FFF8E1',
            '#E1F5FE', '#F3E5F5', '#FFECB3', '#C8E6C9', '#BBDEFB',
            '#F8BBD0', '#B2DFDB', '#DCEDC8', '#FFE0B2', '#D1C4E9',
            '#C5E1A5', '#FFCDD2', '#B3E5FC', '#E1BEE7', '#A5D6A7'
        ]
        
        # 과목명과 학수번호를 조합하여 해시값 생성
        text = f"{course_name}_{course_code or ''}"
        hash_value = hash(text) % len(colors)
        
        return colors[hash_value]

    def parse_filename(self, filename: str) -> Tuple[Optional[str], Optional[str]]:
        """
        파일명에서 단과대학과 학과 정보 추출
        예: "AI공과대학_컴퓨터공학부.xls" -> ("AI공과대학", "컴퓨터공학부")
        """
        # 확장자 제거
        name = filename.replace('.xls', '').replace('.xlsx', '')
        
        # 교양 폴더의 경우
        if '_' not in name:
            return "교양", name
        
        # 일반적인 경우: "단과대학_학과" 형태
        parts = name.split('_', 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        
        return None, None
    
    def parse_lecture_time_room(self, time_room_str: str) -> List[Dict[str, Optional[int]]]:
        """
        강의시간(강의실) 문자열을 파싱해서 요일, 시작교시, 종료교시, 강의실 추출
        다양한 패턴 지원:
        1. 같은 요일 불연속: "월0,10,11(강의실)" -> 월0교시 + 월10-11교시
        2. 서로 다른 요일: "월1(A)/화3(B)/금9,10(C)" -> 월1교시 + 화3교시 + 금9-10교시
        3. 복합 패턴: "금3,4(A)/목6,7(B)/토4,5(C)" -> 각 요일별 시간 블록
        """
        if not time_room_str or pd.isna(time_room_str):
            return [{"day": None, "start_period": None, "end_period": None, "classroom": None}]
        
        # 요일 매핑
        day_mapping = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}
        
        results = []
        
        try:
            # 🔧 1단계: "/"로 구분된 여러 시간 패턴 분리
            time_patterns = str(time_room_str).split('/')
            
            for pattern in time_patterns:
                pattern = pattern.strip()
                if not pattern:
                    continue
                
                # 🔧 2단계: 각 패턴에서 시간 정보 추출 (순서 중요!)
                # 패턴 1: "월4-5(강의실)" - 범위 교시 (하이픈으로 구분) - 가장 구체적
                # 요일과 숫자 사이에 공백이 있을 수 있어 \s* 허용
                match1 = re.search(r'([월화수목금토일])\s*(\d+)-(\d+)(?:\((.+)\))?', pattern)
                
                # 패턴 2: "월3,4,5(강의실)" - 연속/불연속 교시 (쉼표로 구분, 2개 이상)
                match2 = re.search(r'([월화수목금토일])\s*(\d+(?:,\d+)+)(?:\((.+)\))?', pattern)
                
                # 패턴 3: "월4(강의실)" 또는 "월4" - 단일 교시 (강의실 정보 선택적)
                match3 = re.search(r'([월화수목금토일])\s*(\d+)(?:\((.+)\))?', pattern)
                
                if match1:  # 하이픈으로 구분된 범위 교시
                    day_str, start_str, end_str, classroom = match1.groups()
                    
                    results.append({
                        "day": day_mapping.get(day_str),
                        "start_period": int(start_str),
                        "end_period": int(end_str),
                        "classroom": classroom.strip() if classroom else ""
                    })
                    
                elif match2:  # 쉼표로 구분된 교시들
                    day_str, periods_str, classroom = match2.groups()
                    periods = [int(p) for p in periods_str.split(',')]
                    day_num = day_mapping.get(day_str)
                    classroom = classroom.strip() if classroom else ""
                    
                    # 🔧 연속 그룹으로 분할
                    periods_sorted = sorted(periods)
                    groups = []
                    current_group = [periods_sorted[0]]
                    
                    for i in range(1, len(periods_sorted)):
                        if periods_sorted[i] == periods_sorted[i-1] + 1:
                            # 연속 교시
                            current_group.append(periods_sorted[i])
                        else:
                            # 불연속 교시 - 새 그룹 시작
                            groups.append(current_group)
                            current_group = [periods_sorted[i]]
                    
                    groups.append(current_group)  # 마지막 그룹 추가
                    
                    # 각 그룹을 별도 시간 블록으로 생성
                    for group in groups:
                        results.append({
                            "day": day_num,
                            "start_period": min(group),
                            "end_period": max(group),
                            "classroom": classroom
                        })
                    
                elif match3:  # 단일 교시
                    day_str, period_str, classroom = match3.groups()
                    
                    results.append({
                        "day": day_mapping.get(day_str),
                        "start_period": int(period_str),
                        "end_period": int(period_str),
                        "classroom": classroom.strip() if classroom else ""
                    })
            
            # 🔧 3단계: 결과 정리 및 로그
            if len(results) > 1:
                total_patterns = len(time_patterns)
                total_blocks = len(results)
                if total_patterns > 1:
                    print(f"🌟 다중 요일 강의 감지: {time_room_str} -> {total_blocks}개 시간 블록 ({total_patterns}개 패턴)")
                elif total_blocks > total_patterns:
                    print(f"⚠️  불연속 교시 감지: {time_room_str} -> {total_blocks}개 시간 블록으로 분할")
                
        except Exception as e:
            print(f"시간 파싱 오류: {time_room_str} -> {e}")
            results = [{"day": None, "start_period": None, "end_period": None, "classroom": None}]
        
        return results if results else [{"day": None, "start_period": None, "end_period": None, "classroom": None}]
    
    def process_excel_file(self, filepath: str, college: str, department: str) -> List[Dict]:
        """
        Excel 파일을 읽어서 Course 데이터로 변환
        """
        try:
            # 파일 존재 확인
            if not os.path.exists(filepath):
                print(f"❌ {filepath} 파일 처리 오류: [Errno 2] No such file or directory: '{filepath}'")
                return []
            
            df = pd.read_excel(filepath)
            courses = []
            
            for _, row in df.iterrows():
                # 시간 정보 파싱 (여러 시간 블록 가능)
                time_blocks = self.parse_lecture_time_room(row.get('강의시간(강의실)', ''))
                
                # 🔧 NaN 값을 None으로 변환하는 헬퍼 함수
                def safe_get(key, default=''):
                    value = row.get(key, default)
                    return None if pd.isna(value) else value
                
                # 기본 강의 정보 (시간 정보 제외)
                base_course_data = {
                    # 기본 정보
                    "no": str(safe_get('NO') or ''),
                    "college": college,
                    "department": department,
                    "semester": self.semester,
                    "year": self.year,
                    
                    # Excel 데이터 (모든 필드에 NaN 처리)
                    "classification": safe_get('이수구분'),
                    "aisw_micro_degree": safe_get('AISW마이크로디그리'),
                    "general_area": safe_get('교양영역'),
                    "course_code": safe_get('학수번호'),
                    "section": safe_get('분반'),
                    "target_grade": str(safe_get('개설학년') or ''),
                    "name": safe_get('교과목명') or '과목명 없음',
                    "credits": int(safe_get('학점') or 0),
                    "professor": safe_get('교수명') or '교수 미정',
                    "lecture_time_room": safe_get('강의시간(강의실)'),
                    "class_type": safe_get('수업구분'),
                    "teaching_method": safe_get('수업방법'),
                    "team_teaching_type": safe_get('팀티칭 유형'),
                    
                    # 기본값들
                    "is_major": college != "교양",  # 교양이 아니면 전공으로 간주
                    "color": self.generate_course_color(safe_get('교과목명') or '과목명 없음', safe_get('학수번호')),  # 🆕 고유 색상 생성
                    "user_id": None,  # 개설과목이므로 None
                    "user_schedule_id": None
                }
                
                # 🔧 모든 시간 블록을 합쳐서 통합 lecture_time 생성
                day_names = ["월", "화", "수", "목", "금", "토", "일"]
                all_time_parts = []
                all_classrooms = []
                
                for block in time_blocks:
                    d = block.get("day")
                    sp = block.get("start_period") 
                    ep = block.get("end_period")
                    classroom = block.get("classroom")
                    
                    if d is not None and sp is not None and ep is not None and 0 <= d < len(day_names):
                        if sp == ep:
                            all_time_parts.append(f"{day_names[d]}{sp}")
                        else:
                            all_time_parts.append(f"{day_names[d]}{sp}-{ep}")
                    
                    # 🆕 모든 강의실 수집 (중복 제거)
                    if classroom and classroom not in all_classrooms:
                        all_classrooms.append(classroom.strip())
                
                # 중복 제거하되 순서 유지 (예: "금1,2,3 금4" -> "금1-3 금4")
                unique_time_parts = list(dict.fromkeys(all_time_parts))
                combined_lecture_time = ' '.join(unique_time_parts) if unique_time_parts else None
                
                # 🆕 모든 강의실을 합쳐서 lecture_room 생성
                combined_lecture_room = ' / '.join(all_classrooms) if all_classrooms else None
                
                # 각 시간 블록에 대해 별도의 강의 레코드 생성
                for time_block in time_blocks:
                    course_data = base_course_data.copy()
                    course_data.update({
                        # 파싱된 시간 정보
                        "day": time_block["day"],
                        "start_period": time_block["start_period"],
                        "end_period": time_block["end_period"],
                        "classroom": time_block["classroom"],
                        # 🆕 모든 블록을 합친 통합 시간/강의실 정보
                        "lecture_time": combined_lecture_time,
                        "lecture_room": combined_lecture_room
                    })
                    courses.append(course_data)
            
            print(f"✅ {filepath}: {len(courses)}개 과목 파싱 완료")
            return courses
            
        except Exception as e:
            print(f"❌ {filepath} 파일 처리 오류: {e}")
            return []
    
    def import_all_schedules(self, db: Session) -> Dict[str, int]:
        """
        모든 시간표 파일을 import
        """
        stats = {"total_files": 0, "success_files": 0, "total_courses": 0, "errors": []}
        
        # 기존 개설과목 데이터 삭제 (user_id가 None인 것들)
        print("🗑️  기존 개설과목 데이터 삭제 중...")
        deleted_count = db.query(Course).filter(Course.user_id.is_(None)).delete()
        db.commit()
        print(f"   삭제된 개설과목 수: {deleted_count}")
        
        # 각 단과대학 폴더 순회
        for college_folder in os.listdir(self.base_path):
            college_path = os.path.join(self.base_path, college_folder)
            r
            if not os.path.isdir(college_path):
                continue
            
            college = self.college_mapping.get(college_folder, college_folder)
            print(f"\n📚 {college} 처리 중...")
            
            # 각 Excel 파일 처리
            for filename in os.listdir(college_path):
                if not filename.endswith(('.xls', '.xlsx')):
                    continue
                
                stats["total_files"] += 1
                filepath = os.path.join(college_path, filename)
                
                # 파일명에서 학과 정보 추출
                file_college, department = self.parse_filename(filename)
                if not department:
                    stats["errors"].append(f"파일명 파싱 실패: {filename}")
                    continue
                
                # Excel 파일 처리
                courses = self.process_excel_file(filepath, college, department)
                
                if courses:
                    # 데이터베이스에 저장
                    try:
                        for course_data in courses:
                            course = Course(**course_data)
                            db.add(course)
                        
                        db.commit()
                        stats["success_files"] += 1
                        stats["total_courses"] += len(courses)
                        print(f"   ✅ {department}: {len(courses)}개 과목 저장 완료")
                        
                    except Exception as e:
                        db.rollback()
                        error_msg = f"{department} 저장 실패: {e}"
                        stats["errors"].append(error_msg)
                        print(f"   ❌ {error_msg}")
                else:
                    stats["errors"].append(f"데이터 파싱 실패: {filename}")
        
        return stats
    
    def get_import_summary(self, db: Session) -> Dict[str, int]:
        """
        import 결과 요약 정보
        """
        # 전체 개설과목 수
        total_courses = db.query(Course).filter(Course.user_id.is_(None)).count()
        
        # 단과대학별 통계
        college_stats = {}
        colleges = db.query(Course.college).filter(Course.user_id.is_(None)).distinct().all()
        
        for (college,) in colleges:
            if college:
                count = db.query(Course).filter(
                    Course.user_id.is_(None), 
                    Course.college == college
                ).count()
                college_stats[college] = count
        
        return {
            "total_courses": total_courses,
            "college_stats": college_stats
        }

    def save_courses_to_db(self, courses: List[Dict]):
        """
        파싱된 강의 데이터를 데이터베이스에 저장
        """
        if not courses:
            return 0
        
        db = next(get_db())
        saved_count = 0
        
        try:
            for course_data in courses:
                # Course 모델 인스턴스 생성
                from app.models.schedule import Course
                
                course = Course(
                    no=course_data.get('no', ''),
                    college=course_data.get('college', ''),
                    department=course_data.get('department', ''),
                    semester=course_data.get('semester', 2),
                    year=course_data.get('year', 2024),
                    classification=course_data.get('classification'),
                    aisw_micro_degree=course_data.get('aisw_micro_degree'),
                    general_area=course_data.get('general_area'),
                    course_code=course_data.get('course_code'),
                    section=course_data.get('section'),
                    target_grade=course_data.get('target_grade', ''),
                    name=course_data.get('name', '과목명 없음'),
                    credits=course_data.get('credits', 0),
                    professor=course_data.get('professor', '교수 미정'),
                    lecture_time_room=course_data.get('lecture_time_room'),
                    day=course_data.get('day'),
                    start_period=course_data.get('start_period'),
                    end_period=course_data.get('end_period'),
                    classroom=course_data.get('classroom'),
                    class_type=course_data.get('class_type'),
                    teaching_method=course_data.get('teaching_method'),
                    team_teaching_type=course_data.get('team_teaching_type'),
                    is_major=course_data.get('is_major', False),
                    color=course_data.get('color', '#3B82F6'),
                    user_id=course_data.get('user_id'),
                    user_schedule_id=course_data.get('user_schedule_id')
                )
                
                db.add(course)
                saved_count += 1
            
            db.commit()
            print(f"   ✅ {saved_count}개 강의 DB 저장 완료")
            
        except Exception as e:
            db.rollback()
            print(f"   ❌ DB 저장 실패: {e}")
            raise
        finally:
            db.close()
        
        return saved_count

# 메인 실행 함수
def run_schedule_import():
    """
    시간표 import 실행
    """
    print("🚀 호서대학교 2025년 2학기 시간표 Import 시작")
    print("=" * 50)
    
    importer = ScheduleImporter()
    db = next(get_db())
    
    try:
        # Import 실행
        stats = importer.import_all_schedules(db)
        
        # 결과 출력
        print("\n" + "=" * 50)
        print("📊 Import 결과 요약")
        print(f"   처리된 파일 수: {stats['success_files']}/{stats['total_files']}")
        print(f"   저장된 과목 수: {stats['total_courses']}")
        
        if stats['errors']:
            print(f"\n❌ 오류 목록 ({len(stats['errors'])}건):")
            for error in stats['errors']:
                print(f"   - {error}")
        
        # 최종 통계
        summary = importer.get_import_summary(db)
        print(f"\n📈 최종 데이터베이스 상태:")
        print(f"   전체 개설과목 수: {summary['total_courses']}")
        print(f"   단과대학별 분포:")
        for college, count in summary['college_stats'].items():
            print(f"     - {college}: {count}개")
        
        print("\n✅ Import 완료!")
        
    except Exception as e:
        print(f"\n❌ Import 실패: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_schedule_import()
