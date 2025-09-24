#!/usr/bin/env python3
"""
수정된 파싱 로직 테스트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import ScheduleImporter

def test_parsing():
    """파싱 테스트"""
    
    importer = ScheduleImporter()
    importer.year = 2024
    importer.semester = 2
    
    # 문제가 있던 패턴 테스트
    test_patterns = [
        "목1,2(강의동(산학융합) 421)/화4(강의동(산학융합) 421)",
        "월1,2,3(강의실)/화4(다른강의실)",
        "금0/금10,11(강의실)",
        "월1(A)/화3(B)/금9,10(C)"
    ]
    
    print("🔧 수정된 파싱 로직 테스트")
    print("=" * 60)
    
    for pattern in test_patterns:
        print(f"\n📝 테스트 패턴: {pattern}")
        print("-" * 40)
        
        # 패턴 분리 확인
        split_patterns = pattern.split('/')
        print(f"   분리된 패턴들: {split_patterns}")
        
        try:
            results = importer.parse_lecture_time_room(pattern)
            
            day_names = ['월', '화', '수', '목', '금', '토', '일']
            
            for i, block in enumerate(results, 1):
                if block["day"] is not None:
                    day_name = day_names[block["day"]]
                    print(f"  블록 {i}: {day_name}요일 {block['start_period']}-{block['end_period']}교시 ({block['classroom']})")
                else:
                    print(f"  블록 {i}: 시간 정보 없음")
                    
        except Exception as e:
            print(f"  ❌ 오류: {e}")

if __name__ == "__main__":
    test_parsing()
