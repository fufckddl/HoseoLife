from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
import logging
import os
from urllib.parse import quote_plus

# 환경 변수로 SQL 로그 제어
SQL_ECHO = os.getenv('SQL_ECHO', 'false').lower() == 'true'

# SQLAlchemy 로그 설정
if not SQL_ECHO:
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.dialects').setLevel(logging.WARNING)

# 데이터베이스 연결 정보 (환경 변수로만 주입)
DB_HOST = os.getenv('DB_HOST', '')
DB_PORT = int(os.getenv('DB_PORT', '3306'))
DB_USER = os.getenv('DB_USER', '')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', '')


def _build_database_url(include_database: bool = True) -> str:
    explicit_database_url = os.getenv('DATABASE_URL', '')
    if explicit_database_url:
        return explicit_database_url

    if not all([DB_HOST, DB_USER, DB_PASSWORD]) or (include_database and not DB_NAME):
        return ''

    credentials = f"{quote_plus(DB_USER)}:{quote_plus(DB_PASSWORD)}"
    database_path = f"/{DB_NAME}" if include_database else ''
    return (
        f"mysql+pymysql://{credentials}@{DB_HOST}:{DB_PORT}{database_path}"
        "?charset=utf8mb4&collation=utf8mb4_unicode_ci"
    )


DATABASE_URL = _build_database_url()
CREATE_DB_URL = _build_database_url(include_database=False)

#데이터베이스 연결 (UTF-8 인코딩 설정)
engine = None
SessionLocal = None

if DATABASE_URL:
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

        if not all([DB_HOST, DB_USER, DB_PASSWORD, DB_NAME]):
            raise RuntimeError("Database credentials must be supplied via environment variables.")
        
        # MySQL에 직접 연결하여 데이터베이스 생성
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,  # 상수 사용
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # 데이터베이스 존재 여부 확인
            cursor.execute("SHOW DATABASES LIKE %s", (DB_NAME,))
            if not cursor.fetchone():
                print(f"데이터베이스 '{DB_NAME}'가 존재하지 않습니다. 생성 중...")
                # 데이터베이스 생성 (간단한 설정)
                safe_db_name = DB_NAME.replace('`', '')
                cursor.execute(f"CREATE DATABASE `{safe_db_name}`")
                connection.commit()
                print(f"데이터베이스 '{DB_NAME}' 생성 완료")
            else:
                print(f"데이터베이스 '{DB_NAME}'가 이미 존재합니다.")
        
        connection.close()
                
    except Exception as e:
        print(f"데이터베이스 생성 중 오류: {e}")
        print(f"오류 타입: {type(e)}")
        
        # 구체적인 오류 메시지 출력
        if "Access denied" in str(e):
            print("🔐 접근 권한 오류: 사용자명 또는 비밀번호를 확인하세요.")
            print("💡 해결 방법:")
            print("   1. MySQL 사용자 권한 확인")
            print("   2. 비밀번호 재설정")
            print("   3. 원격 접근 권한 부여")
        elif "Can't connect" in str(e):
            print("🌐 연결 오류: MySQL 서버가 실행 중인지 확인하세요.")
        
        # 오류가 발생해도 계속 진행 (데이터베이스가 이미 존재할 수 있음)
        print("데이터베이스 생성 오류를 무시하고 계속 진행합니다.")

# 데이터베이스 세션 의존성
def get_db() -> Generator:
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL or DB_* environment variables.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 
