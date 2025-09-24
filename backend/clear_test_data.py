#!/usr/bin/env python3
"""
테스트 배포를 위한 테스트 데이터 정리 스크립트
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models import (
    # 사용자 관련
    user,
    # 게시글 관련
    post, comment, heart, scrap, view_log,
    # 채팅 관련
    group_chat, chat,
    # 기타
    alarm, contact, report, board_request, email_verification
)
from app.db.database import Base

def clear_test_data():
    """테스트 데이터를 정리합니다."""
    db = SessionLocal()
    
    try:
        print("🧹 테스트 데이터 정리 시작...")
        
        # 1. 사용자 데이터 (관리자 제외)
        print("👤 테스트 사용자 데이터 삭제 중...")
        test_users = db.query(user.User).filter(user.User.is_admin == False).all()
        for u in test_users:
            print(f"  - 사용자 삭제: {u.nickname} ({u.email})")
        db.query(user.User).filter(user.User.is_admin == False).delete()
        
        # 2. 게시글 관련 데이터
        print("📝 게시글 관련 데이터 삭제 중...")
        db.query(post.Post).delete()
        db.query(comment.Comment).delete()
        db.query(heart.Heart).delete()
        db.query(scrap.Scrap).delete()
        db.query(view_log.ViewLog).delete()
        
        # 3. 채팅 관련 데이터
        print("💬 채팅 관련 데이터 삭제 중...")
        db.query(group_chat.ChatMessage).delete()
        db.query(group_chat.Membership).delete()
        db.query(group_chat.Room).delete()
        db.query(group_chat.GroupCreationRequest).delete()
        db.query(chat.UserRoomLeaveTime).delete()
        
        # 4. 기타 데이터
        print("🔔 기타 데이터 삭제 중...")
        db.query(alarm.Alarm).delete()
        db.query(contact.Contact).delete()
        db.query(report.Report).delete()
        db.query(board_request.BoardRequest).delete()
        db.query(email_verification.EmailVerification).delete()
        
        # 5. 관리자 계정 확인
        admin_users = db.query(user.User).filter(user.User.is_admin == True).all()
        print(f"👑 관리자 계정 유지: {len(admin_users)}개")
        for admin in admin_users:
            print(f"  - {admin.nickname} ({admin.email})")
        
        # 변경사항 커밋
        db.commit()
        print("✅ 테스트 데이터 정리 완료!")
        
        # 6. 데이터베이스 상태 확인
        print("\n📊 정리 후 데이터베이스 상태:")
        print(f"  - 사용자 수: {db.query(user.User).count()}")
        print(f"  - 게시글 수: {db.query(post.Post).count()}")
        print(f"  - 댓글 수: {db.query(comment.Comment).count()}")
        print(f"  - 채팅방 수: {db.query(group_chat.Room).count()}")
        print(f"  - 채팅 메시지 수: {db.query(group_chat.ChatMessage).count()}")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_sample_admin():
    """샘플 관리자 계정을 생성합니다."""
    from app.routers.user import get_password_hash
    
    db = SessionLocal()
    try:
        # 기존 관리자 확인
        existing_admin = db.query(user.User).filter(user.User.is_admin == True).first()
        if existing_admin:
            print(f"👑 기존 관리자 계정 존재: {existing_admin.nickname}")
            return
        
        # 새 관리자 계정 생성
        admin_user = user.User(
            email="admin@hoseolife.kr",
            nickname="관리자",
            hashed_password=get_password_hash("admin123!"),
            is_admin=True,
            university="호서대학교",
            is_premium=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"✅ 관리자 계정 생성 완료: {admin_user.nickname} ({admin_user.email})")
        print("   비밀번호: admin123!")
        
    except Exception as e:
        print(f"❌ 관리자 계정 생성 오류: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="테스트 데이터 정리 스크립트")
    parser.add_argument("--admin-only", action="store_true", help="관리자 계정만 생성")
    parser.add_argument("--clear-all", action="store_true", help="모든 테스트 데이터 삭제")
    
    args = parser.parse_args()
    
    if args.admin_only:
        create_sample_admin()
    elif args.clear_all:
        confirm = input("⚠️  모든 테스트 데이터를 삭제하시겠습니까? (yes/no): ")
        if confirm.lower() == "yes":
            clear_test_data()
            create_sample_admin()
        else:
            print("❌ 작업이 취소되었습니다.")
    else:
        print("사용법:")
        print("  python clear_test_data.py --clear-all    # 모든 테스트 데이터 삭제")
        print("  python clear_test_data.py --admin-only   # 관리자 계정만 생성")
