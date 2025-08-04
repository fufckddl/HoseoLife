from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models.post import Post
from app.models.user import User
from app.models.comment import Comment
from app.models.heart import Heart
from app.schemas.post import PostCreate, PostResponse, PostUpdate, PostListResponse
from app.schemas.comment import CommentCreate, CommentResponse
from app.routers.user import get_current_user
from app.services.s3_service import s3_service
from app.utils.date_utils import get_current_korea_time, should_increment_view_count
from datetime import datetime, timezone, timedelta
import os
import time
import json
from app.services.fcm_service import send_fcm_to_all_users, send_comment_notification

router = APIRouter(prefix="/posts", tags=["posts"])

def convert_to_kst(utc_time: datetime) -> datetime:
    """UTC 시간을 한국 시간(KST)으로 변환"""
    if utc_time.tzinfo is None:
        utc_time = utc_time.replace(tzinfo=timezone.utc)
    kst = timezone(timedelta(hours=9))
    return utc_time.astimezone(kst)

# 게시글 목록 조회
@router.get("/", response_model=List[PostListResponse])
def get_posts(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    building_name: Optional[str] = None,
    search: Optional[str] = None,
    after_date: Optional[str] = None,  # 날짜 필터링 파라미터 추가
    include_news_notices: bool = False,  # 뉴스/공지 포함 여부 (기본값: False)
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Post).filter(Post.is_active == True)
        
        # 뉴스/공지를 포함하지 않는 경우 필터링
        if not include_news_notices:
            query = query.filter(Post.category.notin_(['뉴스', '공지']))
        
        if category:
            query = query.filter(Post.category == category)
        
        if building_name:
            query = query.filter(Post.building_name == building_name)
        
        if search:
            # 제목에서 검색어 포함하는 게시글 필터링
            query = query.filter(Post.title.contains(search))
        
        # 날짜 필터링 추가
        if after_date:
            try:
                after_datetime = datetime.fromisoformat(after_date.replace('Z', '+00:00'))
                query = query.filter(Post.created_at >= after_datetime)
            except ValueError:
                # 날짜 파싱 실패 시 필터링하지 않음
                pass
        
        posts = query.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()
        
    except Exception as e:
        # 테이블이 존재하지 않거나 다른 데이터베이스 오류 발생 시 빈 리스트 반환
        print(f"게시글 목록 조회 오류: {e}")
        return []
    
    # 작성자 닉네임 추가
    result = []
    for post in posts:
        author = db.query(User).filter(User.id == post.author_id).first()
        post_dict = {
            "id": post.id,
            "title": post.title,
            "category": post.category,
            "building_name": post.building_name,
            "building_latitude": post.building_latitude,
            "building_longitude": post.building_longitude,
            "author_nickname": author.nickname if author else "알 수 없음",
            "author_profile_image_url": author.profile_image_url if author else None,
            "view_count": post.view_count,
            "heart_count": post.heart_count,
            "comment_count": post.comment_count,
            "created_at": convert_to_kst(post.created_at)
        }
        print(f"게시글 {post.id} - 작성자: {author.nickname if author else '알 수 없음'}, 프로필 이미지: {author.profile_image_url if author else 'None'}")
        result.append(post_dict)
    
    return result

# 게시글 상세 조회
@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    
    # 조회수 증가 로직
    should_increment = True
    
    # 현재 사용자의 마지막 조회 기록 확인
    from app.models.view_log import ViewLog
    last_view_log = db.query(ViewLog).filter(
        ViewLog.user_id == current_user.id,
        ViewLog.post_id == post_id
    ).order_by(ViewLog.viewed_date.desc()).first()
    
    if last_view_log:
        # 마지막 조회가 오늘 06:00 이후면 조회수 증가 안함
        should_increment = should_increment_view_count(last_view_log.viewed_date)
    
    if should_increment:
        # 조회수 증가
        post.view_count += 1
        
        # 조회 기록 저장
        current_korea_time = get_current_korea_time()
        new_view_log = ViewLog(
            user_id=current_user.id,
            post_id=post_id,
            viewed_date=current_korea_time
        )
        db.add(new_view_log)
        db.commit()
    
    # 작성자 정보 가져오기
    author = db.query(User).filter(User.id == post.author_id).first()
    
    # 이미지 URL 파싱
    image_urls = None
    if post.image_urls:
        try:
            image_urls = json.loads(post.image_urls)
        except json.JSONDecodeError:
            image_urls = None
    
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "building_name": post.building_name,
        "building_latitude": post.building_latitude,
        "building_longitude": post.building_longitude,
        "author_id": post.author_id,
        "author_nickname": author.nickname if author else "알 수 없음",
        "author_profile_image_url": author.profile_image_url if author else None,
        "image_urls": image_urls,  # 파싱된 이미지 URL 배열
        "is_active": post.is_active,
        "view_count": post.view_count,
        "heart_count": post.heart_count,
        "comment_count": post.comment_count,
        "created_at": convert_to_kst(post.created_at),
        "updated_at": convert_to_kst(post.updated_at)
    }

# 게시글 생성
@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # 뉴스나 공지 카테고리인 경우 관리자 권한 체크
        if post.category in ['뉴스', '공지']:
            if not current_user.is_admin:
                raise HTTPException(
                    status_code=403, 
                    detail="뉴스나 공지사항은 관리자만 작성할 수 있습니다."
                )
        
        # 입력 데이터 검증 및 정리
        title = post.title.strip() if post.title else ""
        content = post.content.strip() if post.content else ""
        category = post.category.strip() if post.category else ""
        building_name = post.building_name.strip() if post.building_name else ""
        
        # 빈 값 체크
        if not title or not content or not category or not building_name:
            raise HTTPException(
                status_code=400,
                detail="제목, 내용, 카테고리, 건물명은 필수입니다."
            )
        
        # 이미지 URL들을 JSON 형태로 저장
        image_urls_json = None
        if post.image_urls:
            image_urls_json = json.dumps(post.image_urls, ensure_ascii=False)
        
        print(f"게시글 생성 시도 - 제목: {title}, 내용: {content[:50]}...")
        
        db_post = Post(
            title=title,
            content=content,
            category=category,
            building_name=building_name,
            building_latitude=post.building_latitude,
            building_longitude=post.building_longitude,
            author_id=current_user.id,
            image_urls=image_urls_json  # 이미지 URL 저장
        )
        
        db.add(db_post)
        db.commit()
        db.refresh(db_post)
        
        print(f"게시글 생성 성공 - ID: {db_post.id}")
        
    except Exception as e:
        db.rollback()
        print(f"게시글 생성 오류: {e}")
        print(f"오류 타입: {type(e)}")
        if hasattr(e, 'orig'):
            print(f"원본 오류: {e.orig}")
        raise HTTPException(
            status_code=500,
            detail=f"게시글 생성 중 오류가 발생했습니다: {str(e)}"
        )

    # 뉴스/공지 작성 시 FCM 알림 발송
    if post.category in ['뉴스', '공지']:
        send_fcm_to_all_users(db, f"[{post.category}] {post.title}", post.content)

    # 이미지 URL을 다시 파싱
    image_urls = None
    if db_post.image_urls:
        image_urls = json.loads(db_post.image_urls)
    
    return {
        "id": db_post.id,
        "title": db_post.title,
        "content": db_post.content,
        "category": db_post.category,
        "building_name": db_post.building_name,
        "building_latitude": db_post.building_latitude,
        "building_longitude": db_post.building_longitude,
        "author_id": db_post.author_id,
        "author_nickname": current_user.nickname,
        "image_urls": image_urls,  # 파싱된 이미지 URL 배열
        "is_active": db_post.is_active,
        "view_count": db_post.view_count,
        "heart_count": db_post.heart_count,
        "comment_count": db_post.comment_count,
        "created_at": convert_to_kst(db_post.created_at),
        "updated_at": convert_to_kst(db_post.updated_at)
    }

# 게시글 수정
@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
        if not post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        
        # 작성자만 수정 가능
        if post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="게시글을 수정할 권한이 없습니다")
        
        # 업데이트할 필드들
        update_data = post_update.dict(exclude_unset=True)
        
        # 필수 필드 검증
        if 'title' in update_data and not update_data['title'].strip():
            raise HTTPException(status_code=400, detail="제목은 필수입니다.")
        
        if 'content' in update_data and not update_data['content'].strip():
            raise HTTPException(status_code=400, detail="내용은 필수입니다.")
        
        if 'category' in update_data and not update_data['category'].strip():
            raise HTTPException(status_code=400, detail="카테고리는 필수입니다.")
        
        # 카테고리를 뉴스나 공지로 변경하려는 경우 관리자 권한 체크
        if 'category' in update_data and update_data['category'] in ['뉴스', '공지']:
            if not current_user.is_admin:
                raise HTTPException(
                    status_code=403, 
                    detail="뉴스나 공지사항은 관리자만 작성할 수 있습니다."
                )
        
        # 이미지 URL을 JSON으로 변환
        if 'image_urls' in update_data:
            if update_data['image_urls'] and len(update_data['image_urls']) > 0:
                update_data['image_urls'] = json.dumps(update_data['image_urls'])
            else:
                update_data['image_urls'] = None  # 빈 배열이면 None으로 설정
        
        # 업데이트 실행
        for field, value in update_data.items():
            if value is not None:  # None이 아닌 값만 업데이트
                setattr(post, field, value)
        
        db.commit()
        db.refresh(post)
        
    except Exception as e:
        db.rollback()
        print(f"게시글 수정 오류: {e}")
        print(f"오류 타입: {type(e)}")
        if hasattr(e, 'orig'):
            print(f"원본 오류: {e.orig}")
        raise HTTPException(
            status_code=500,
            detail=f"게시글 수정 중 오류가 발생했습니다: {str(e)}"
        )
    
    # 이미지 URL을 다시 파싱
    image_urls = None
    if post.image_urls:
        try:
            image_urls = json.loads(post.image_urls)
        except json.JSONDecodeError:
            image_urls = None
    
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "building_name": post.building_name,
        "building_latitude": post.building_latitude,
        "building_longitude": post.building_longitude,
        "author_id": post.author_id,
        "author_nickname": current_user.nickname,
        "image_urls": image_urls,  # 파싱된 이미지 URL 배열
        "is_active": post.is_active,
        "view_count": post.view_count,
        "heart_count": post.heart_count,
        "comment_count": post.comment_count,
        "created_at": convert_to_kst(post.created_at),
        "updated_at": convert_to_kst(post.updated_at)
    }

# 게시글 삭제 (하드 삭제)
@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
        if not post:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        
        # 작성자만 삭제 가능
        if post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="게시글을 삭제할 권한이 없습니다")
        
        # S3에서 이미지 파일들 삭제
        if post.image_urls:
            try:
                import json
                image_urls = json.loads(post.image_urls)
                for image_url in image_urls:
                    # S3에서 이미지 파일 삭제
                    s3_service.delete_image(image_url)
            except Exception as e:
                print(f"이미지 삭제 중 오류 (무시됨): {e}")
        
        # 게시글 삭제 (관련 데이터는 CASCADE로 자동 삭제)
        # - 댓글들 (Comment)
        # - 좋아요들 (Heart)
        db.delete(post)
        db.commit()
        
        return {"message": "게시글이 삭제되었습니다"}
        
    except Exception as e:
        db.rollback()
        print(f"게시글 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="게시글 삭제 중 오류가 발생했습니다")

# 조회 기록 확인 API (디버그용)
@router.get("/{post_id}/view-logs")
def get_view_logs(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 게시글의 조회 기록을 확인합니다 (디버그용)."""
    from app.models.view_log import ViewLog
    
    # 현재 사용자의 조회 기록
    user_view_logs = db.query(ViewLog).filter(
        ViewLog.user_id == current_user.id,
        ViewLog.post_id == post_id
    ).order_by(ViewLog.viewed_date.desc()).all()
    
    # 게시글 정보
    post = db.query(Post).filter(Post.id == post_id).first()
    
    return {
        "post_id": post_id,
        "post_title": post.title if post else "게시글 없음",
        "current_view_count": post.view_count if post else 0,
        "user_view_logs": [
            {
                "viewed_date": convert_to_kst(log.viewed_date).isoformat(),
                "created_at": convert_to_kst(log.created_at).isoformat()
            }
            for log in user_view_logs
        ],
        "total_user_views": len(user_view_logs)
    }

# 내가 작성한 게시글 목록
@router.get("/my/posts", response_model=List[PostListResponse])
def get_my_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    posts = db.query(Post).filter(
        Post.author_id == current_user.id,
        Post.is_active == True
    ).order_by(Post.created_at.desc()).all()
    
    result = []
    for post in posts:
        author = db.query(User).filter(User.id == post.author_id).first()
        post_dict = {
            "id": post.id,
            "title": post.title,
            "category": post.category,
            "building_name": post.building_name,
            "building_latitude": post.building_latitude,
            "building_longitude": post.building_longitude,
            "author_nickname": author.nickname if author else "알 수 없음",
            "author_profile_image_url": author.profile_image_url if author else None,
            "view_count": post.view_count,
            "heart_count": post.heart_count,
            "comment_count": post.comment_count,
            "created_at": convert_to_kst(post.created_at)
        }
        result.append(post_dict)
    
    return result 

# 이미지 업로드
@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    post_id: str = Form(...),  # 문자열로 받음
    db: Session = Depends(get_db)
):
    """
    이미지를 S3에 업로드하고 URL을 반환
    """
    try:
        # post_id를 정수로 변환
        try:
            post_id_int = int(post_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 게시글 ID입니다")
        
        # 파일 크기 제한 (10MB)
        if file.size and file.size > 10 * 1024 * 1024:
            print(f"파일 크기 초과: {file.size} bytes")
            raise HTTPException(
                status_code=400, 
                detail="파일 크기는 10MB 이하여야 합니다"
            )
        
        # 파일 확장자 검증
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail="지원하지 않는 파일 형식입니다. jpg, jpeg, png, gif, webp만 허용됩니다."
            )
        
        # 파일 내용 읽기
        file_content = await file.read()
        
        # S3에 업로드할 파일명 생성 ({post_id}/image_{timestamp}.{ext})
        timestamp = int(time.time())
        file_extension = os.path.splitext(file.filename)[1].lower()
        s3_filename = f"{post_id_int}/image_{timestamp}{file_extension}"
        
        # S3에 업로드 (posts/ 경로는 S3 서비스에서 추가)
        image_url = await s3_service.upload_image(file_content, s3_filename, file.content_type)
        
        print(f"이미지 업로드 성공: {image_url}")
        
        return {"message": "이미지가 성공적으로 업로드되었습니다", "image_url": image_url}
    except Exception as e:
        print(f"이미지 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail="이미지 업로드 중 오류가 발생했습니다")

# 댓글 목록 조회
@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(
    post_id: int,
    db: Session = Depends(get_db)
):
    """특정 게시글의 댓글 목록을 조회합니다."""
    # 게시글 존재 확인
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    
    # 댓글 목록 조회
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at.asc()).all()
    
    result = []
    for comment in comments:
        author = db.query(User).filter(User.id == comment.author_id).first()
        comment_dict = {
            "id": comment.id,
            "content": comment.content,
            "author_nickname": author.nickname if author else "알 수 없음",
            "author_id": comment.author_id,
            "author_profile_image_url": author.profile_image_url if author else None,
            "created_at": convert_to_kst(comment.created_at)
        }
        result.append(comment_dict)
    
    return result

# 댓글 작성
@router.post("/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """댓글을 작성합니다."""
    # 게시글 존재 확인
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    
    # 댓글 생성
    new_comment = Comment(
        content=comment_data.content,
        author_id=current_user.id,
        post_id=post_id
    )
    
    try:
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        
        # 게시글의 댓글 수 증가
        post.comment_count += 1
        db.commit()
        
        # 응답 데이터 생성
        comment_response = {
            "id": new_comment.id,
            "content": new_comment.content,
            "author_nickname": current_user.nickname,
            "author_id": new_comment.author_id,
            "author_profile_image_url": current_user.profile_image_url,
            "created_at": convert_to_kst(new_comment.created_at)
        }
        
        # 댓글 작성 시 FCM 알림 발송 (자신의 게시글에는 알림 안 보내기)
        if post.author_id != current_user.id:
            try:
                print(f"댓글 알림 전송 시작: 게시글 작성자 ID={post.author_id}, 댓글 작성자={current_user.nickname}, 게시글 제목='{post.title}'")
                send_comment_notification(
                    db=db,
                    post_author_id=post.author_id,
                    commenter_nickname=current_user.nickname,
                    post_title=post.title
                )
                print("댓글 알림 전송 성공")
            except Exception as e:
                print(f"댓글 FCM 알림 발송 실패: {e}")
                print(f"오류 타입: {type(e)}")
        else:
            print(f"자신의 게시글에 댓글 작성: 알림 전송 건너뜀")
        
        return comment_response
        
    except Exception as e:
        db.rollback()
        print(f"댓글 작성 오류: {e}")
        raise HTTPException(status_code=500, detail="댓글 작성 중 오류가 발생했습니다")

# 댓글 삭제
@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """댓글을 삭제합니다."""
    # 댓글 존재 확인
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    
    # 작성자 확인
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="댓글을 삭제할 권한이 없습니다")
    
    try:
        # 게시글의 댓글 수 감소
        post = db.query(Post).filter(Post.id == comment.post_id).first()
        if post and post.comment_count > 0:
            post.comment_count -= 1
        
        # 댓글 삭제
        db.delete(comment)
        db.commit()
        
        return {"message": "댓글이 삭제되었습니다"}
        
    except Exception as e:
        db.rollback()
        print(f"댓글 삭제 오류: {e}")
        raise HTTPException(status_code=500, detail="댓글 삭제 중 오류가 발생했습니다")

# 하트 토글
@router.post("/{post_id}/heart")
def toggle_heart(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시글 하트를 토글합니다."""
    # 게시글 존재 확인
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    
    # 기존 하트 확인
    existing_heart = db.query(Heart).filter(
        Heart.post_id == post_id,
        Heart.user_id == current_user.id
    ).first()
    
    try:
        if existing_heart:
            # 하트가 있으면 삭제 (토글 off)
            db.delete(existing_heart)
            post.heart_count = max(0, post.heart_count - 1)  # 음수가 되지 않도록
            message = "하트가 해제되었습니다"
            is_hearted = False
        else:
            # 하트가 없으면 생성 (토글 on)
            new_heart = Heart(
                post_id=post_id,
                user_id=current_user.id
            )
            db.add(new_heart)
            post.heart_count += 1
            message = "하트가 추가되었습니다"
            is_hearted = True
        
        db.commit()
        
        return {
            "message": message,
            "is_hearted": is_hearted,
            "heart_count": post.heart_count
        }
        
    except Exception as e:
        db.rollback()
        print(f"하트 토글 오류: {e}")
        raise HTTPException(status_code=500, detail="하트 토글 중 오류가 발생했습니다")

# 하트 상태 확인
@router.get("/{post_id}/heart")
def get_heart_status(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 사용자의 하트 상태를 확인합니다."""
    # 게시글 존재 확인
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
    
    # 하트 상태 확인
    heart = db.query(Heart).filter(
        Heart.post_id == post_id,
        Heart.user_id == current_user.id
    ).first()
    
    return {
        "is_hearted": heart is not None,
        "heart_count": post.heart_count
    } 