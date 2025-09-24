#!/usr/bin/env python3
"""
개설과목에서 중복 데이터를 제거하는 스크립트
같은 강의명, 교수, 학수번호, 분반, 시간을 가진 중복 레코드 중 최신 것만 유지
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from sqlalchemy import text

def remove_duplicate_courses():
    """중복 개설과목 제거"""
    
    print("🔧 중복 개설과목 제거 시작")
    print("=" * 50)
    
    db = next(get_db())
    
    try:
        # 중복 그룹 찾기
        result = db.execute(text("""
            SELECT 
                name, professor, course_code, section, day, start_period, end_period,
                GROUP_CONCAT(id ORDER BY id DESC) as ids,
                COUNT(*) as count
            FROM courses 
            WHERE user_id IS NULL
            GROUP BY name, professor, course_code, section, day, start_period, end_period
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        """))
        
        total_duplicates = 0
        total_removed = 0
        
        for row in result:
            name, professor, course_code, section, day, start_period, end_period, ids_str, count = row
            
            # ID 목록 파싱 (최신 ID가 첫 번째)
            ids = [int(id.strip()) for id in ids_str.split(',')]
            keep_id = ids[0]  # 가장 최신 ID 유지
            remove_ids = ids[1:]  # 나머지 제거
            
            day_names = ['월', '화', '수', '목', '금', '토', '일']
            day_name = day_names[day] if day is not None else '?'
            
            print(f"📚 {name} ({professor})")
            print(f"   {course_code}-{section} {day_name}요일 {start_period}-{end_period}교시")
            print(f"   중복 {count}개: 유지 ID {keep_id}, 제거 {len(remove_ids)}개")
            
            # 중복 레코드 삭제
            for remove_id in remove_ids:
                db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": remove_id})
                total_removed += 1
            
            total_duplicates += count
            print()
        
        db.commit()
        
        print(f"\n📊 중복 제거 결과:")
        print(f"  - 중복 그룹: {len(list(result))}개")
        print(f"  - 총 중복 레코드: {total_duplicates}개")
        print(f"  - 제거된 레코드: {total_removed}개")
        print(f"  - 유지된 레코드: {total_duplicates - total_removed}개")
        
        # 최종 통계
        final_result = db.execute(text("""
            SELECT 
                COUNT(*) as total_courses,
                COUNT(DISTINCT CONCAT(name, '_', professor, '_', course_code, '_', section)) as unique_courses
            FROM courses 
            WHERE user_id IS NULL
        """))
        
        final_total, final_unique = final_result.fetchone()
        print(f"\n✅ 최종 결과:")
        print(f"  - 전체 개설과목: {final_total}개")
        print(f"  - 고유 분반: {final_unique}개") 
        print(f"  - 블록 비율: {final_total/final_unique:.1f}배")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    remove_duplicate_courses()
