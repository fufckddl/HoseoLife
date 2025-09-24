from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import csv
import io
import urllib.parse
from app.db.database import get_db
from app.models.schedule import Course
from app.models.user_schedule import UserSchedule
from app.models.user import User
from app.schemas.schedule import (
    CourseCreate, 
    CourseUpdate, 
    CourseResponse, 
    ScheduleResponse,
    CourseConflictCheck,
    UserScheduleCreate,
    UserScheduleUpdate,
    UserScheduleResponse,
    UserScheduleWithCourses
)
from app.routers.user import get_current_user
from app.utils.schedule_parser import parse_csv_row_to_course

router = APIRouter(prefix="/schedule", tags=["schedule"])

@router.get("/", response_model=ScheduleResponse)
async def get_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 강의 시간표 조회"""
    courses = db.query(Course).filter(Course.user_id == current_user.id).all()
    
    total_credits = sum(course.credits for course in courses)
    major_credits = sum(course.credits for course in courses if course.is_major)
    general_credits = total_credits - major_credits
    
    return ScheduleResponse(
        courses=courses,
        total_credits=total_credits,
        major_credits=major_credits,
        general_credits=general_credits
    )

@router.post("/courses", response_model=CourseResponse)
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새 강의 추가"""
    # 시간 충돌 확인
    conflict_course = db.query(Course).filter(
        Course.user_id == current_user.id,
        Course.day == course_data.day,
        Course.start_period <= course_data.end_period,
        Course.end_period >= course_data.start_period
    ).first()
    
    if conflict_course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"해당 시간에 이미 '{conflict_course.name}' 강의가 있습니다."
        )
    
    # 강의 생성
    course = Course(
        name=course_data.name,
        professor=course_data.professor,
        classroom=course_data.classroom,
        day=course_data.day,
        start_period=course_data.start_period,
        end_period=course_data.end_period,
        credits=course_data.credits,
        is_major=course_data.is_major,
        color=course_data.color,
        user_id=current_user.id
    )
    
    db.add(course)
    db.commit()
    db.refresh(course)
    
    return course

@router.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """강의 정보 수정"""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    # 시간 충돌 확인 (자기 자신 제외)
    if course_data.day is not None or course_data.start_period is not None or course_data.end_period is not None:
        day = course_data.day if course_data.day is not None else course.day
        start_period = course_data.start_period if course_data.start_period is not None else course.start_period
        end_period = course_data.end_period if course_data.end_period is not None else course.end_period
        
        conflict_course = db.query(Course).filter(
            Course.user_id == current_user.id,
            Course.id != course_id,
            Course.day == day,
            Course.start_period <= end_period,
            Course.end_period >= start_period
        ).first()
        
        if conflict_course:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"해당 시간에 이미 '{conflict_course.name}' 강의가 있습니다."
            )
    
    # 강의 정보 업데이트
    update_data = course_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)
    
    db.commit()
    db.refresh(course)
    
    return course

@router.delete("/courses/{course_id}")
async def delete_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """강의 삭제"""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == current_user.id
    ).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    db.delete(course)
    db.commit()
    
    return {"message": "강의가 삭제되었습니다."}

@router.post("/check-conflict")
async def check_time_conflict(
    conflict_check: CourseConflictCheck,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """시간 충돌 확인"""
    query = db.query(Course).filter(
        Course.user_id == current_user.id,
        Course.day == conflict_check.day,
        Course.start_period <= conflict_check.end_period,
        Course.end_period >= conflict_check.start_period
    )
    
    if conflict_check.exclude_course_id:
        query = query.filter(Course.id != conflict_check.exclude_course_id)
    
    conflict_course = query.first()
    
    if conflict_course:
        return {
            "has_conflict": True,
            "conflict_course": {
                "id": conflict_course.id,
                "name": conflict_course.name,
                "professor": conflict_course.professor,
                "classroom": conflict_course.classroom,
                "start_period": conflict_course.start_period,
                "end_period": conflict_course.end_period
            }
        }
    
    return {"has_conflict": False}

@router.get("/courses", response_model=List[CourseResponse])
async def get_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 모든 강의 목록 조회"""
    courses = db.query(Course).filter(Course.user_id == current_user.id).all()
    return courses

# UserSchedule 관련 엔드포인트들
@router.get("/user-schedules", response_model=List[UserScheduleResponse])
async def get_user_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자의 모든 시간표 목록 조회"""
    schedules = db.query(UserSchedule).filter(UserSchedule.user_id == current_user.id).all()
    return schedules

@router.get("/user-schedules/{schedule_id}", response_model=UserScheduleWithCourses)
async def get_user_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 시간표 조회 (강의 포함)"""
    schedule = db.query(UserSchedule).filter(
        UserSchedule.id == schedule_id,
        UserSchedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다."
        )
    
    courses = db.query(Course).filter(Course.user_schedule_id == schedule_id).all()
    
    return UserScheduleWithCourses(
        id=schedule.id,
        name=schedule.name,
        description=schedule.description,
        semester=schedule.semester,
        year=schedule.year,
        is_active=schedule.is_active,
        is_default=schedule.is_default,
        user_id=schedule.user_id,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
        courses=courses
    )

@router.post("/user-schedules", response_model=UserScheduleResponse)
async def create_user_schedule(
    schedule_data: UserScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """새 시간표 생성"""
    # 기본 시간표로 설정하는 경우, 기존 기본 시간표 해제
    if schedule_data.is_default:
        db.query(UserSchedule).filter(
            UserSchedule.user_id == current_user.id,
            UserSchedule.is_default == True
        ).update({"is_default": False})
    
    schedule = UserSchedule(
        name=schedule_data.name,
        description=schedule_data.description,
        semester=schedule_data.semester,
        year=schedule_data.year,
        is_active=schedule_data.is_active,
        is_default=schedule_data.is_default,
        user_id=current_user.id
    )
    
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    return schedule

@router.put("/user-schedules/{schedule_id}", response_model=UserScheduleResponse)
async def update_user_schedule(
    schedule_id: int,
    schedule_data: UserScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """시간표 정보 수정"""
    schedule = db.query(UserSchedule).filter(
        UserSchedule.id == schedule_id,
        UserSchedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다."
        )
    
    # 기본 시간표로 설정하는 경우, 기존 기본 시간표 해제
    if schedule_data.is_default:
        db.query(UserSchedule).filter(
            UserSchedule.user_id == current_user.id,
            UserSchedule.is_default == True,
            UserSchedule.id != schedule_id
        ).update({"is_default": False})
    
    # 시간표 정보 업데이트
    update_data = schedule_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    db.commit()
    db.refresh(schedule)
    
    return schedule

@router.delete("/user-schedules/{schedule_id}")
async def delete_user_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """시간표 삭제"""
    schedule = db.query(UserSchedule).filter(
        UserSchedule.id == schedule_id,
        UserSchedule.user_id == current_user.id
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시간표를 찾을 수 없습니다."
        )
    
    db.delete(schedule)
    db.commit()
    
    return {"message": "시간표가 삭제되었습니다."}

@router.get("/active-schedule", response_model=UserScheduleWithCourses)
async def get_active_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """활성 시간표 조회 (기본 시간표 또는 가장 최근 시간표)"""
    # 기본 시간표 조회
    schedule = db.query(UserSchedule).filter(
        UserSchedule.user_id == current_user.id,
        UserSchedule.is_default == True,
        UserSchedule.is_active == True
    ).first()
    
    # 기본 시간표가 없으면 가장 최근 시간표 조회
    if not schedule:
        schedule = db.query(UserSchedule).filter(
            UserSchedule.user_id == current_user.id,
            UserSchedule.is_active == True
        ).order_by(UserSchedule.created_at.desc()).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="활성 시간표를 찾을 수 없습니다."
        )
    
    courses = db.query(Course).filter(Course.user_schedule_id == schedule.id).all()
    
    return UserScheduleWithCourses(
        id=schedule.id,
        name=schedule.name,
        description=schedule.description,
        semester=schedule.semester,
        year=schedule.year,
        is_active=schedule.is_active,
        is_default=schedule.is_default,
        user_id=schedule.user_id,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
        courses=courses
    )


@router.get("/courses/search", response_model=List[CourseResponse])
async def search_courses(
    q: Optional[str] = Query(None, description="검색어 (과목명, 교수명, 학수번호)"),
    classification: Optional[str] = Query(None, description="이수구분 필터"),
    college: Optional[str] = Query(None, description="단과대학 필터"),
    department: Optional[str] = Query(None, description="학과/부 필터"),
    is_major: Optional[bool] = Query(None, description="전공과목 여부"),
    credits: Optional[int] = Query(None, description="학점 필터"),
    class_type: Optional[str] = Query(None, description="수업구분 필터 (주간/야간)"),
    teaching_method: Optional[str] = Query(None, description="수업방법 필터 (대면/비대면)"),
    limit: int = Query(50, description="결과 개수 제한"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """과목 검색 (전체 개설과목에서 검색)"""
    # URL 디코딩 처리
    if q:
        q = urllib.parse.unquote(q)
        print(f"검색어 디코딩: {q}")
    
    if classification:
        classification = urllib.parse.unquote(classification)
        print(f"이수구분 디코딩: {classification}")
        
    if college:
        college = urllib.parse.unquote(college)
        print(f"단과대학 디코딩: {college}")
        
    if department:
        department = urllib.parse.unquote(department)
        print(f"학과 디코딩: {department}")
    
    query = db.query(Course).filter(Course.user_id.is_(None))  # 개설과목만 (user_id가 None)
    
    # 검색어 필터
    if q:
        search_filter = or_(
            Course.name.contains(q),
            Course.professor.contains(q),
            Course.course_code.contains(q)
        )
        query = query.filter(search_filter)
        print(f"검색 필터 적용: {q}")
    
    # 이수구분 필터
    if classification:
        query = query.filter(Course.classification == classification)
        print(f"이수구분 필터 적용: {classification}")
    
    # 🆕 단과대학 필터
    if college:
        query = query.filter(Course.college == college)
        print(f"단과대학 필터 적용: {college}")
    
    # 🆕 학과/부 필터
    if department:
        query = query.filter(Course.department == department)
        print(f"학과 필터 적용: {department}")
    
    # 전공과목 여부 필터
    if is_major is not None:
        query = query.filter(Course.is_major == is_major)
        print(f"전공/교양 필터 적용: {is_major}")
    
    # 🆕 학점 필터
    if credits is not None:
        query = query.filter(Course.credits == credits)
        print(f"학점 필터 적용: {credits}")
    
    # 🆕 수업구분 필터
    if class_type:
        class_type = urllib.parse.unquote(class_type)
        query = query.filter(Course.class_type == class_type)
        print(f"수업구분 필터 적용: {class_type}")
    
    # 🆕 수업방법 필터
    if teaching_method:
        teaching_method = urllib.parse.unquote(teaching_method)
        query = query.filter(Course.teaching_method == teaching_method)
        print(f"수업방법 필터 적용: {teaching_method}")
    
    # 결과 조회
    all_courses = query.all()
    print(f"전체 검색 결과: {len(all_courses)}개")
    
    # 🔧 분반별로 그룹화하여 대표 블록만 반환 (중복 제거)
    course_groups = {}
    for course in all_courses:
        # 분반 식별키: 강의명 + 교수 + 학수번호 + 분반
        group_key = f"{course.name}_{course.professor}_{course.course_code}_{course.section}"
        
        if group_key not in course_groups:
            course_groups[group_key] = course
    
    # 대표 블록들만 반환 (제한 적용)
    unique_courses = list(course_groups.values())[:limit]
    print(f"중복 제거 후 검색 결과: {len(unique_courses)}개")
    
    return unique_courses

@router.get("/courses/classifications")
async def get_classifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """이수구분 목록 조회"""
    classifications = db.query(Course.classification).filter(
        Course.user_id.is_(None),
        Course.classification.isnot(None)
    ).distinct().all()
    
    return [c[0] for c in classifications if c[0]]

@router.get("/courses/colleges")
async def get_colleges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """단과대학 목록 조회"""
    colleges = db.query(Course.college).filter(
        Course.user_id.is_(None),
        Course.college.isnot(None)
    ).distinct().all()
    
    return [c[0] for c in colleges if c[0]]

@router.get("/courses/departments")
async def get_departments(
    college: Optional[str] = Query(None, description="단과대학 필터"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """학과/부 목록 조회 (단과대학별 필터링 가능)"""
    query = db.query(Course.department).filter(
        Course.user_id.is_(None),
        Course.department.isnot(None)
    )
    
    if college:
        college = urllib.parse.unquote(college)
        query = query.filter(Course.college == college)
    
    departments = query.distinct().all()
    return [d[0] for d in departments if d[0]]

@router.get("/courses/filters")
async def get_course_filters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """모든 필터 옵션 조회 (한 번에)"""
    # 이수구분
    classifications = db.query(Course.classification).filter(
        Course.user_id.is_(None),
        Course.classification.isnot(None)
    ).distinct().all()
    
    # 단과대학
    colleges = db.query(Course.college).filter(
        Course.user_id.is_(None),
        Course.college.isnot(None)
    ).distinct().all()
    
    # 학점
    credits_list = db.query(Course.credits).filter(
        Course.user_id.is_(None),
        Course.credits.isnot(None)
    ).distinct().all()
    
    # 수업구분
    class_types = db.query(Course.class_type).filter(
        Course.user_id.is_(None),
        Course.class_type.isnot(None)
    ).distinct().all()
    
    # 수업방법
    teaching_methods = db.query(Course.teaching_method).filter(
        Course.user_id.is_(None),
        Course.teaching_method.isnot(None)
    ).distinct().all()
    
    return {
        "classifications": [c[0] for c in classifications if c[0]],
        "colleges": [c[0] for c in colleges if c[0]],
        "credits": sorted([c[0] for c in credits_list if c[0]]),
        "class_types": [c[0] for c in class_types if c[0]],
        "teaching_methods": [t[0] for t in teaching_methods if t[0]]
    }

@router.post("/courses/import")
async def import_schedule_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """시간표 데이터 import (관리자 전용 API)"""
    # 관리자 권한 체크 (필요시 주석 해제)
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    
    try:
        from app.utils.schedule_importer import ScheduleImporter
        
        print("🚀 API를 통한 시간표 데이터 Import 시작")
        importer = ScheduleImporter()
        
        # Import 실행
        stats = importer.import_all_schedules(db)
        
        # 최종 통계
        summary = importer.get_import_summary(db)
        
        return {
            "success": True,
            "message": "시간표 데이터 import 완료",
            "stats": {
                "processed_files": f"{stats['success_files']}/{stats['total_files']}",
                "total_courses": stats['total_courses'],
                "errors": stats['errors']
            },
            "summary": summary
        }
        
    except Exception as e:
        print(f"❌ Import 실패: {e}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500, 
            detail=f"시간표 데이터 import 실패: {str(e)}"
        )

@router.get("/courses/debug")
async def debug_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """개설과목 데이터 디버깅용 엔드포인트"""
    # 전체 개설과목 개수
    total_courses = db.query(Course).filter(Course.user_id.is_(None)).count()
    
    # 샘플 데이터 (처음 5개)
    sample_courses = db.query(Course).filter(Course.user_id.is_(None)).limit(5).all()
    
    # 이수구분별 개수
    classifications = db.query(Course.classification, db.func.count(Course.id)).filter(
        Course.user_id.is_(None),
        Course.classification.isnot(None)
    ).group_by(Course.classification).all()
    
    return {
        "total_courses": total_courses,
        "sample_courses": [
            {
                "id": course.id,
                "name": course.name,
                "professor": course.professor,
                "classification": course.classification,
                "course_code": course.course_code,
                "is_major": course.is_major
            } for course in sample_courses
        ],
        "classifications": [{"name": c[0], "count": c[1]} for c in classifications]
    }

@router.post("/courses/{course_id}/add-to-schedule")
async def add_course_to_schedule(
    course_id: int,
    schedule_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """개설과목을 사용자 시간표에 자동 시간 할당으로 추가 (같은 강의명의 모든 블록 포함)"""
    # 원본 과목 조회
    original_course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id.is_(None)  # 개설과목만
    ).first()
    
    if not original_course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="과목을 찾을 수 없습니다."
        )
    
    # 🔧 같은 강의의 모든 블록 찾기 (분반 구분 포함)
    all_course_blocks = db.query(Course).filter(
        Course.name == original_course.name,
        Course.professor == original_course.professor,
        Course.course_code == original_course.course_code,  # 🔧 학수번호로 분반 구분
        Course.section == original_course.section,  # 🔧 분반으로 구분
        Course.user_id.is_(None)  # 개설과목만
    ).all()
    
    print(f"🔍 '{original_course.name}' 전체 블록 수: {len(all_course_blocks)}개")
    for block in all_course_blocks:
        day_names = ["월", "화", "수", "목", "금", "토", "일"]
        day_name = day_names[block.day] if block.day is not None and 0 <= block.day < len(day_names) else str(block.day)
        print(f"   블록 ID {block.id}: {day_name}요일 {block.start_period}-{block.end_period}교시")
    
    # 시간표 확인
    if schedule_id:
        schedule = db.query(UserSchedule).filter(
            UserSchedule.id == schedule_id,
            UserSchedule.user_id == current_user.id
        ).first()
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="시간표를 찾을 수 없습니다."
            )
    else:
        # 기본 시간표 사용
        schedule = db.query(UserSchedule).filter(
            UserSchedule.user_id == current_user.id,
            UserSchedule.is_default == True
        ).first()
        if not schedule:
            # 기본 시간표가 없으면 새로 생성
            schedule = UserSchedule(
                name="기본 시간표",
                description="개설과목 추가로 생성된 시간표",
                user_id=current_user.id,
                is_default=True
            )
            db.add(schedule)
            db.commit()
            db.refresh(schedule)
    
    # 🔧 모든 블록의 시간 정보 확인
    blocks_with_no_time = [block for block in all_course_blocks if 
                          block.day is None or block.start_period is None or block.end_period is None]
    
    if blocks_with_no_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이 과목은 시간 정보가 없어 시간표에 추가할 수 없습니다."
        )
    
    # 🔧 모든 블록에 대해 시간 충돌 확인
    day_names = ["월", "화", "수", "목", "금", "토", "일"]
    conflicting_blocks = []
    
    for block in all_course_blocks:
        conflict = db.query(Course).filter(
            Course.user_schedule_id == schedule.id,
            Course.user_id == current_user.id,
            Course.day == block.day,
            or_(
                and_(Course.start_period <= block.start_period, Course.end_period >= block.start_period),
                and_(Course.start_period <= block.end_period, Course.end_period >= block.end_period),
                and_(Course.start_period >= block.start_period, Course.end_period <= block.end_period)
            )
        ).first()
        
        if conflict:
            day_name = day_names[block.day] if 0 <= block.day < len(day_names) else str(block.day)
            time_str = f"{day_name}요일 {block.start_period}교시"
            if block.start_period != block.end_period:
                time_str = f"{day_name}요일 {block.start_period}-{block.end_period}교시"
            conflicting_blocks.append(f"{time_str} (기존: {conflict.name})")
    
    if conflicting_blocks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"다음 시간에 이미 강의가 있습니다: {', '.join(conflicting_blocks)}"
        )
    
    # 🔧 모든 블록을 사용자 시간표에 추가
    added_courses = []
    time_blocks_info = []
    
    for block in all_course_blocks:
        new_course = Course(
            no=block.no,
            college=block.college,
            department=block.department,
            semester=block.semester,
            year=block.year,
            classification=block.classification,
            aisw_micro_degree=block.aisw_micro_degree,
            general_area=block.general_area,
            course_code=block.course_code,
            section=block.section,
            target_grade=block.target_grade,
            name=block.name,
            credits=block.credits,
            professor=block.professor,
            lecture_time_room=block.lecture_time_room,
            # 🆕 새 필드도 복사
            lecture_time=block.lecture_time,
            lecture_room=block.lecture_room,
            class_type=block.class_type,
            teaching_method=block.teaching_method,
            team_teaching_type=block.team_teaching_type,
            day=block.day,
            start_period=block.start_period,
            end_period=block.end_period,
            classroom=block.classroom,
            is_major=block.is_major,
            color=block.color,
            user_id=current_user.id,
            user_schedule_id=schedule.id
        )
        
        db.add(new_course)
        added_courses.append(new_course)
        
        # 시간 정보 수집
        day_name = day_names[block.day] if 0 <= block.day < len(day_names) else str(block.day)
        time_str = f"{day_name}요일 {block.start_period}교시"
        if block.start_period != block.end_period:
            time_str = f"{day_name}요일 {block.start_period}-{block.end_period}교시"
        time_blocks_info.append(time_str)
    
    db.commit()
    
    # 모든 추가된 강의 refresh
    for course in added_courses:
        db.refresh(course)
    
    print(f"✅ '{original_course.name}' 과목 {len(added_courses)}개 블록이 추가되었습니다:")
    for time_info in time_blocks_info:
        print(f"   - {time_info}")
    
    # 첫 번째 블록을 대표로 반환 (프론트엔드 호환성)
    return added_courses[0]

@router.post("/upload-csv")
async def upload_schedule_csv(
    file: UploadFile = File(...),
    schedule_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """CSV 파일로 강의 시간표 업로드"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV 파일만 업로드 가능합니다."
        )
    
    try:
        # CSV 파일 읽기
        content = await file.read()
        csv_content = content.decode('utf-8-sig')  # BOM 제거
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        # 시간표 ID 확인
        if schedule_id:
            schedule = db.query(UserSchedule).filter(
                UserSchedule.id == schedule_id,
                UserSchedule.user_id == current_user.id
            ).first()
            if not schedule:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="시간표를 찾을 수 없습니다."
                )
        else:
            # 기본 시간표 사용
            schedule = db.query(UserSchedule).filter(
                UserSchedule.user_id == current_user.id,
                UserSchedule.is_default == True
            ).first()
            if not schedule:
                # 기본 시간표가 없으면 새로 생성
                schedule = UserSchedule(
                    name="기본 시간표",
                    description="CSV 업로드로 생성된 시간표",
                    user_id=current_user.id,
                    is_default=True
                )
                db.add(schedule)
                db.commit()
                db.refresh(schedule)
        
        # 기존 강의 삭제 (해당 시간표의 강의만)
        db.query(Course).filter(
            Course.user_schedule_id == schedule.id
        ).delete()
        
        # CSV 데이터 파싱 및 저장
        courses_created = 0
        for row in csv_reader:
            try:
                course_data = parse_csv_row_to_course(row, current_user.id, schedule.id)
                
                # 필수 필드 검증
                if not course_data['name'] or not course_data['professor']:
                    continue
                
                course = Course(**course_data)
                db.add(course)
                courses_created += 1
                
            except Exception as e:
                print(f"강의 파싱 오류: {e}, 행: {row}")
                continue
        
        db.commit()
        
        return {
            "message": f"CSV 업로드 완료: {courses_created}개 강의가 추가되었습니다.",
            "schedule_id": schedule.id,
            "courses_created": courses_created
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSV 업로드 중 오류가 발생했습니다: {str(e)}"
        )
