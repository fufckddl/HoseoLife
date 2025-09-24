from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.building import Building, CampusType, BuildingType
from app.schemas.building import BuildingCreate, BuildingUpdate, BuildingResponse, Coordinate
from app.models.user import User
from app.routers.user import get_current_user

router = APIRouter(prefix="/buildings", tags=["buildings"])

@router.get("/", response_model=List[BuildingResponse])
async def get_all_buildings(db: Session = Depends(get_db)):
    """모든 건물 정보 조회"""
    buildings = db.query(Building).all()
    return buildings

@router.get("/{campus}", response_model=List[BuildingResponse])
async def get_buildings_by_campus(campus: CampusType, db: Session = Depends(get_db)):
    """캠퍼스별 건물 정보 조회"""
    buildings = db.query(Building).filter(Building.campus == campus).all()
    return buildings

@router.get("/{campus}/{building_id}", response_model=BuildingResponse)
async def get_building(campus: CampusType, building_id: str, db: Session = Depends(get_db)):
    """특정 건물 정보 조회"""
    building = db.query(Building).filter(
        Building.campus == campus,
        Building.id == building_id
    ).first()
    
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건물을 찾을 수 없습니다."
        )
    
    return building

@router.post("/", response_model=BuildingResponse)
async def create_building(
    building: BuildingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """새 건물 추가 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="건물 추가 권한이 없습니다."
        )
    
    # 기존 건물 ID 중복 확인
    existing_building = db.query(Building).filter(Building.id == building.id).first()
    if existing_building:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 건물 ID입니다."
        )
    
    # 새 건물 생성
    db_building = Building(
        id=building.id,
        name=building.name,
        campus=building.campus,
        latitude=building.latitude,
        longitude=building.longitude,
        radius=building.radius,
        building_type=building.building_type,
        coordinates=[{"latitude": coord.latitude, "longitude": coord.longitude} for coord in building.coordinates],
        description=building.description
    )
    
    db.add(db_building)
    db.commit()
    db.refresh(db_building)
    
    return db_building

@router.put("/{building_id}", response_model=BuildingResponse)
async def update_building(
    building_id: str,
    building_update: BuildingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """건물 정보 수정 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="건물 수정 권한이 없습니다."
        )
    
    # 기존 건물 조회
    db_building = db.query(Building).filter(Building.id == building_id).first()
    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건물을 찾을 수 없습니다."
        )
    
    # 업데이트할 필드만 수정
    update_data = building_update.dict(exclude_unset=True)
    
    # coordinates 필드가 있는 경우 JSON 형태로 변환
    if "coordinates" in update_data:
        update_data["coordinates"] = [
            {"latitude": coord.latitude, "longitude": coord.longitude} 
            for coord in update_data["coordinates"]
        ]
    
    for field, value in update_data.items():
        setattr(db_building, field, value)
    
    db.commit()
    db.refresh(db_building)
    
    return db_building

@router.delete("/{building_id}")
async def delete_building(
    building_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """건물 삭제 (관리자만)"""
    # 관리자 권한 확인
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="건물 삭제 권한이 없습니다."
        )
    
    # 기존 건물 조회
    db_building = db.query(Building).filter(Building.id == building_id).first()
    if not db_building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건물을 찾을 수 없습니다."
        )
    
    db.delete(db_building)
    db.commit()
    
    return {"message": "건물이 성공적으로 삭제되었습니다."}
