#!/usr/bin/env python3
"""
모든 데이터의 시간 정보를 개선된 파싱 로직으로 강제 재파싱
"""

import os
import sys
import re

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import engine
from sqlalchemy import text

def parse_lecture_time_room(time_room_str: str):
    """개선된 시간 파싱 함수 (불연속 교시 처리 포함)"""
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
        
        if match1:  # 쉼표로 구분된 교시들
            day_str, periods_str, classroom = match1.groups()
            periods = [int(p) for p in periods_str.split(',')]
            
            result["day"] = day_mapping.get(day_str)
            
            # 🔧 연속 교시인지 불연속 교시인지 확인
            periods_sorted = sorted(periods)
            is_continuous = all(periods_sorted[i] + 1 == periods_sorted[i + 1] 
                              for i in range(len(periods_sorted) - 1))
            
            if is_continuous:
                # 연속 교시: 시작-끝 교시로 저장
                result["start_period"] = min(periods)
                result["end_period"] = max(periods)
            else:
                # 불연속 교시: 첫 번째 교시만 저장
                result["start_period"] = periods_sorted[0]
                result["end_period"] = periods_sorted[0]
            
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
    print("🕐 모든 데이터 시간 정보 강제 재파싱")
    print("=" * 50)
    
    with engine.connect() as conn:
        # 모든 개설과목 조회
        result = conn.execute(text('''
            SELECT id, lecture_time_room
            FROM courses 
            WHERE user_id IS NULL 
            AND lecture_time_room IS NOT NULL
        '''))
        
        all_courses = list(result)
        print(f"📊 재파싱 대상: {len(all_courses):,}개 과목")
        
        updated_count = 0
        continuous_count = 0
        discontinuous_count = 0
        
        print("🔄 재파싱 진행 중...")
        
        for course_id, lecture_time_room in all_courses:
            # 시간 정보 파싱
            time_info = parse_lecture_time_room(lecture_time_room)
            
            if time_info["day"] is not None:
                # 연속/불연속 체크
                if ',' in lecture_time_room:
                    periods_str = lecture_time_room.split('(')[0][1:]  # 요일 제거
                    if ',' in periods_str:
                        periods = [int(p) for p in periods_str.split(',')]
                        periods_sorted = sorted(periods)
                        is_continuous = all(periods_sorted[i] + 1 == periods_sorted[i + 1] 
                                          for i in range(len(periods_sorted) - 1))
                        
                        if is_continuous:
                            continuous_count += 1
                        else:
                            discontinuous_count += 1
                            if discontinuous_count <= 5:  # 처음 5개만 출력
                                print(f"  ⚠️  불연속: {lecture_time_room} -> {periods_sorted[0]}교시만")
                
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
                
                if updated_count % 500 == 0:
                    print(f"  📝 {updated_count:,}개 처리 완료...")
        
        conn.commit()
        
        print(f"\n🎉 재파싱 완료!")
        print(f"  ✅ 업데이트: {updated_count:,}개")
        print(f"  📐 연속 교시: {continuous_count:,}개")
        print(f"  ⚠️  불연속 교시: {discontinuous_count:,}개")
        
        # 불연속 교시 샘플 확인
        if discontinuous_count > 0:
            result = conn.execute(text('''
                SELECT name, lecture_time_room, day, start_period, end_period
                FROM courses 
                WHERE user_id IS NULL 
                AND lecture_time_room LIKE '%,%' 
                AND lecture_time_room LIKE '%0,%' OR lecture_time_room LIKE '%,1%'
                LIMIT 3
            '''))
            
            print(f"\n🔍 불연속 교시 샘플:")
            day_names = ['월', '화', '수', '목', '금', '토', '일']
            for row in result:
                name, lecture_time_room, day, start_period, end_period = row
                day_name = day_names[day] if day is not None else '?'
                print(f"  📚 {name}")
                print(f"    원본: {lecture_time_room}")
                print(f"    저장: {day_name}요일 {start_period}교시")

if __name__ == "__main__":
    main()
