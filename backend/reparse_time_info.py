#!/usr/bin/env python3
"""
기존 데이터의 시간 정보를 개선된 파싱 로직으로 다시 처리
"""

import os
import sys
import re

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine
from sqlalchemy import text

def parse_lecture_time_room(time_room_str: str):
    """개선된 시간 파싱 함수"""
    if not time_room_str:
        return {"day": None, "start_period": None, "end_period": None, "classroom": None}
    
    # 요일 매핑
    day_mapping = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}
    
    result = {"day": None, "start_period": None, "end_period": None, "classroom": None}
    
    try:
        # 🔧 다양한 시간 패턴 처리
        # 패턴 1: "월3,4,5(강의실)" - 연속 교시 (쉼표로 구분)
        pattern1 = r'([월화수목금토일])(\d+(?:,\d+)*)\(([^)]*)\)'
        match1 = re.search(pattern1, str(time_room_str))
        
        # 패턴 2: "월4-5(강의실)" - 범위 교시 (하이픈으로 구분)  
        pattern2 = r'([월화수목금토일])(\d+)-(\d+)\(([^)]*)\)'
        match2 = re.search(pattern2, str(time_room_str))
        
        # 패턴 3: "월4(강의실)" - 단일 교시
        pattern3 = r'([월화수목금토일])(\d+)\(([^)]*)\)'
        match3 = re.search(pattern3, str(time_room_str))
        
        if match1:  # 쉼표로 구분된 연속 교시
            day_str, periods_str, classroom = match1.groups()
            periods = [int(p) for p in periods_str.split(',')]
            
            result["day"] = day_mapping.get(day_str)
            result["start_period"] = min(periods)
            result["end_period"] = max(periods)
            result["classroom"] = classroom.strip()
            
        elif match2:  # 하이픈으로 구분된 범위 교시
            day_str, start_str, end_str, classroom = match2.groups()
            
            result["day"] = day_mapping.get(day_str)
            result["start_period"] = int(start_str)
            result["end_period"] = int(end_str)
            result["classroom"] = classroom.strip()
            
        elif match3:  # 단일 교시
            day_str, period_str, classroom = match3.groups()
            
            result["day"] = day_mapping.get(day_str)
            result["start_period"] = int(period_str)
            result["end_period"] = int(period_str)
            result["classroom"] = classroom.strip()
            
    except Exception as e:
        print(f"시간 파싱 오류: {time_room_str} -> {e}")
    
    return result

def main():
    print("🕐 기존 데이터 시간 정보 재파싱")
    print("=" * 50)
    
    with engine.connect() as conn:
        # 시간 정보가 없는 과목들 조회
        result = conn.execute(text('''
            SELECT id, lecture_time_room
            FROM courses 
            WHERE user_id IS NULL 
            AND day IS NULL 
            AND lecture_time_room IS NOT NULL
        '''))
        
        courses_to_update = list(result)
        print(f"📊 재파싱 대상: {len(courses_to_update):,}개 과목")
        
        if len(courses_to_update) == 0:
            print("✅ 모든 과목의 시간 정보가 이미 파싱되어 있습니다.")
            return
        
        updated_count = 0
        failed_count = 0
        
        print("🔄 재파싱 진행 중...")
        
        for course_id, lecture_time_room in courses_to_update:
            # 시간 정보 파싱
            time_info = parse_lecture_time_room(lecture_time_room)
            
            if time_info["day"] is not None:
                # DB 업데이트
                update_sql = text('''
                    UPDATE courses 
                    SET day = :day, 
                        start_period = :start_period, 
                        end_period = :end_period, 
                        classroom = :classroom
                    WHERE id = :course_id
                ''')
                
                conn.execute(update_sql, {
                    'day': time_info["day"],
                    'start_period': time_info["start_period"],
                    'end_period': time_info["end_period"],
                    'classroom': time_info["classroom"],
                    'course_id': course_id
                })
                updated_count += 1
                
                if updated_count % 100 == 0:
                    print(f"  📝 {updated_count:,}개 처리 완료...")
            else:
                failed_count += 1
                if failed_count <= 5:  # 처음 5개만 출력
                    print(f"  ❌ 파싱 실패: {lecture_time_room}")
        
        conn.commit()
        
        print(f"\n🎉 재파싱 완료!")
        print(f"  ✅ 성공: {updated_count:,}개")
        print(f"  ❌ 실패: {failed_count:,}개")
        
        # 최종 통계
        result = conn.execute(text('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN day IS NOT NULL THEN 1 ELSE 0 END) as parsed,
                SUM(CASE WHEN day IS NULL AND lecture_time_room IS NOT NULL THEN 1 ELSE 0 END) as unparsed
            FROM courses 
            WHERE user_id IS NULL
        '''))
        
        total, parsed, unparsed = result.fetchone()
        print(f"\n📊 최종 시간 파싱 통계:")
        print(f"  전체 과목: {total:,}개")
        print(f"  파싱 성공: {parsed:,}개 ({parsed/total*100:.1f}%)")
        print(f"  파싱 실패: {unparsed:,}개 ({unparsed/total*100:.1f}%)")

if __name__ == "__main__":
    main()
