#!/usr/bin/env python3
"""
기존 courses 데이터의 lecture_time, lecture_room 필드 백필
"""

import sys
import os
import re

# 프로젝트 루트를 Python path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.db.database import engine
from sqlalchemy import text

def parse_lecture_time_room_for_backfill(lecture_time_room: str):
    """백필용 파싱 함수 (다중 강의실 지원)"""
    if not lecture_time_room:
        return None, None
    
    day_mapping = {'월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6}
    
    # 🔧 강의실 정보 추출 완전 개선
    # 슬래시로 구분된 각 시간 블록에서 강의실 추출
    parts = lecture_time_room.split('/')
    all_classrooms = []
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
            
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
    time_pattern = r'([월화수목금토일])\s*(\d+(?:,\d+)*)'
    time_matches = re.findall(time_pattern, lecture_time_room)
    
    if not time_matches:
        return None, classroom
    
    # 다중 요일 lecture_time 생성 (예: "화3,4 목1")
    lecture_time_parts = []
    for day_korean, periods_str in time_matches:
        periods = [int(p) for p in periods_str.split(',')]
        if len(periods) == 1:
            lecture_time_parts.append(f"{day_korean}{periods[0]}")
        elif len(periods) > 1:
            # 연속 교시인지 확인
            periods_sorted = sorted(periods)
            is_continuous = all(periods_sorted[i] + 1 == periods_sorted[i + 1] for i in range(len(periods_sorted) - 1))
            
            if is_continuous:
                lecture_time_parts.append(f"{day_korean}{min(periods)}-{max(periods)}")
            else:
                # 불연속 교시는 쉼표로 구분
                periods_str_formatted = ','.join(map(str, periods_sorted))
                lecture_time_parts.append(f"{day_korean}{periods_str_formatted}")
    
    lecture_time = ' '.join(lecture_time_parts) if lecture_time_parts else None
    
    return lecture_time, lecture_room

def main():
    print("🔧 lecture_time, lecture_room 필드 백필 시작")
    
    with engine.begin() as conn:
        # 백필 대상 데이터 조회
        result = conn.execute(text("""
            SELECT id, lecture_time_room 
            FROM courses 
            WHERE user_id IS NULL 
            AND lecture_time_room IS NOT NULL
            AND lecture_time_room LIKE '%(%'
        """))
        
        courses_to_update = list(result)
        print(f"📊 백필 대상: {len(courses_to_update)}개 과목")
        
        updated_count = 0
        
        for course_id, lecture_time_room in courses_to_update:
            try:
                lecture_time, lecture_room = parse_lecture_time_room_for_backfill(lecture_time_room)
                
                # 업데이트
                update_sql = text("""
                    UPDATE courses 
                    SET lecture_time = :lecture_time, lecture_room = :lecture_room
                    WHERE id = :course_id
                """)
                
                conn.execute(update_sql, {
                    'lecture_time': lecture_time,
                    'lecture_room': lecture_room,
                    'course_id': course_id
                })
                
                updated_count += 1
                
                if updated_count % 500 == 0:
                    print(f"  📝 {updated_count}개 처리 완료...")
                    
            except Exception as e:
                print(f"❌ 과목 ID {course_id} 처리 오류: {e}")
                continue
        
        print(f"✅ 백필 완료: {updated_count}개 업데이트")
        
        # 결과 확인
        result = conn.execute(text("""
            SELECT name, lecture_time_room, lecture_time, lecture_room 
            FROM courses 
            WHERE user_id IS NULL 
            AND lecture_time_room LIKE '%/%' 
            LIMIT 3
        """))
        
        print("\n🔍 백필 결과 샘플:")
        for row in result:
            print(f"강의명: {row[0]}")
            print(f"원본: {row[1]}")
            print(f"시간: {row[2]}")
            print(f"강의실: {row[3]}")
            print("---")

if __name__ == "__main__":
    main()
