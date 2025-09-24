#!/usr/bin/env python3
"""
시간 파싱 로직 테스트
"""

import os
import sys
import re

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

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
    print("🕐 시간 파싱 로직 테스트")
    print("=" * 40)
    
    # 테스트 케이스들
    test_cases = [
        "월4(보건과학관(아산) 401-1)",  # 단일 교시
        "수3,4(제1공학관(아산) 333)",   # 연속 교시 (쉼표)
        "월1,2,3(제1공학관(아산) 401)", # 3연속 교시
        "목6-8(제1공학관(아산) 329)",   # 범위 교시 (하이픈)
        "금7,8,9,10(강의실)",          # 4연속 교시
        "토2,3,10(2호관(천안) 101)",    # 불연속 교시 ⚠️
        "토0,1,13(벤처교육관(천안) 302)", # 불연속 교시 ⚠️
        "월1,2,10(KTX캠퍼스 202)",     # 불연속 교시 ⚠️
    ]
    
    for test_case in test_cases:
        result = parse_lecture_time_room(test_case)
        
        day_names = ["월", "화", "수", "목", "금", "토", "일"]
        day_name = day_names[result["day"]] if result["day"] is not None else "None"
        
        print(f"📝 입력: {test_case}")
        print(f"   결과: {day_name}요일 {result['start_period']}-{result['end_period']}교시, {result['classroom']}")
        print()

if __name__ == "__main__":
    main()
