#!/usr/bin/env python3
"""
누락된 다중 블록 강의들을 일괄 수정하는 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine, get_db
from sqlalchemy import text
from app.utils.schedule_importer import ScheduleImporter
from app.models.schedule import Course
import traceback

def fix_missing_blocks():
    """누락된 블록들을 찾아서 수정"""
    
    print('🔧 누락된 다중 블록 강의 일괄 수정')
    print('=' * 60)
    
    with engine.connect() as conn:
        # 1. 블록이 누락된 강의들 찾기
        result = conn.execute(text('''
            SELECT DISTINCT lecture_time_room, 
                   MIN(id) as sample_id,
                   MIN(name) as name,
                   MIN(professor) as professor,
                   MIN(course_code) as course_code,
                   MIN(section) as section,
                   COUNT(*) as current_blocks
            FROM courses 
            WHERE lecture_time_room LIKE '%/%' 
              AND user_id IS NULL
            GROUP BY lecture_time_room
            HAVING COUNT(*) = 1  -- 1개 블록만 있는 경우
            ORDER BY LENGTH(lecture_time_room) DESC
        '''))
        
        missing_courses = list(result)
        print(f'📊 블록이 누락된 강의: {len(missing_courses)}개')
        
        if not missing_courses:
            print('✅ 누락된 블록이 없습니다.')
            return
        
        # 2. 파싱 도구 준비
        importer = ScheduleImporter()
        importer.year = 2024
        importer.semester = 2
        
        fixed_count = 0
        error_count = 0
        
        for course_info in missing_courses:
            time_room, sample_id, name, professor, course_code, section, current_blocks = course_info
            
            try:
                print(f'\n🔧 수정 중: {name} ({professor})')
                print(f'   원본: {time_room}')
                
                # 3. 기존 블록 정보 가져오기
                base_result = conn.execute(text('''
                    SELECT no, college, department, semester, year, classification,
                           aisw_micro_degree, general_area, target_grade, credits,
                           class_type, teaching_method, team_teaching_type, 
                           is_major, color
                    FROM courses 
                    WHERE id = :id
                '''), {'id': sample_id})
                
                base_info = base_result.fetchone()
                if not base_info:
                    print(f'   ❌ 기존 블록 정보를 찾을 수 없음')
                    error_count += 1
                    continue
                
                # 4. 새로 파싱
                blocks = importer.parse_lecture_time_room(time_room)
                expected_blocks = len(time_room.split('/'))
                
                if len(blocks) != expected_blocks:
                    print(f'   ⚠️  파싱 결과 불일치: 예상 {expected_blocks} → 실제 {len(blocks)}')
                
                if len(blocks) <= 1:
                    print(f'   ⚠️  추가할 블록이 없음')
                    continue
                
                # 5. 기존 블록 삭제
                conn.execute(text('''
                    DELETE FROM courses 
                    WHERE name = :name 
                      AND professor = :professor 
                      AND course_code = :course_code 
                      AND section = :section 
                      AND user_id IS NULL
                '''), {
                    'name': name,
                    'professor': professor,
                    'course_code': course_code,
                    'section': section
                })
                
                # 6. 새 블록들 추가
                day_names = ['월', '화', '수', '목', '금', '토', '일']
                
                for i, block in enumerate(blocks):
                    # Course 데이터 준비
                    course_data = {
                        'no': base_info[0] or '',
                        'college': base_info[1] or '',
                        'department': base_info[2] or '',
                        'semester': base_info[3] or 2,
                        'year': base_info[4] or 2024,
                        'classification': base_info[5],
                        'aisw_micro_degree': base_info[6],
                        'general_area': base_info[7],
                        'course_code': course_code,
                        'section': section,
                        'target_grade': base_info[8] or '',
                        'name': name,
                        'credits': base_info[9] or 0,
                        'professor': professor,
                        'lecture_time_room': time_room,
                        'class_type': base_info[10],
                        'teaching_method': base_info[11],
                        'team_teaching_type': base_info[12],
                        'day': block.get('day'),
                        'start_period': block.get('start_period'),
                        'end_period': block.get('end_period'),
                        'classroom': block.get('classroom', ''),
                        'is_major': base_info[13] or False,
                        'color': base_info[14] or '#3B82F6',
                        'user_id': None,
                        'user_schedule_id': None
                    }
                    
                    # DB에 삽입
                    conn.execute(text('''
                        INSERT INTO courses (
                            no, college, department, semester, year, classification,
                            aisw_micro_degree, general_area, course_code, section, target_grade,
                            name, credits, professor, lecture_time_room, class_type,
                            teaching_method, team_teaching_type, day, start_period, end_period,
                            classroom, is_major, color, user_id, user_schedule_id
                        ) VALUES (
                            :no, :college, :department, :semester, :year, :classification,
                            :aisw_micro_degree, :general_area, :course_code, :section, :target_grade,
                            :name, :credits, :professor, :lecture_time_room, :class_type,
                            :teaching_method, :team_teaching_type, :day, :start_period, :end_period,
                            :classroom, :is_major, :color, :user_id, :user_schedule_id
                        )
                    '''), course_data)
                    
                    # 블록 정보 출력
                    day = block.get('day')
                    if day is not None:
                        day_name = day_names[day]
                        start_p = block.get('start_period')
                        end_p = block.get('end_period')
                        classroom = block.get('classroom', '')
                        
                        time_str = f'{start_p}교시' if start_p == end_p else f'{start_p}-{end_p}교시'
                        print(f'      블록{i+1}: {day_name}요일 {time_str} ({classroom})')
                
                conn.commit()
                print(f'   ✅ 수정 완료: {len(blocks)}개 블록')
                fixed_count += 1
                
            except Exception as e:
                print(f'   ❌ 수정 실패: {e}')
                conn.rollback()
                error_count += 1
                # traceback.print_exc()
        
        print(f'\n📊 수정 완료:')
        print(f'   성공: {fixed_count}개')
        print(f'   실패: {error_count}개')
        print(f'   총계: {len(missing_courses)}개')

if __name__ == '__main__':
    fix_missing_blocks()

