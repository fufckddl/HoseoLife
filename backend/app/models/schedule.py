from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    no = Column(String(20), nullable=True, comment="NO")
    
    # 🆕 단과대학/학과 정보
    college = Column(String(50), nullable=True, comment="단과대학")
    department = Column(String(100), nullable=True, comment="학과/부")
    semester = Column(String(20), nullable=True, comment="학기")
    year = Column(Integer, nullable=True, comment="개설연도")
    
    classification = Column(String(50), nullable=True, comment="이수구분")
    aisw_micro_degree = Column(String(100), nullable=True, comment="AISW마이크로디그리")
    general_area = Column(String(50), nullable=True, comment="교양영역")
    course_code = Column(String(20), nullable=True, comment="학수번호")
    section = Column(String(10), nullable=True, comment="분반")
    target_grade = Column(String(10), nullable=True, comment="개설학년")
    name = Column(String(100), nullable=False, comment="교과목명")
    credits = Column(Integer, nullable=False, comment="학점")
    professor = Column(String(50), nullable=False, comment="교수명")
    lecture_time_room = Column(String(200), nullable=True, comment="강의시간(강의실)")
    # 분리된 표시용 컬럼 (가공된 값)
    lecture_time = Column(String(100), nullable=True, comment="가공된 강의 시간 문자열 (예: 수4-5)")
    lecture_room = Column(String(100), nullable=True, comment="가공된 강의실 문자열")
    class_type = Column(String(50), nullable=True, comment="수업구분")
    teaching_method = Column(String(50), nullable=True, comment="수업방법")
    team_teaching_type = Column(String(50), nullable=True, comment="팀티칭 유형")
    
    # 파싱된 시간 정보 (강의시간(강의실)에서 추출)
    day = Column(Integer, nullable=True, comment="요일 (0:월, 1:화, 2:수, 3:목, 4:금, 5:토, 6:일)")
    start_period = Column(Integer, nullable=True, comment="시작 교시 (0:09:00, 1:10:00, 2:11:00...)")
    end_period = Column(Integer, nullable=True, comment="종료 교시")
    classroom = Column(String(50), nullable=True, comment="강의실")
    
    # 추가 필드
    is_major = Column(Boolean, default=False, comment="전공과목 여부")
    color = Column(String(7), nullable=False, comment="강의 색상 (HEX 코드)")
    user_id = Column(Integer, nullable=True, comment="사용자 ID")  # 개설과목은 NULL, FK 임시 제거
    user_schedule_id = Column(Integer, nullable=True, comment="사용자 시간표 ID")  # FK 임시 제거
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="수정일시")

    # 관계 설정 (순환 참조 방지를 위해 back_populates 제거)
    # user = relationship("User", lazy="select")  # 임시 비활성화
    # user_schedule = relationship("UserSchedule", back_populates="courses", lazy="select")  # 임시 비활성화

    # 인덱스 설정
    __table_args__ = (
        Index('idx_courses_user_day_period', 'user_id', 'day', 'start_period'),
        Index('idx_courses_user_id', 'user_id'),
    )

    def __repr__(self):
        return f"<Course(id={self.id}, name='{self.name}', day={self.day}, period={self.start_period}-{self.end_period})>"
