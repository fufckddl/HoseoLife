#!/usr/bin/env python3
"""
NaN 문제로 실패한 파일들을 다시 가져오는 스크립트
"""

import os
import sys

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import ScheduleImporter
from app.db.database import get_db, engine
from sqlalchemy import text

# NaN 문제로 실패한 파일들
FAILED_FILES = [
    ("교양대학", "창의교양학부", "시간표/교양대학/교양대학_창의교양학부.xls"),
    ("교양", "자유선택", "시간표/교양/자유선택.xls"),
    ("글로벌융합대학", "안전공학과", "시간표/글로벌융합대학/글로벌융합대학_안전공학과.xls"),
]

# 오타 수정 필요한 파일들 (영여영문학과 → 영어영문학과)
RENAME_FILES = [
    ("글로벌융합대학", "영여영문학과", "영어영문학과"),
]

def main():
    print("🔧 누락된 데이터 수정 및 재가져오기")
    print("=" * 60)
    
    db = next(get_db())
    importer = ScheduleImporter()
    
    total_imported = 0
    
    # 1. 오타 수정 (영여영문학과 → 영어영문학과)
    print("📝 오타 수정 중...")
    with engine.connect() as conn:
        for college, old_name, new_name in RENAME_FILES:
            result = conn.execute(text(f'''
                UPDATE courses 
                SET department = '{new_name}' 
                WHERE user_id IS NULL 
                AND college = '{college}' 
                AND department = '{old_name}'
            '''))
            conn.commit()
            print(f"✅ {college}: {old_name} → {new_name} ({result.rowcount}개 수정)")
    
    # 2. 실패한 파일들 다시 가져오기
    print(f"\n📚 실패한 파일들 재처리...")
    
    for college, department, file_path in FAILED_FILES:
        print(f"\n📚 {college} - {department}")
        
        try:
            # 기존 데이터 삭제
            with engine.connect() as conn:
                result = conn.execute(text(f'''
                    DELETE FROM courses 
                    WHERE user_id IS NULL 
                    AND college = '{college}' 
                    AND department = '{department}'
                '''))
                conn.commit()
                print(f"🗑️  기존 {result.rowcount}개 데이터 삭제")
            
            # 새로운 데이터 가져오기
            courses_data = importer.process_excel_file(
                file_path,
                college=college,
                department=department
            )
            
            print(f"📊 파싱된 과목 수: {len(courses_data)}개")
            
            # DB에 저장
            from app.models.schedule import Course
            
            for course_data in courses_data:
                course = Course(**course_data)
                db.add(course)
            
            db.commit()
            total_imported += len(courses_data)
            print(f"✅ {len(courses_data)}개 과목 저장 완료")
            
        except Exception as e:
            print(f"❌ 오류 발생: {str(e)}")
            db.rollback()
    
    db.close()
    
    # 최종 결과
    print(f"\n🎉 총 {total_imported}개 과목 추가 완료!")
    
    # 전체 통계 확인
    with engine.connect() as conn:
        result = conn.execute(text('SELECT COUNT(*) FROM courses WHERE user_id IS NULL'))
        total = result.fetchone()[0]
        print(f"📊 전체 개설과목 수: {total:,}개")

if __name__ == "__main__":
    main()
