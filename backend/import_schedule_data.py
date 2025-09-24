#!/usr/bin/env python3
"""
호서대학교 2025년 2학기 시간표 데이터 import 스크립트
"""
import sys
import os

# 프로젝트 루트를 Python path에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.schedule_importer import run_schedule_import

if __name__ == "__main__":
    print("🎓 호서대학교 2025년 2학기 시간표 Import 시작")
    print("⚠️  주의: 기존 개설과목 데이터가 모두 삭제되고 새로 import됩니다.")
    
    # 사용자 확인
    response = input("\n계속 진행하시겠습니까? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("❌ Import 취소됨")
        sys.exit(0)
    
    try:
        run_schedule_import()
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자에 의해 중단됨")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Import 실패: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
