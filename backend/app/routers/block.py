from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models.user import User
from app.models.block import Block
from app.routers.user import get_current_user
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/blocks", tags=["blocks"])

# Schema
class BlockCreate(BaseModel):
    blocked_user_id: int

class BlockResponse(BaseModel):
    id: int
    blocker_id: int
    blocked_id: int
    blocked_user_nickname: str
    blocked_user_profile_image: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# 사용자 차단
@router.post("/", status_code=201)
def block_user(
    block_data: BlockCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """다른 사용자를 차단합니다"""
    
    # 자기 자신을 차단하려는 경우
    if block_data.blocked_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신을 차단할 수 없습니다.")
    
    # 차단하려는 사용자가 존재하는지 확인
    blocked_user = db.query(User).filter(User.id == block_data.blocked_user_id).first()
    if not blocked_user:
        raise HTTPException(status_code=404, detail="차단하려는 사용자를 찾을 수 없습니다.")
    
    # 이미 차단했는지 확인
    existing_block = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == block_data.blocked_user_id,
        Block.is_active == True
    ).first()
    
    if existing_block:
        raise HTTPException(status_code=400, detail="이미 차단한 사용자입니다.")
    
    # 차단 생성
    new_block = Block(
        blocker_id=current_user.id,
        blocked_id=block_data.blocked_user_id
    )
    
    db.add(new_block)
    db.commit()
    db.refresh(new_block)
    
    return {
        "message": "사용자를 차단했습니다.",
        "blocked_user_id": block_data.blocked_user_id,
        "blocked_user_nickname": blocked_user.nickname
    }

# 차단 해제
@router.delete("/{blocked_user_id}")
def unblock_user(
    blocked_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 차단을 해제합니다"""
    
    # 차단 기록 찾기
    block = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == blocked_user_id,
        Block.is_active == True
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="차단 기록을 찾을 수 없습니다.")
    
    # 차단 해제
    block.is_active = False
    db.commit()
    
    return {"message": "차단을 해제했습니다."}

# 내가 차단한 사용자 목록
@router.get("/my-blocks", response_model=List[BlockResponse])
def get_my_blocks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내가 차단한 사용자 목록을 조회합니다"""
    
    blocks = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.is_active == True
    ).all()
    
    result = []
    for block in blocks:
        blocked_user = db.query(User).filter(User.id == block.blocked_id).first()
        if blocked_user:
            result.append(BlockResponse(
                id=block.id,
                blocker_id=block.blocker_id,
                blocked_id=block.blocked_id,
                blocked_user_nickname=blocked_user.nickname,
                blocked_user_profile_image=blocked_user.profile_image_url,
                created_at=block.created_at
            ))
    
    return result

# 특정 사용자를 차단했는지 확인
@router.get("/check/{user_id}")
def check_block_status(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """특정 사용자를 차단했는지 확인합니다"""
    
    block = db.query(Block).filter(
        Block.blocker_id == current_user.id,
        Block.blocked_id == user_id,
        Block.is_active == True
    ).first()
    
    return {"is_blocked": block is not None}

