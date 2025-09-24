#!/usr/bin/env python3
"""
복잡한 시간 패턴 분석 및 중복 제거
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from sqlalchemy import text

def analyze_complex_patterns():
    """복잡한 시간 패턴 분석"""
    
    print("🔧 복잡한 시간 패턴 분석 및 중복 제거")
    print("=" * 60)
    
    db = next(get_db())
    
    try:
        # 1. 중복 제거
        print("🧹 중복 데이터 제거 중...")
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
        
        duplicates_removed = 0
        for row in result:
            name, professor, course_code, section, day, start_period, end_period, ids_str, count = row
            
            # ID 목록 파싱 (최신 ID 유지, 나머지 제거)
            ids = [int(id.strip()) for id in ids_str.split(',')]
            keep_id = ids[0]  # 최신 ID 유지
            remove_ids = ids[1:]  # 나머지 제거
            
            if len(remove_ids) > 0:
                print(f"   🔧 {name} ({professor}) - {len(remove_ids)}개 중복 제거")
                
                # 중복 레코드 삭제
                for remove_id in remove_ids:
                    db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": remove_id})
                    duplicates_removed += 1
        
        db.commit()
        print(f"✅ {duplicates_removed}개 중복 레코드 제거 완료")
        
        # 2. 복잡한 패턴 분석
        print(f"\n🔍 복잡한 패턴 분석:")
        print("=" * 50)
        
        # 불연속 교시 패턴
        print("📊 1. 불연속 교시 패턴 (같은 요일, 떨어진 시간):")
        result1 = db.execute(text("""
            SELECT name, professor, course_code, section, lecture_time_room,
                   GROUP_CONCAT(CONCAT(
                       CASE day 
                           WHEN 0 THEN '월'
                           WHEN 1 THEN '화'
                           WHEN 2 THEN '수'
                           WHEN 3 THEN '목'
                           WHEN 4 THEN '금'
                           WHEN 5 THEN '토'
                           WHEN 6 THEN '일'
                       END,
                       start_period, 
                       CASE WHEN start_period = end_period THEN '교시' 
                            ELSE CONCAT('-', end_period, '교시') END
                   ) ORDER BY day, start_period SEPARATOR ', ') as parsed_blocks
            FROM courses 
            WHERE user_id IS NULL 
              AND lecture_time_room REGEXP '([월화수목금토일][0-9]+,[0-9]+.*,[0-9]+)'
              AND lecture_time_room NOT LIKE '%/%'
            GROUP BY name, professor, course_code, section
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 10
        """))
        
        for row in result1:
            name, professor, course_code, section, time_room, parsed_blocks = row
            print(f"   📚 {name} ({professor})")
            print(f"      원본: {time_room}")
            print(f"      블록: {parsed_blocks}")
            print()
        
        # 다중 요일 패턴
        print("📊 2. 다중 요일 패턴 (서로 다른 요일):")
        result2 = db.execute(text("""
            SELECT name, professor, course_code, section, lecture_time_room,
                   GROUP_CONCAT(CONCAT(
                       CASE day 
                           WHEN 0 THEN '월'
                           WHEN 1 THEN '화'
                           WHEN 2 THEN '수'
                           WHEN 3 THEN '목'
                           WHEN 4 THEN '금'
                           WHEN 5 THEN '토'
                           WHEN 6 THEN '일'
                       END,
                       start_period, 
                       CASE WHEN start_period = end_period THEN '교시' 
                            ELSE CONCAT('-', end_period, '교시') END
                   ) ORDER BY day, start_period SEPARATOR ', ') as parsed_blocks
            FROM courses 
            WHERE user_id IS NULL 
              AND lecture_time_room LIKE '%/%'
            GROUP BY name, professor, course_code, section
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 10
        """))
        
        for row in result2:
            name, professor, course_code, section, time_room, parsed_blocks = row
            print(f"   📚 {name} ({professor})")
            print(f"      원본: {time_room}")
            print(f"      블록: {parsed_blocks}")
            print()
        
        # 3. 최종 통계
        final_result = db.execute(text("""
            SELECT 
                COUNT(*) as total_courses,
                COUNT(DISTINCT CONCAT(name, '_', professor, '_', course_code, '_', section)) as unique_courses,
                SUM(CASE WHEN lecture_time_room LIKE '%/%' THEN 1 ELSE 0 END) as multi_day_courses,
                SUM(CASE WHEN lecture_time_room REGEXP '([월화수목금토일][0-9]+,[0-9]+.*,[0-9]+)' 
                         AND lecture_time_room NOT LIKE '%/%' THEN 1 ELSE 0 END) as discontinuous_courses
            FROM courses 
            WHERE user_id IS NULL
        """))
        
        total, unique, multi_day, discontinuous = final_result.fetchone()
        
        print("📊 최종 패턴 통계:")
        print(f"   - 전체 개설과목: {total:,}개")
        print(f"   - 고유 분반: {unique:,}개")
        print(f"   - 다중 요일 강의: {multi_day:,}개")
        print(f"   - 불연속 교시 강의: {discontinuous:,}개")
        print(f"   - 블록 비율: {total/unique:.1f}배")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    analyze_complex_patterns()

