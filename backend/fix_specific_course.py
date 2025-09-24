#!/usr/bin/env python3
"""
특정 강의(고체역학)의 시간 패턴을 재파싱하는 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from app.utils.schedule_importer import ScheduleImporter
from sqlalchemy import text

def fix_specific_course():
    """고체역학 강의 재파싱"""
    
    print("🔧 고체역학 강의 재파싱 시작")
    print("=" * 50)
    
    db = next(get_db())
    importer = ScheduleImporter()
    
    try:
        # 1. 고체역학 강의 조회
        result = db.execute(text("""
            SELECT id, name, professor, course_code, section, lecture_time_room
            FROM courses 
            WHERE name = '고체역학' AND user_id IS NULL
            ORDER BY id
        """))
        
        courses = result.fetchall()
        print(f"🔍 발견된 고체역학 강의: {len(courses)}개")
        
        for course in courses:
            course_id, name, professor, course_code, section, lecture_time_room = course
            print(f"\n📚 ID {course_id}: {name} ({professor})")
            print(f"   원본 시간: {lecture_time_room}")
            
            if lecture_time_room:
                # 2. 새로운 파싱 결과
                time_blocks = importer.parse_lecture_time_room(lecture_time_room)
                print(f"   파싱 결과: {len(time_blocks)}개 블록")
                
                day_names = ['월', '화', '수', '목', '금', '토', '일']
                for i, block in enumerate(time_blocks, 1):
                    if block["day"] is not None:
                        day_name = day_names[block["day"]]
                        classroom = block["classroom"] or "강의실 미정"
                        print(f"     블록 {i}: {day_name}요일 {block['start_period']}-{block['end_period']}교시 ({classroom})")
                
                # 3. 기존 강의 삭제
                db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": course_id})
                print(f"   ✅ 기존 강의 삭제됨")
                
                # 4. 새로운 블록들 추가
                for block in time_blocks:
                    if block["day"] is not None:
                        new_course_data = {
                            "no": "",
                            "college": "AI공과대학",  # 추정
                            "department": "전공과목",  # 추정
                            "semester": 2,
                            "year": 2024,
                            "classification": "전공필수",
                            "course_code": course_code,
                            "section": section,
                            "name": name,
                            "credits": 3,  # 추정
                            "professor": professor,
                            "lecture_time_room": lecture_time_room,
                            "day": block["day"],
                            "start_period": block["start_period"],
                            "end_period": block["end_period"],
                            "classroom": block["classroom"] or "",
                            "is_major": True,
                            "color": "#3B82F6",
                            "user_id": None,
                            "user_schedule_id": None
                        }
                        
                        # SQL INSERT
                        insert_query = text("""
                            INSERT INTO courses (
                                no, college, department, semester, year, classification,
                                course_code, section, name, credits, professor, lecture_time_room,
                                day, start_period, end_period, classroom,
                                is_major, color, user_id, user_schedule_id
                            ) VALUES (
                                :no, :college, :department, :semester, :year, :classification,
                                :course_code, :section, :name, :credits, :professor, :lecture_time_room,
                                :day, :start_period, :end_period, :classroom,
                                :is_major, :color, :user_id, :user_schedule_id
                            )
                        """)
                        
                        db.execute(insert_query, new_course_data)
                        print(f"   ✅ 새 블록 추가: {day_names[block['day']]}요일 {block['start_period']}-{block['end_period']}교시")
        
        db.commit()
        print(f"\n🎉 고체역학 강의 재파싱 완료!")
        
        # 5. 결과 확인
        print(f"\n📊 재파싱 결과 확인:")
        result2 = db.execute(text("""
            SELECT id, name, professor, day, start_period, end_period, classroom
            FROM courses 
            WHERE name = '고체역학' AND user_id IS NULL
            ORDER BY day, start_period
        """))
        
        for row in result2:
            course_id, name, professor, day, start_period, end_period, classroom = row
            if day is not None:
                day_name = day_names[day]
                classroom_display = classroom or "강의실 미정"
                print(f"   ID {course_id}: {day_name}요일 {start_period}-{end_period}교시 ({classroom_display})")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_specific_course()

