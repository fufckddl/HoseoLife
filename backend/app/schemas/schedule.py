from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CourseBase(BaseModel):
    no: Optional[str] = None
    
    # 🆕 단과대학/학과 정보
    college: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    
    classification: Optional[str] = None
    aisw_micro_degree: Optional[str] = None
    general_area: Optional[str] = None
    course_code: Optional[str] = None
    section: Optional[str] = None
    target_grade: Optional[str] = None
    name: str
    credits: int
    professor: str
    lecture_time_room: Optional[str] = None
    # 분리된 필드 (백엔드가 가공/저장)
    lecture_time: Optional[str] = None
    lecture_room: Optional[str] = None
    class_type: Optional[str] = None
    teaching_method: Optional[str] = None
    team_teaching_type: Optional[str] = None
    
    # 파싱된 시간 정보
    day: Optional[int] = None  # 0: 월, 1: 화, 2: 수, 3: 목, 4: 금, 5: 토, 6: 일
    start_period: Optional[int] = None  # 0: 09:00, 1: 10:00, 2: 11:00...
    end_period: Optional[int] = None
    classroom: Optional[str] = None
    
    # 추가 필드
    is_major: bool = False
    color: str
    user_id: Optional[int] = None  # 개설과목의 경우 None
    user_schedule_id: Optional[int] = None

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    no: Optional[str] = None
    
    # 🆕 단과대학/학과 정보
    college: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    
    classification: Optional[str] = None
    aisw_micro_degree: Optional[str] = None
    general_area: Optional[str] = None
    course_code: Optional[str] = None
    section: Optional[str] = None
    target_grade: Optional[str] = None
    name: Optional[str] = None
    credits: Optional[int] = None
    professor: Optional[str] = None
    lecture_time_room: Optional[str] = None
    class_type: Optional[str] = None
    teaching_method: Optional[str] = None
    team_teaching_type: Optional[str] = None
    
    # 파싱된 시간 정보
    day: Optional[int] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    classroom: Optional[str] = None
    
    # 추가 필드
    is_major: Optional[bool] = None
    color: Optional[str] = None
    user_schedule_id: Optional[int] = None

class CourseResponse(CourseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ScheduleResponse(BaseModel):
    courses: List[CourseResponse]
    total_credits: int
    major_credits: int
    general_credits: int

class CourseConflictCheck(BaseModel):
    day: int
    start_period: int
    end_period: int
    user_id: int
    exclude_course_id: Optional[int] = None

# UserSchedule 관련 스키마
class UserScheduleBase(BaseModel):
    name: str
    description: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    user_id: int

class UserScheduleCreate(UserScheduleBase):
    pass

class UserScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

class UserScheduleResponse(UserScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserScheduleWithCourses(UserScheduleResponse):
    courses: List[CourseResponse] = []
