from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.board_request import BoardRequest
from app.models.board import Board
from app.models.user import User
from app.schemas.board_request import BoardRequestCreate, BoardRequestResponse, BoardRequestUpdate
from app.schemas.board import BoardResponse
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

@router.get("/boards/{board_id}", response_model=BoardResponse)
def get_board(board_id: int, db: Session = Depends(get_db)):
    """특정 게시판 정보 조회"""
    try:
        board = db.query(Board).filter(Board.id == board_id, Board.is_active == True).first()
        
        if not board:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="게시판을 찾을 수 없습니다."
            )
        
        return BoardResponse(
            id=board.id,
            name=board.name,
            description=board.description,
            is_active=board.is_active,
            created_at=board.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"게시판 정보 조회에 실패했습니다: {str(e)}"
        )
