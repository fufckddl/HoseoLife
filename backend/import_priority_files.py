#!/usr/bin/env python3
"""
우선순위 Excel 파일들을 먼저 처리하는 스크립트
교양 폴더의 주요 파일들 (교양선택, 공통선택, 공통필수, 추가이수, 교과교육, 교과내용)
"""

import sys
import os
from pathlib import Path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import ScheduleImporter
from app.db.database import get_db
from sqlalchemy import text

def import_priority_files():
    """우선순위 Excel 파일들을 처리"""
    
    print("🚀 우선순위 Excel 파일 처리 시작")
    print("=" * 60)
    
    # 우선순위 파일 목록 (사용자 요청)
    priority_files = [
        {"path": "시간표/교양/교양선택.xls", "college": "교양", "department": "교양선택"},
        {"path": "시간표/교양/공통선택.xls", "college": "교양", "department": "공통선택"},
        {"path": "시간표/교양/공통필수.xls", "college": "교양", "department": "공통필수"},
        {"path": "시간표/교양/추가이수.xls", "college": "교양", "department": "추가이수"},
        {"path": "시간표/교양/교과교육.xls", "college": "교양", "department": "교과교육"},
        {"path": "시간표/교양/교과내용.xls", "college": "교양", "department": "교과내용"},
    ]
    
    # ScheduleImporter 인스턴스 생성
    importer = ScheduleImporter()
    
    # 전체 통계
    total_processed = 0
    total_courses = 0
    total_blocks = 0
    failed_files = []
    
    # 각 파일 처리
    for i, file_info in enumerate(priority_files, 1):
        file_path = file_info["path"]
        college = file_info["college"]
        department = file_info["department"]
        
        print(f"\n📚 [{i}/{len(priority_files)}] {college} - {department}")
        print(f"   파일: {file_path}")
        
        try:
            # Excel 파일 처리
            courses = importer.process_excel_file(file_path, college, department)
            
            if courses:
                # DB에 저장
                saved_count = importer.save_courses_to_db(courses)
                
                course_count = len(courses)
                block_count = len([c for c in courses if c.get('day') is not None])
                
                print(f"   ✅ 성공: {course_count}개 강의, {block_count}개 시간 블록, {saved_count}개 DB 저장")
                
                total_courses += course_count
                total_blocks += block_count
            else:
                print(f"   ⚠️  빈 파일 또는 데이터 없음")
            
            total_processed += 1
            
        except Exception as e:
            print(f"   ❌ 실패: {str(e)}")
            failed_files.append({
                "file": f"{college} - {department}",
                "error": str(e)
            })
    
    print(f"\n🎉 우선순위 파일 처리 완료!")
    print("=" * 60)
    print(f"📊 처리 결과:")
    print(f"   - 처리된 파일: {total_processed}/{len(priority_files)}개")
    print(f"   - 총 강의 수: {total_courses:,}개")
    print(f"   - 총 시간 블록: {total_blocks:,}개")
    print(f"   - 실패한 파일: {len(failed_files)}개")
    
    if failed_files:
        print(f"\n❌ 실패한 파일 목록:")
        for fail in failed_files:
            print(f"   - {fail['file']}: {fail['error']}")
    
    # 중복 제거
    print(f"\n🔧 중복 데이터 제거 시작...")
    try:
        db = next(get_db())
        
        # 중복 그룹 찾기 및 제거
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
            LIMIT 10
        """))
        
        duplicates_removed = 0
        for row in result:
            name, professor, course_code, section, day, start_period, end_period, ids_str, count = row
            
            # ID 목록 파싱 (최신 ID 유지, 나머지 제거)
            ids = [int(id.strip()) for id in ids_str.split(',')]
            keep_id = ids[0]  # 최신 ID 유지
            remove_ids = ids[1:]  # 나머지 제거
            
            day_names = ['월', '화', '수', '목', '금', '토', '일']
            day_name = day_names[day] if day is not None else '?'
            print(f"   🔧 중복 제거: {name} ({professor}) {day_name}요일 {start_period}-{end_period}교시 - {len(remove_ids)}개 제거")
            
            # 중복 레코드 삭제
            for remove_id in remove_ids:
                db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": remove_id})
                duplicates_removed += 1
        
        db.commit()
        print(f"   ✅ {duplicates_removed}개 중복 레코드 제거 완료")
        
        # 최종 통계
        final_result = db.execute(text("""
            SELECT 
                COUNT(*) as total_courses,
                COUNT(DISTINCT CONCAT(name, '_', professor, '_', course_code, '_', section)) as unique_courses
            FROM courses 
            WHERE user_id IS NULL
        """))
        
        final_total, final_unique = final_result.fetchone()
        print(f"\n📊 최종 DB 상태:")
        print(f"   - 전체 개설과목: {final_total:,}개")
        print(f"   - 고유 분반: {final_unique:,}개")
        print(f"   - 블록 비율: {final_total/final_unique:.1f}배")
        
        db.close()
        
    except Exception as e:
        print(f"   ❌ 중복 제거 실패: {e}")
    
    print(f"\n🎊 우선순위 파일 처리 완료!")

if __name__ == "__main__":
    import_priority_files()

