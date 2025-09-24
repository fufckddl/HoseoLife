#!/usr/bin/env python3
"""
서로 다른 요일에 걸친 강의를 올바르게 분할하여 DB에 저장하는 스크립트
예: "금3,4(A)/목6,7(B)/토4,5(C)" -> 3개 시간 블록으로 분할
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from app.models.schedule import Course
from app.utils.schedule_importer import ScheduleImporter
from sqlalchemy import text

def fix_multi_day_courses():
    """서로 다른 요일에 걸친 강의를 올바르게 분할"""
    
    print("🌟 다중 요일 강의 수정 시작")
    print("=" * 50)
    
    db = next(get_db())
    importer = ScheduleImporter()
    
    try:
        # 다중 요일 강의 후보 찾기 ("/" 구분자 포함)
        result = db.execute(text("""
            SELECT 
                id, name, lecture_time_room, day, start_period, end_period,
                college, department, classification, professor, credits,
                course_code, section, target_grade, class_type, teaching_method,
                team_teaching_type, is_major, color, user_id, user_schedule_id,
                no, semester, year, aisw_micro_degree, general_area, classroom
            FROM courses 
            WHERE lecture_time_room LIKE '%/%'
               AND user_id IS NULL
            ORDER BY id
            LIMIT 20
        """))
        
        courses_to_update = []
        courses_to_delete = []
        
        for row in result:
            course_id = row[0]
            name = row[1]
            lecture_time_room = row[2]
            
            # 새로운 파싱 결과
            new_blocks = importer.parse_lecture_time_room(lecture_time_room or '')
            
            # 2개 이상의 블록으로 분할되는 경우만 처리
            if len(new_blocks) > 1:
                print(f"📚 {name} (ID: {course_id})")
                print(f"  원본: {lecture_time_room}")
                print(f"  분할: {len(new_blocks)}개 블록")
                
                # 기존 강의 정보 (올바른 인덱스)
                base_data = {
                    'no': row[21],
                    'name': row[1],
                    'college': row[6],
                    'department': row[7],
                    'semester': row[22],
                    'year': row[23],
                    'classification': row[8],
                    'aisw_micro_degree': row[24],
                    'general_area': row[25],
                    'professor': row[9],
                    'credits': row[10],
                    'course_code': row[11],
                    'section': row[12],
                    'target_grade': row[13],
                    'lecture_time_room': row[2],
                    'class_type': row[14],
                    'teaching_method': row[15],
                    'team_teaching_type': row[16],
                    'is_major': row[17],
                    'color': row[18],
                    'user_id': row[19],
                    'user_schedule_id': row[20]
                }
                
                # 새로운 블록들 생성
                for i, block in enumerate(new_blocks):
                    new_course_data = base_data.copy()
                    new_course_data.update({
                        'day': block['day'],
                        'start_period': block['start_period'],
                        'end_period': block['end_period'],
                        'classroom': block['classroom']
                    })
                    courses_to_update.append(new_course_data)
                    
                    day_names = ['월', '화', '수', '목', '금', '토', '일']
                    if block['day'] is not None:
                        day_name = day_names[block['day']]
                        print(f"    블록{i+1}: {day_name}{block['start_period']}-{block['end_period']}교시 ({block['classroom']})")
                
                # 원본 강의는 삭제 목록에 추가
                courses_to_delete.append(course_id)
                print()
        
        print(f"\n📊 처리 결과:")
        print(f"  - 삭제할 강의: {len(courses_to_delete)}개")
        print(f"  - 생성할 블록: {len(courses_to_update)}개")
        
        if courses_to_delete and courses_to_update:
            # 기존 강의 삭제
            for course_id in courses_to_delete:
                db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": course_id})
            
            # 새로운 블록들 생성
            for course_data in courses_to_update:
                new_course = Course(**course_data)
                db.add(new_course)
            
            db.commit()
            print(f"\n✅ {len(courses_to_delete)}개 강의를 {len(courses_to_update)}개 블록으로 분할 완료!")
        else:
            print("\n📝 처리할 다중 요일 강의가 없습니다.")
            
    except Exception as e:
        db.rollback()
        print(f"\n❌ 오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_multi_day_courses()
