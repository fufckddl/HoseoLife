import re
from typing import Optional, Tuple, Dict, Any

def parse_lecture_time_room(lecture_time_room: str) -> Dict[str, Any]:
    """
    강의시간(강의실) 문자열을 파싱하여 요일, 시간, 강의실 정보를 추출
    
    예시 입력: "월1,2/화3,4/수5,6(공학관A101)"
    예시 입력: "월1,2(공학관A101)/화3,4(공학관A102)"
    """
    if not lecture_time_room:
        return {
            'day': None,
            'start_period': None,
            'end_period': None,
            'classroom': None,
            'lecture_time': None,
            'lecture_room': None
        }
    
    # 요일 매핑
    day_mapping = {
        '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6
    }
    
    # 🔧 강의실 정보 추출 완전 개선
    # 기존 방식으로 첫 번째 강의실 추출 (호환성)
    classroom_match = re.search(r'\(([^)]+)\)', lecture_time_room)
    classroom = classroom_match.group(1) if classroom_match else None
    
    # 🆕 완전한 강의실 추출: 정확한 패턴 매칭
    # 슬래시로 구분된 각 시간 블록에서 강의실 추출
    parts = lecture_time_room.split('/')
    all_classrooms = []
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
            
        # 각 부분에서 강의실 정보 추출
        # 패턴: 요일교시(건물명(캠퍼스) 호수) 또는 요일교시(건물명 호수)
        
        # 🔧 강의실 정보 추출 (완전한 패턴 매칭)
        
        # 패턴 1: 괄호 안에 모든 정보 포함 (예: (보건과학관(아산) 402))
        full_room_pattern = r'\(([^)]+\([^)]+\)\s+\d+)\)'
        full_room_match = re.search(full_room_pattern, part)
        
        if full_room_match:
            full_room = full_room_match.group(1)
            if full_room not in all_classrooms:
                all_classrooms.append(full_room)
        else:
            # 패턴 2: 괄호 안에만 모든 정보 (예: (사이버강의동 1015))
            simple_pattern = r'\(([^)]+)\)'
            simple_match = re.search(simple_pattern, part)
            if simple_match:
                room_info = simple_match.group(1)
                if room_info not in all_classrooms:
                    all_classrooms.append(room_info)
    
    lecture_room = ' / '.join(all_classrooms) if all_classrooms else None
    
    # 시간 정보 추출 (다중 요일 지원)
    # 요일과 숫자 사이의 공백 허용
    time_pattern = r'([월화수목금토일])\s*(\d+(?:,\d+)*)'
    time_matches = re.findall(time_pattern, lecture_time_room)
    
    if not time_matches:
        return {
            'day': None,
            'start_period': None,
            'end_period': None,
            'classroom': classroom,
            'lecture_time': None,
            'lecture_room': classroom
        }
    
    # 첫 번째 시간 정보를 사용 (여러 요일이 있는 경우 첫 번째)
    day_korean, periods_str = time_matches[0]
    day = day_mapping.get(day_korean)
    
    # 교시 정보 파싱 (예: "1,2" -> [1, 2])
    periods = [int(p) for p in periods_str.split(',')]
    start_period = min(periods)
    end_period = max(periods)
    
    # 🆕 다중 요일 lecture_time 생성 (예: "화3,4 목1")
    lecture_time_parts = []
    for day_korean, periods_str in time_matches:
        periods = [int(p) for p in periods_str.split(',')]
        if len(periods) == 1:
            lecture_time_parts.append(f"{day_korean}{periods[0]}")
        elif len(periods) > 1 and all(periods[i] + 1 == periods[i + 1] for i in range(len(periods) - 1)):
            # 연속 교시
            lecture_time_parts.append(f"{day_korean}{min(periods)}-{max(periods)}")
        else:
            # 불연속 교시
            lecture_time_parts.append(f"{day_korean}{','.join(map(str, periods))}")
    
    lecture_time = ' '.join(lecture_time_parts) if lecture_time_parts else None
    
    return {
        'day': day,
        'start_period': start_period,
        'end_period': end_period,
        'classroom': classroom,
        'lecture_time': lecture_time,
        'lecture_room': lecture_room  # 🆕 모든 강의실 포함
    }

def determine_is_major(classification: str, general_area: str) -> bool:
    """
    이수구분과 교양영역을 기반으로 전공과목 여부 판단
    """
    if not classification:
        return False
    
    # 전공 관련 키워드
    major_keywords = ['전공', '전선', '전필', '전공선택', '전공필수']
    
    # 교양 관련 키워드
    general_keywords = ['교양', '교선', '교필', '교양선택', '교양필수', '기초', '핵심']
    
    classification_lower = classification.lower()
    
    # 전공 키워드가 포함된 경우
    for keyword in major_keywords:
        if keyword in classification_lower:
            return True
    
    # 교양 키워드가 포함된 경우
    for keyword in general_keywords:
        if keyword in classification_lower:
            return False
    
    # 교양영역이 있는 경우 교양으로 판단
    if general_area:
        return False
    
    # 기본값은 전공으로 판단
    return True

def generate_course_color(course_name: str, course_code: str = None) -> str:
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

def parse_csv_row_to_course(row: Dict[str, str], user_id: int, user_schedule_id: int = None) -> Dict[str, Any]:
    """
    CSV 행을 Course 객체로 변환
    """
    # 강의시간(강의실) 파싱
    lecture_time_room = row.get('강의시간(강의실)', '')
    parsed_time = parse_lecture_time_room(lecture_time_room)
    
    # 이수구분 기반 전공 여부 판단
    classification = row.get('이수구분', '')
    general_area = row.get('교양영역', '')
    is_major = determine_is_major(classification, general_area)
    
    # 색상 생성
    course_name = row.get('교과목명', '')
    course_code = row.get('학수번호', '')
    color = generate_course_color(course_name, course_code)
    
    # 학점 파싱
    credits_str = row.get('학점', '0')
    try:
        credits = int(credits_str)
    except (ValueError, TypeError):
        credits = 0
    
    result = {
        'no': row.get('NO', ''),
        'classification': classification,
        'aisw_micro_degree': row.get('AISW마이크로디그리', ''),
        'general_area': general_area,
        'course_code': course_code,
        'section': row.get('분반', ''),
        'target_grade': row.get('개설학년', ''),
        'name': course_name,
        'credits': credits,
        'professor': row.get('교수명', ''),
        'lecture_time_room': lecture_time_room,
        'class_type': row.get('수업구분', ''),
        'teaching_method': row.get('수업방법', ''),
        'team_teaching_type': row.get('팀티칭 유형', ''),
        'day': parsed_time['day'],
        'start_period': parsed_time['start_period'],
        'end_period': parsed_time['end_period'],
        'classroom': parsed_time['classroom'],
        'lecture_time': parsed_time.get('lecture_time'),
        'lecture_room': parsed_time.get('lecture_room'),
        'is_major': is_major,
        'color': color,
        'user_id': user_id,
        'user_schedule_id': user_schedule_id
    }
    return result
