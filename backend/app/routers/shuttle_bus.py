from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.db.database import get_db
from app.models.shuttle_bus import ShuttleBus
from app.schemas.shuttle_bus import (
    ShuttleBusCreate, 
    ShuttleBusUpdate, 
    ShuttleBusResponse,
    ShuttleBusListResponse
)
from app.routers.user import get_current_user
from app.models.user import User

router = APIRouter(prefix="/shuttle-buses", tags=["shuttle-buses"])

@router.get("/", response_model=ShuttleBusListResponse)
async def get_shuttle_buses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    type: Optional[str] = Query(None, description="버스 타입 필터 (shuttle/city)"),
    is_active: Optional[bool] = Query(True, description="운행 여부 필터"),
    db: Session = Depends(get_db)
):
    """셔틀버스 목록 조회"""
    query = db.query(ShuttleBus)
    
    if type:
        query = query.filter(ShuttleBus.type == type)
    if is_active is not None:
        # is_active가 True인 경우: is_active가 True이거나 null인 경우를 포함
        # is_active가 False인 경우: is_active가 False인 경우만
        if is_active:
            query = query.filter((ShuttleBus.is_active == True) | (ShuttleBus.is_active.is_(None)))
        else:
            query = query.filter(ShuttleBus.is_active == False)
    
    total = query.count()
    shuttle_buses = query.offset(skip).limit(limit).all()
    
    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1
    
    return ShuttleBusListResponse(
        items=shuttle_buses,
        total=total,
        page=page,
        size=limit,
        pages=pages
    )

@router.get("/{shuttle_bus_id}", response_model=ShuttleBusResponse)
async def get_shuttle_bus(
    shuttle_bus_id: int,
    db: Session = Depends(get_db)
):
    """특정 셔틀버스 조회"""
    shuttle_bus = db.query(ShuttleBus).filter(ShuttleBus.id == shuttle_bus_id).first()
    if not shuttle_bus:
        raise HTTPException(status_code=404, detail="셔틀버스를 찾을 수 없습니다")
    return shuttle_bus

@router.post("/", response_model=ShuttleBusResponse)
async def create_shuttle_bus(
    shuttle_bus: ShuttleBusCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """새 셔틀버스 생성 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    
    db_shuttle_bus = ShuttleBus(**shuttle_bus.dict())
    db.add(db_shuttle_bus)
    db.commit()
    db.refresh(db_shuttle_bus)
    return db_shuttle_bus

@router.put("/{shuttle_bus_id}", response_model=ShuttleBusResponse)
async def update_shuttle_bus(
    shuttle_bus_id: int,
    shuttle_bus_update: ShuttleBusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """셔틀버스 정보 수정 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    
    db_shuttle_bus = db.query(ShuttleBus).filter(ShuttleBus.id == shuttle_bus_id).first()
    if not db_shuttle_bus:
        raise HTTPException(status_code=404, detail="셔틀버스를 찾을 수 없습니다")
    
    update_data = shuttle_bus_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_shuttle_bus, field, value)
    
    db.commit()
    db.refresh(db_shuttle_bus)
    return db_shuttle_bus

@router.delete("/{shuttle_bus_id}")
async def delete_shuttle_bus(
    shuttle_bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """셔틀버스 삭제 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    
    db_shuttle_bus = db.query(ShuttleBus).filter(ShuttleBus.id == shuttle_bus_id).first()
    if not db_shuttle_bus:
        raise HTTPException(status_code=404, detail="셔틀버스를 찾을 수 없습니다")
    
    db.delete(db_shuttle_bus)
    db.commit()
    return {"message": "셔틀버스가 삭제되었습니다"}

@router.get("/debug/all")
async def debug_get_all_shuttle_buses(db: Session = Depends(get_db)):
    """디버깅용: 모든 셔틀버스 데이터 조회 (인증 불필요)"""
    try:
        # 테이블 존재 여부 확인
        result = db.execute(text("SHOW TABLES LIKE 'shuttle_buses'"))
        table_exists = result.fetchone() is not None
        
        if not table_exists:
            return {"error": "shuttle_buses 테이블이 존재하지 않습니다", "table_exists": False}
        
        # 모든 데이터 조회
        all_buses = db.query(ShuttleBus).all()
        
        # 테이블 구조 확인
        result = db.execute(text("DESCRIBE shuttle_buses"))
        table_structure = result.fetchall()
        
        return {
            "table_exists": True,
            "total_count": len(all_buses),
            "buses": [
                {
                    "id": bus.id,
                    "name": bus.name,
                    "route": bus.route,
                    "type": bus.type,
                    "is_active": bus.is_active,
                    "stops": bus.stops,
                    "schedule_count": len(bus.schedule) if bus.schedule else 0
                } for bus in all_buses
            ],
            "table_structure": [{"Field": row[0], "Type": row[1], "Null": row[2], "Key": row[3], "Default": row[4], "Extra": row[5]} for row in table_structure]
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}
