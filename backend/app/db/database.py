from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
import logging
import os

# 환경 변수로 SQL 로그 제어
SQL_ECHO = os.getenv('SQL_ECHO', 'false').lower() == 'true'

# SQLAlchemy 로그 설정
if not SQL_ECHO:
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.dialects').setLevel(logging.WARNING)

#데이터베이스 연결 정보 (UTF-8 인코딩 설정)
DATABASE_URL = "mysql+pymysql://camsaw:camsaw123@your-server-ip:3306/camsaw_db?charset=utf8mb4&collation=utf8mb4_unicode_ci"

# 데이터베이스 생성용 URL (데이터베이스명 제외)
CREATE_DB_URL = "mysql+pymysql://camsaw:camsaw123@your-server-ip:3306?charset=utf8mb4&collation=utf8mb4_unicode_ci"

#데이터베이스 연결 (UTF-8 인코딩 설정)
engine = create_engine(
    DATABASE_URL, 
    echo=SQL_ECHO,  # 환경 변수로 제어
    future=True,
    pool_pre_ping=True,  # 연결 상태 확인
    pool_recycle=3600,   # 1시간마다 연결 재생성
    connect_args={
        "charset": "utf8mb4",
        "use_unicode": True,
        "init_command": "SET NAMES utf8mb4"
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 데이터베이스 생성 함수
def create_database_if_not_exists():
    """데이터베이스가 존재하지 않으면 생성"""
    try:
        import pymysql
        
        # MySQL에 직접 연결하여 데이터베이스 생성
        connection = pymysql.connect(
            host='your-server-ip',
            port=3306,
            user='camsaw',
            password='camsaw123',
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # 데이터베이스 존재 여부 확인
            cursor.execute("SHOW DATABASES LIKE 'camsaw_db'")
            if not cursor.fetchone():
                print("데이터베이스 'camsaw_db'가 존재하지 않습니다. 생성 중...")
                # 데이터베이스 생성 (간단한 설정)
                cursor.execute("CREATE DATABASE camsaw_db")
                connection.commit()
                print("데이터베이스 'camsaw_db' 생성 완료")
            else:
                print("데이터베이스 'camsaw_db'가 이미 존재합니다.")
        
        connection.close()
                
    except Exception as e:
        print(f"데이터베이스 생성 중 오류: {e}")
        print(f"오류 타입: {type(e)}")
        # 오류가 발생해도 계속 진행 (데이터베이스가 이미 존재할 수 있음)
        print("데이터베이스 생성 오류를 무시하고 계속 진행합니다.")

# 데이터베이스 세션 의존성
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 