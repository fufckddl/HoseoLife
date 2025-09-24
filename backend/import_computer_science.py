#!/usr/bin/env python3
"""
컴퓨터공학부 데이터만 다시 가져오는 스크립트
"""

import os
import sys

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import ScheduleImporter
from app.db.database import get_db, engine
from sqlalchemy import text

def main():
    print("🖥️  컴퓨터공학부 데이터 다시 가져오기")
    print("=" * 50)
    
    # 기존 컴퓨터공학부 데이터 삭제
    print("🗑️  기존 컴퓨터공학부 데이터 삭제 중...")
    with engine.connect() as conn:
        result = conn.execute(text('''
            DELETE FROM courses 
            WHERE user_id IS NULL 
            AND college = 'AI공과대학' 
            AND department = '컴퓨터공학부'
        '''))
        conn.commit()
        print(f"✅ {result.rowcount}개 데이터 삭제 완료")
    
    # 새로운 데이터 가져오기
    print("\n📚 컴퓨터공학부 데이터 가져오기...")
    
    db = next(get_db())
    try:
        importer = ScheduleImporter()
        
        # 컴퓨터공학부 파일 처리
        file_path = "시간표/AI공과대학/AI공과대학_컴퓨터공학부.xls"
        courses_data = importer.process_excel_file(
            file_path,
            college="AI공과대학",
            department="컴퓨터공학부"
        )
        
        print(f"📊 파싱된 과목 수: {len(courses_data)}개")
        
        # DB에 저장
        from app.models.schedule import Course
        
        for course_data in courses_data:
            course = Course(**course_data)
            db.add(course)
        
        db.commit()
        print(f"✅ {len(courses_data)}개 과목 저장 완료")
        
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        db.rollback()
    finally:
        db.close()
    
    # 결과 확인
    print("\n📊 결과 확인:")
    with engine.connect() as conn:
        result = conn.execute(text('''
            SELECT COUNT(*) 
            FROM courses 
            WHERE user_id IS NULL 
            AND college = 'AI공과대학' 
            AND department = '컴퓨터공학부'
        '''))
        count = result.fetchone()[0]
        print(f"🖥️  컴퓨터공학부 과목 수: {count}개")
        
        if count > 0:
            result = conn.execute(text('''
                SELECT name, professor, lecture_time_room 
                FROM courses 
                WHERE user_id IS NULL 
                AND college = 'AI공과대학' 
                AND department = '컴퓨터공학부'
                LIMIT 5
            '''))
            print(f"\n📚 샘플 과목:")
            for row in result:
                print(f"  📖 {row[0]} - {row[1]} - {row[2]}")

if __name__ == "__main__":
    main()
