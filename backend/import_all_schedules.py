#!/usr/bin/env python3
"""
시간표 폴더의 모든 Excel 파일을 일괄 처리하여 DB에 추가하는 스크립트
중복 제거 및 수정된 파싱 로직 적용
"""

import sys
import os
import glob
from pathlib import Path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import ScheduleImporter
from app.db.database import get_db
from sqlalchemy import text

def import_all_schedules():
    """시간표 폴더의 모든 Excel 파일을 처리"""
    
    print("🚀 시간표 전체 Excel 파일 일괄 처리 시작")
    print("=" * 60)
    
    # 시간표 폴더 경로
    schedule_dir = Path("시간표")
    
    if not schedule_dir.exists():
        print("❌ 시간표 폴더를 찾을 수 없습니다.")
        return
    
    # 모든 .xls 파일 찾기
    excel_files = []
    
    # 각 대학별 폴더 검색
    for college_dir in schedule_dir.iterdir():
        if college_dir.is_dir():
            college_name = college_dir.name
            print(f"\n📁 {college_name} 폴더 검색 중...")
            
            xls_files = list(college_dir.glob("*.xls"))
            for file_path in xls_files:
                # 파일명에서 학과명 추출
                department = file_path.stem
                if college_name in department:
                    department = department.replace(f"{college_name}_", "")
                
                excel_files.append({
                    "path": file_path,
                    "college": college_name,
                    "department": department
                })
                print(f"   📄 {department}.xls")
    
    print(f"\n🔍 총 {len(excel_files)}개 Excel 파일 발견")
    print("=" * 60)
    
    # ScheduleImporter 인스턴스 생성
    importer = ScheduleImporter()
    
    # 전체 통계
    total_processed = 0
    total_courses = 0
    total_blocks = 0
    failed_files = []
    
    # 각 파일 처리
    for i, file_info in enumerate(excel_files, 1):
        file_path = file_info["path"]
        college = file_info["college"]
        department = file_info["department"]
        
        print(f"\n📚 [{i}/{len(excel_files)}] {college} - {department}")
        print(f"   파일: {file_path.name}")
        
        try:
            # Excel 파일 처리
            courses = importer.process_excel_file(str(file_path), college, department)
            
            if courses:
                # DB에 저장
                importer.save_courses_to_db(courses)
                
                course_count = len(courses)
                block_count = len([c for c in courses if c.get('day') is not None])
                
                print(f"   ✅ 성공: {course_count}개 강의, {block_count}개 시간 블록")
                
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
    
    print(f"\n🎉 일괄 처리 완료!")
    print("=" * 60)
    print(f"📊 처리 결과:")
    print(f"   - 처리된 파일: {total_processed}/{len(excel_files)}개")
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
        """))
        
        duplicates_removed = 0
        for row in result:
            name, professor, course_code, section, day, start_period, end_period, ids_str, count = row
            
            # ID 목록 파싱 (최신 ID 유지, 나머지 제거)
            ids = [int(id.strip()) for id in ids_str.split(',')]
            keep_id = ids[0]  # 최신 ID 유지
            remove_ids = ids[1:]  # 나머지 제거
            
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
    
    print(f"\n🎊 전체 작업 완료!")

if __name__ == "__main__":
    import_all_schedules()