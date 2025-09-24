from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.board_request import BoardRequest
from app.models.board import Board
from app.models.board_notice import BoardNotice  # 🆕 게시판 공지사항 모델
from app.models.user import User
from app.schemas.board_request import BoardRequestCreate, BoardRequestResponse, BoardRequestUpdate
from app.schemas.board import BoardResponse
from app.schemas.board_notice import BoardNoticeCreate, BoardNoticeResponse, BoardNoticeUpdate  # 🆕 게시판 공지사항 스키마
from app.routers.user import get_current_user

router = APIRouter()

@router.post("/boards/create", response_model=dict)
def create_board_request(
    board_request: BoardRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 생성 요청"""
    try:
        # 중복된 이름의 게시판 요청이 있는지 확인
        existing_request = db.query(BoardRequest).filter(
            BoardRequest.name == board_request.name,
            BoardRequest.status == "pending"
        ).first()
        
        if existing_request:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 동일한 이름의 게시판 요청이 대기 중입니다."
            )
        
        # 새로운 게시판 요청 생성
        new_request = BoardRequest(
            name=board_request.name,
            description=board_request.description,
            creator_id=current_user.id
        )
        
        db.add(new_request)
        db.commit()
        db.refresh(new_request)
        
        return {
            "success": True,
            "message": "게시판 생성 요청이 완료되었습니다. 관리자 승인 후 사용 가능합니다.",
            "request_id": new_request.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 생성 요청에 실패했습니다: {str(e)}"
        )

@router.get("/admin/board-requests", response_model=List[BoardRequestResponse])
def get_board_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """관리자용 게시판 요청 목록 조회"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    
    try:
        board_requests = db.query(BoardRequest).join(User).all()
        
        result = []
        for request in board_requests:
            # 요청자 정보 조회
            creator = db.query(User).filter(User.id == request.creator_id).first()
            
            result.append(BoardRequestResponse(
                id=request.id,
                name=request.name,
                description=request.description,
                created_at=request.created_at,
                status=request.status,
                creator_id=request.creator_id,
                creator_name=creator.nickname if creator else None
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 요청 목록 조회에 실패했습니다: {str(e)}"
        )

@router.post("/admin/board-requests/{request_id}/approve")
def approve_board_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 요청 승인"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    
    try:
        board_request = db.query(BoardRequest).filter(BoardRequest.id == request_id).first()
        
        if not board_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="게시판 요청을 찾을 수 없습니다."
            )
        
        if board_request.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 처리된 게시판 요청입니다."
            )
        
        # 동일한 이름의 게시판이 이미 존재하는지 확인
        existing_board = db.query(Board).filter(Board.name == board_request.name).first()
        if existing_board:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 동일한 이름의 게시판이 존재합니다."
            )
        
        # 새로운 게시판 생성
        new_board = Board(
            name=board_request.name,
            description=board_request.description,
            creator_id=board_request.creator_id
        )
        
        db.add(new_board)
        board_request.status = "approved"
        db.commit()
        
        return {
            "success": True,
            "message": "게시판 요청이 승인되었습니다.",
            "board_id": new_board.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 요청 승인에 실패했습니다: {str(e)}"
        )

@router.post("/admin/board-requests/{request_id}/reject")
def reject_board_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 요청 거부"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    
    try:
        board_request = db.query(BoardRequest).filter(BoardRequest.id == request_id).first()
        
        if not board_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="게시판 요청을 찾을 수 없습니다."
            )
        
        if board_request.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 처리된 게시판 요청입니다."
            )
        
        board_request.status = "rejected"
        db.commit()
        
        return {
            "success": True,
            "message": "게시판 요청이 거부되었습니다."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 요청 거부에 실패했습니다: {str(e)}"
        )

@router.post("/board-name-check")
def check_board_name_availability(
    request_data: dict,
    db: Session = Depends(get_db)
):
    """게시판 이름 중복 검증"""
    try:
        board_name = request_data.get("name", "").strip()
        
        if not board_name:
            return {
                "available": False,
                "message": "게시판 이름을 입력해주세요."
            }
        
        from sqlalchemy import text
        
        # 기존 게시판에서 동일한 이름 확인
        existing_board = db.execute(text("""
            SELECT id FROM boards WHERE name = :board_name AND is_active = TRUE
        """), {'board_name': board_name}).fetchone()
        
        # 대기 중인 게시판 요청에서 동일한 이름 확인
        pending_request = db.execute(text("""
            SELECT id FROM board_requests WHERE name = :board_name AND status = 'pending'
        """), {'board_name': board_name}).fetchone()
        
        is_available = not existing_board and not pending_request
        
        result = {
            "available": is_available,
            "message": "사용 가능한 게시판 이름입니다." if is_available else "이미 사용 중이거나 대기 중인 게시판 이름입니다."
        }
        
        if existing_board:
            result["reason"] = "existing_board"
        elif pending_request:
            result["reason"] = "pending_request"
        
        print(f"🔍 게시판 이름 검증: '{board_name}' -> {result}")
        return result
        
    except Exception as e:
        print(f"❌ 게시판 이름 검증 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 이름 확인에 실패했습니다: {str(e)}"
        )

@router.get("/boards", response_model=List[BoardResponse])
def get_boards(db: Session = Depends(get_db)):
    """승인된 게시판 목록 조회"""
    try:
        boards = db.query(Board).filter(Board.is_active == True).join(User).all()
        
        result = []
        for board in boards:
            result.append(BoardResponse(
                id=board.id,
                name=board.name,
                description=board.description,
                is_active=board.is_active,
                created_at=board.created_at
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 목록 조회에 실패했습니다: {str(e)}"
        )

@router.get("/boards/{board_id}", response_model=dict)
def get_board(board_id: int, db: Session = Depends(get_db)):
    """특정 게시판 정보 조회"""
    try:
        from sqlalchemy import text
        
        # 🔧 직접 SQL 사용하여 순환 참조 문제 회피
        board_data = db.execute(text("""
            SELECT id, name, description, creator_id, is_active, created_at
            FROM boards
            WHERE id = :board_id AND is_active = TRUE
        """), {'board_id': board_id}).fetchone()
        
        if not board_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="게시판을 찾을 수 없습니다."
            )
        
        return {
            "id": board_data[0],
            "name": board_data[1],
            "description": board_data[2],
            "creator_id": board_data[3],
            "is_active": bool(board_data[4]),
            "created_at": board_data[5].isoformat() if board_data[5] else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 게시판 정보 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 정보 조회에 실패했습니다: {str(e)}"
        )

# 🆕 게시판 관리자 권한 확인 함수
def check_board_admin_permission(board_id: int, user_id: int, db: Session) -> bool:
    """게시판 관리자 권한을 확인합니다."""
    try:
        from sqlalchemy import text
        
        # 직접 SQL로 게시판과 사용자 정보 확인
        result = db.execute(text("""
            SELECT b.creator_id, u.is_admin
            FROM boards b, users u
            WHERE b.id = :board_id AND u.id = :user_id
        """), {'board_id': board_id, 'user_id': user_id}).fetchone()
        
        if not result:
            return False
        
        # 게시판 생성자이거나 전체 관리자인 경우
        return result[0] == user_id or bool(result[1])
        
    except Exception as e:
        print(f"❌ 권한 확인 실패: {e}")
        return False

# 🆕 게시판 공지사항 생성
@router.post("/boards/{board_id}/notices", response_model=BoardNoticeResponse)
def create_board_notice(
    board_id: int,
    notice_data: BoardNoticeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 공지사항을 생성합니다. (게시판 관리자만 가능)"""
    print(f"🔍 게시판 {board_id} 공지사항 생성 요청 - 사용자: {current_user.nickname} (ID: {current_user.id})")
    
    # 🔧 직접 SQL로 게시판 존재 확인
    from sqlalchemy import text
    board_exists = db.execute(text("""
        SELECT id FROM boards WHERE id = :board_id AND is_active = TRUE
    """), {'board_id': board_id}).fetchone()
    
    if not board_exists:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다")
    
    # 게시판 관리자 권한 확인
    if not check_board_admin_permission(board_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="게시판 관리자 권한이 필요합니다")
    
    try:
        # 🔧 직접 SQL로 공지사항 생성
        result = db.execute(text("""
            INSERT INTO board_notices (board_id, title, content, author_id, is_pinned, is_active)
            VALUES (:board_id, :title, :content, :author_id, :is_pinned, TRUE)
        """), {
            'board_id': board_id,
            'title': notice_data.title,
            'content': notice_data.content,
            'author_id': current_user.id,
            'is_pinned': notice_data.is_pinned
        })
        
        db.commit()
        notice_id = result.lastrowid
        
        # 생성된 공지사항 정보 조회
        notice_info = db.execute(text("""
            SELECT id, board_id, title, content, author_id, is_active, is_pinned, created_at, updated_at
            FROM board_notices
            WHERE id = :notice_id
        """), {'notice_id': notice_id}).fetchone()
        
        print(f"✅ 게시판 공지사항 생성 완료 - ID: {notice_id}")
        
        return {
            "id": notice_info[0],
            "board_id": notice_info[1],
            "title": notice_info[2],
            "content": notice_info[3],
            "author_id": notice_info[4],
            "author_nickname": current_user.nickname,
            "is_active": bool(notice_info[5]),
            "is_pinned": bool(notice_info[6]),
            "created_at": notice_info[7].isoformat() if notice_info[7] else None,
            "updated_at": notice_info[8].isoformat() if notice_info[8] else None
        }
        
    except Exception as e:
        db.rollback()
        print(f"❌ 게시판 공지사항 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="게시판 공지사항 생성에 실패했습니다")

# 🆕 게시판 공지사항 목록 조회
@router.get("/boards/{board_id}/notices", response_model=List[BoardNoticeResponse])
def get_board_notices(
    board_id: int,
    db: Session = Depends(get_db)
):
    """게시판의 공지사항 목록을 조회합니다."""
    print(f"🔍 게시판 {board_id} 공지사항 목록 조회")
    
    # 🔧 직접 SQL로 게시판 존재 확인
    from sqlalchemy import text
    board_exists = db.execute(text("""
        SELECT id FROM boards WHERE id = :board_id AND is_active = TRUE
    """), {'board_id': board_id}).fetchone()
    
    if not board_exists:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다")
    
    try:
        from sqlalchemy import text
        
        # 🔧 직접 SQL로 공지사항 조회 (작성자 정보 포함)
        notices_data = db.execute(text("""
            SELECT 
                bn.id, bn.board_id, bn.title, bn.content, bn.author_id, 
                bn.is_active, bn.is_pinned, bn.created_at, bn.updated_at,
                u.nickname as author_nickname,
                u.profile_image_url as author_profile_image_url
            FROM board_notices bn
            LEFT JOIN users u ON bn.author_id = u.id
            WHERE bn.board_id = :board_id AND bn.is_active = TRUE
            ORDER BY bn.is_pinned DESC, bn.created_at DESC
        """), {'board_id': board_id}).fetchall()
        
        result = []
        for notice in notices_data:
            result.append({
                "id": notice[0],
                "board_id": notice[1],
                "title": notice[2],
                "content": notice[3],
                "author_id": notice[4],
                "author_nickname": notice[9] or "알 수 없음",
                "author_profile_image_url": notice[10],  # 🆕 프로필 이미지 URL 추가
                "is_active": bool(notice[5]),
                "is_pinned": bool(notice[6]),
                "created_at": notice[7].isoformat() if notice[7] else None,
                "updated_at": notice[8].isoformat() if notice[8] else None
            })
        
        print(f"✅ 게시판 {board_id} 공지사항 조회 완료 - {len(result)}개")
        return result
        
    except Exception as e:
        print(f"❌ 게시판 공지사항 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="게시판 공지사항 조회에 실패했습니다")

# 🆕 게시판 공지사항 수정
@router.put("/boards/{board_id}/notices/{notice_id}", response_model=BoardNoticeResponse)
def update_board_notice(
    board_id: int,
    notice_id: int,
    notice_update: BoardNoticeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 공지사항을 수정합니다. (게시판 관리자만 가능)"""
    print(f"🔍 게시판 {board_id} 공지사항 {notice_id} 수정 요청 - 사용자: {current_user.nickname}")
    
    # 게시판 관리자 권한 확인
    if not check_board_admin_permission(board_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="게시판 관리자 권한이 필요합니다")
    
    # 공지사항 존재 확인
    notice = db.query(BoardNotice).filter(
        BoardNotice.id == notice_id,
        BoardNotice.board_id == board_id
    ).first()
    
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    
    try:
        # 공지사항 수정
        if notice_update.title is not None:
            notice.title = notice_update.title
        if notice_update.content is not None:
            notice.content = notice_update.content
        if notice_update.is_pinned is not None:
            notice.is_pinned = notice_update.is_pinned
        if notice_update.is_active is not None:
            notice.is_active = notice_update.is_active
        
        db.commit()
        db.refresh(notice)
        
        print(f"✅ 게시판 공지사항 수정 완료 - ID: {notice.id}")
        
        return BoardNoticeResponse(
            id=notice.id,
            board_id=notice.board_id,
            title=notice.title,
            content=notice.content,
            author_id=notice.author_id,
            author_nickname=current_user.nickname,
            is_active=notice.is_active,
            is_pinned=notice.is_pinned,
            created_at=notice.created_at,
            updated_at=notice.updated_at
        )
        
    except Exception as e:
        db.rollback()
        print(f"❌ 게시판 공지사항 수정 실패: {e}")
        raise HTTPException(status_code=500, detail="게시판 공지사항 수정에 실패했습니다")

# 🆕 게시판 공지사항 삭제
@router.delete("/boards/{board_id}/notices/{notice_id}")
def delete_board_notice(
    board_id: int,
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """게시판 공지사항을 삭제합니다. (게시판 관리자만 가능)"""
    print(f"🔍 게시판 {board_id} 공지사항 {notice_id} 삭제 요청 - 사용자: {current_user.nickname}")
    
    # 게시판 관리자 권한 확인
    if not check_board_admin_permission(board_id, current_user.id, db):
        raise HTTPException(status_code=403, detail="게시판 관리자 권한이 필요합니다")
    
    # 공지사항 존재 확인
    notice = db.query(BoardNotice).filter(
        BoardNotice.id == notice_id,
        BoardNotice.board_id == board_id
    ).first()
    
    if not notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    
    try:
        # 공지사항 비활성화 (소프트 삭제)
        notice.is_active = False
        db.commit()
        
        print(f"✅ 게시판 공지사항 삭제 완료 - ID: {notice.id}")
        return {"message": "공지사항이 삭제되었습니다"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ 게시판 공지사항 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="게시판 공지사항 삭제에 실패했습니다")
