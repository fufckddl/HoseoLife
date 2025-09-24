from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from fastapi.responses import JSONResponse
from app.services.s3_service import s3_service
import uuid
from typing import List, Optional

router = APIRouter(prefix="/upload", tags=["upload"])

@router.post("/image")
async def upload_image(file: UploadFile = File(...), filename: Optional[str] = Form(None)):
    """
    단일 이미지 업로드
    """
    try:
        # 파일 타입 검증
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
        
        # 파일 크기 검증 (10MB 제한)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail="파일 크기는 10MB를 초과할 수 없습니다.")
        
        # FormData에서 filename 파라미터 확인
        custom_filename = filename  # FormData에서 전달받은 filename
        original_filename = file.filename  # 실제 파일명
        print(f"🔍🔍🔍 업로드 요청 - FormData filename: {custom_filename}")
        print(f"🔍🔍🔍 업로드 요청 - 원본 filename: {original_filename}")
        print(f"🔍🔍🔍 파일 크기: {len(file_content)} bytes")
        print(f"🔍🔍🔍 Content-Type: {file.content_type}")
        
        # 파일명이 특정 폴더 구조를 포함하는 경우 그대로 사용
        # custom_filename 또는 original_filename에서 특정 prefix 확인
        if custom_filename and (custom_filename.startswith(('group/', 'chat/', 'users/', 'news/', 'notice/'))):
            s3_filename = custom_filename
            print(f"✅ FormData filename에서 특정 폴더 구조 사용: {s3_filename}")
        elif original_filename and (original_filename.startswith(('group/', 'chat/', 'users/', 'news/', 'notice/'))):
            s3_filename = original_filename
            print(f"✅ 파일명에서 특정 폴더 구조 사용: {s3_filename}")
        else:
            # 기본 posts 폴더에 고유한 파일명으로 저장
            file_extension = original_filename.split('.')[-1].lower() if '.' in original_filename else 'jpg'
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            s3_filename = f"posts/{unique_filename}"
            print(f"✅ 기본 posts 폴더 사용: {s3_filename}")
        
        # S3에 업로드
        s3_url = await s3_service.upload_image(
            file_data=file_content,
            filename=s3_filename,
            content_type=file.content_type
        )
        
        # 응답용 파일명 생성
        if custom_filename and (custom_filename.startswith(('group/', 'chat/', 'users/', 'news/', 'notice/'))):
            response_filename = custom_filename.split('/')[-1]  # 마지막 부분만 사용
        else:
            response_filename = s3_filename.split('/')[-1]  # posts/xxx -> xxx
        
        return JSONResponse(
            status_code=200,
            content={
                "url": s3_url,
                "filename": response_filename,
                "original_filename": original_filename,
                "size": len(file_content)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"이미지 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=f"이미지 업로드에 실패했습니다: {str(e)}")

@router.post("/images")
async def upload_multiple_images(files: List[UploadFile] = File(...)):
    """
    다중 이미지 업로드
    """
    try:
        # 파일 개수 제한 (5개)
        if len(files) > 5:
            raise HTTPException(status_code=400, detail="최대 5개의 이미지만 업로드 가능합니다.")
        
        results = []
        
        for file in files:
            # 파일 타입 검증
            if not file.content_type or not file.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"{file.filename}은 이미지 파일이 아닙니다.")
            
            # 파일 크기 검증 (10MB 제한)
            file_content = await file.read()
            if len(file_content) > 10 * 1024 * 1024:  # 10MB
                raise HTTPException(status_code=400, detail=f"{file.filename}의 크기는 10MB를 초과할 수 없습니다.")
            
            # 고유한 파일명 생성
            file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            
            # S3에 업로드
            s3_url = await s3_service.upload_image(
                file_data=file_content,
                filename=f"posts/{unique_filename}",
                content_type=file.content_type
            )
            
            results.append({
                "url": s3_url,
                "filename": unique_filename,
                "original_filename": file.filename,
                "size": len(file_content)
            })
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"{len(results)}개의 이미지가 성공적으로 업로드되었습니다.",
                "images": results
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"다중 이미지 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=f"이미지 업로드에 실패했습니다: {str(e)}")

@router.post("/group-image")
async def upload_group_image(file: UploadFile = File(...)):
    """
    그룹 대표 이미지 업로드
    """
    try:
        # 파일 타입 검증
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
        
        # 파일 크기 검증 (5MB 제한)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="파일 크기는 5MB를 초과할 수 없습니다.")
        
        # 고유한 파일명 생성 (임시 ID 사용)
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        temp_id = str(uuid.uuid4())[:8]  # 8자리 임시 ID
        
        # S3에 업로드 (group/temp-id/temp-id_image.jpg 구조)
        s3_url = await s3_service.upload_image(
            file_data=file_content,
            filename=f"group/{temp_id}/{temp_id}_image.{file_extension}",
            content_type=file.content_type
        )
        
        print(f"✅ 그룹 이미지 업로드 완료: {s3_url}")
        
        return JSONResponse(
            status_code=200,
            content={
                "image_url": s3_url,
                "filename": f"{temp_id}_image.{file_extension}",
                "original_filename": file.filename,
                "size": len(file_content),
                "temp_id": temp_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"그룹 이미지 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=f"그룹 이미지 업로드에 실패했습니다: {str(e)}")
