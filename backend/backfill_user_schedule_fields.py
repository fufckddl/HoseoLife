#!/usr/bin/env python3
"""
사용자 시간표 강의들의 lecture_time, lecture_room 필드 백필
"""

import sys
import os

# 프로젝트 루트를 Python path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.db.database import engine
from sqlalchemy import text

def main():
    print("🔧 사용자 시간표 lecture_time, lecture_room 필드 백필 시작")
    
    with engine.begin() as conn:
        # 사용자 강의 중 새 필드가 없는 것들 조회
        result = conn.execute(text("""
            SELECT u.id, u.name, u.professor, u.course_code, u.section,
                   o.lecture_time, o.lecture_room
            FROM courses u
            LEFT JOIN courses o ON (
                u.name = o.name 
                AND u.professor = o.professor 
                AND u.course_code = o.course_code 
                AND u.section = o.section
                AND o.user_id IS NULL
            )
            WHERE u.user_id IS NOT NULL 
            AND (u.lecture_time IS NULL OR u.lecture_room IS NULL)
            AND o.lecture_time IS NOT NULL
        """))
        
        user_courses_to_update = list(result)
        print(f"📊 백필 대상: {len(user_courses_to_update)}개 사용자 강의")
        
        updated_count = 0
        
        for user_id, name, professor, course_code, section, orig_time, orig_room in user_courses_to_update:
            try:
                # 사용자 강의 업데이트
                update_sql = text("""
                    UPDATE courses 
                    SET lecture_time = :lecture_time, lecture_room = :lecture_room
                    WHERE id = :course_id
                """)
                
                conn.execute(update_sql, {
                    'lecture_time': orig_time,
                    'lecture_room': orig_room,
                    'course_id': user_id
                })
                
                updated_count += 1
                
                if updated_count % 10 == 0:
                    print(f"  📝 {updated_count}개 처리 완료...")
                    
            except Exception as e:
                print(f"❌ 사용자 강의 ID {user_id} 처리 오류: {e}")
                continue
        
        print(f"✅ 사용자 시간표 백필 완료: {updated_count}개 업데이트")
        
        # 결과 확인
        result = conn.execute(text("""
            SELECT name, lecture_time, lecture_room 
            FROM courses 
            WHERE user_id IS NOT NULL 
            AND lecture_time IS NOT NULL
            LIMIT 3
        """))
        
        print("\n🔍 사용자 시간표 백필 결과 샘플:")
        for row in result:
            print(f"강의명: {row[0]}")
            print(f"시간: {row[1]}")
            print(f"강의실: {row[2]}")
            print("---")

if __name__ == "__main__":
    main()
