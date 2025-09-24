#!/usr/bin/env python3
"""
모든 강의의 색상을 고유하게 업데이트
"""

import sys
import os

# 프로젝트 루트를 Python path에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.db.database import engine
from sqlalchemy import text

def generate_course_color(course_name: str, course_code: str = None) -> str:
    """
    과목명과 학수번호를 기반으로 색상 생성
    """
    # 🎨 밝은 색상 팔레트 (검은 글자와 대비가 좋은 색상들만)
    colors = [
        '#FFE5E5', '#E5F9F6', '#E5F3FF', '#F0FFF0', '#FFF8DC',
        '#F0E6FF', '#E5F9F6', '#FFF9C4', '#F5E6FF', '#E3F2FD',
        '#FFF3E0', '#E8F5E8', '#FFE0E6', '#E1F5FE', '#F3E5F5',
        '#E8F6F3', '#FFF8E1', '#FFEBEE', '#E8EAF6', '#F1F8E9',
        '#FFF3E0', '#FCE4EC', '#E0F2F1', '#F9FBE7', '#FFF8E1',
        '#E1F5FE', '#F3E5F5', '#FFECB3', '#C8E6C9', '#BBDEFB',
        '#F8BBD0', '#B2DFDB', '#DCEDC8', '#FFE0B2', '#D1C4E9',
        '#C5E1A5', '#FFCDD2', '#B3E5FC', '#E1BEE7', '#A5D6A7'
    ]
    
    # 과목명과 학수번호를 조합하여 해시값 생성
    text = f"{course_name}_{course_code or ''}"
    hash_value = hash(text) % len(colors)
    
    return colors[hash_value]

def main():
    print("🎨 강의 색상 다양화 업데이트 시작")
    
    with engine.begin() as conn:
        # 모든 강의 조회 (개설과목 + 사용자 강의)
        result = conn.execute(text("""
            SELECT id, name, course_code, color
            FROM courses 
            ORDER BY id
        """))
        
        all_courses = list(result)
        print(f"📊 색상 업데이트 대상: {len(all_courses)}개 강의")
        
        updated_count = 0
        color_usage = {}
        
        for course_id, name, course_code, current_color in all_courses:
            try:
                # 새로운 색상 생성
                new_color = generate_course_color(name, course_code)
                
                # 색상 사용 통계
                if new_color in color_usage:
                    color_usage[new_color] += 1
                else:
                    color_usage[new_color] = 1
                
                # 색상이 다른 경우에만 업데이트
                if current_color != new_color:
                    update_sql = text("""
                        UPDATE courses 
                        SET color = :new_color
                        WHERE id = :course_id
                    """)
                    
                    conn.execute(update_sql, {
                        'new_color': new_color,
                        'course_id': course_id
                    })
                    
                    updated_count += 1
                
                if updated_count % 500 == 0 and updated_count > 0:
                    print(f"  🎨 {updated_count}개 색상 업데이트 완료...")
                    
            except Exception as e:
                print(f"❌ 강의 ID {course_id} 색상 업데이트 오류: {e}")
                continue
        
        print(f"✅ 색상 업데이트 완료: {updated_count}개 변경")
        
        # 색상 분포 확인
        print(f"\n🎨 색상 분포 (상위 10개):")
        sorted_colors = sorted(color_usage.items(), key=lambda x: x[1], reverse=True)
        for color, count in sorted_colors[:10]:
            print(f"  {color}: {count}개 강의")
        
        # 결과 확인
        result = conn.execute(text("""
            SELECT DISTINCT color, COUNT(*) as count
            FROM courses 
            GROUP BY color 
            ORDER BY count DESC
            LIMIT 5
        """))
        
        print(f"\n🔍 업데이트 후 색상 분포:")
        for row in result:
            print(f"  {row[0]}: {row[1]}개")

if __name__ == "__main__":
    main()
