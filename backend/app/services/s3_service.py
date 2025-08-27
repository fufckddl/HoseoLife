import boto3
import os
from botocore.client import Config
from botocore.exceptions import ClientError
import re

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'ap-northeast-2')
S3_BUCKET = os.getenv('S3_BUCKET', 'camsaw-assets')

def _build_s3_client():
    # 자격증명이 있으면 명시적으로 사용, 없으면 인스턴스 프로파일/디폴트 체인 사용
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        print("S3 클라이언트: 환경변수 자격증명 사용")
        return boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            config=Config(s3={'addressing_style': 'path'})
        )
    else:
        print("S3 클라이언트: 디폴트 자격증명 체인 사용(EC2 IAM 역할 등)")
        return boto3.client(
            's3',
            region_name=AWS_REGION,
            config=Config(s3={'addressing_style': 'path'})
        )

_s3 = _build_s3_client()

def upload_chat_image(room_id: int, user_id: int, index: int, content_type: str, data: bytes) -> str:
    """S3에 채팅 이미지 업로드 후 퍼블릭 URL 반환.
    경로: chat/{room_id}/image_{user_id}_{index}.jpg
    확장자는 content_type을 보고 유도.
    """
    ext = 'jpg'
    if content_type:
        if 'png' in content_type:
            ext = 'png'
        elif 'jpeg' in content_type or 'jpg' in content_type:
            ext = 'jpg'
        elif 'webp' in content_type:
            ext = 'webp'

    key = f"chat/{room_id}/image_{user_id}_{index}.{ext}"
    _s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type or 'image/jpeg',
        ACL='public-read'
    )
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

import boto3
from botocore.exceptions import ClientError
import os
import uuid
from typing import Optional
from PIL import Image
import io

class S3Service:
    def __init__(self):
        self.s3_client = None
        self.bucket_name = None
        self._initialized = False
    
    def _initialize(self):
        """환경 변수가 로드된 후 S3 클라이언트를 초기화합니다."""
        if self._initialized:
            return
            
        # 환경 변수 확인
        aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
        aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        aws_region = os.getenv('AWS_REGION', 'ap-northeast-2')
        bucket_name = os.getenv('S3_BUCKET_NAME')
        
        if not aws_access_key or not aws_secret_key or not bucket_name:
            print("S3 환경 변수가 설정되지 않았습니다!")
            print(f"AWS_ACCESS_KEY_ID: {'설정됨' if aws_access_key else '설정되지 않음'}")
            print(f"AWS_SECRET_ACCESS_KEY: {'설정됨' if aws_secret_key else '설정되지 않음'}")
            print(f"S3_BUCKET_NAME: {'설정됨' if bucket_name else '설정되지 않음'}")
            raise Exception("S3 환경 변수가 설정되지 않았습니다.")
        
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        self.bucket_name = bucket_name
        self._initialized = True
        print(f"S3 서비스 초기화 완료: 버킷 {bucket_name}")
    
    def get_next_chat_index(self, room_id: int, user_id: int) -> int:
        """chat/{room_id}/image_{user_id}_X.* 키들 중 최대 X+1을 반환.
        키가 없으면 0 반환.
        """
        self._initialize()
        prefix = f"chat/{room_id}/image_{user_id}_"
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            page_iter = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
            max_idx = -1
            pattern = re.compile(rf"^{re.escape(prefix)}(\d+)\.")
            for page in page_iter:
                for obj in page.get('Contents', []) or []:
                    key = obj.get('Key', '')
                    m = pattern.match(key)
                    if m:
                        try:
                            idx = int(m.group(1))
                            if idx > max_idx:
                                max_idx = idx
                        except Exception:
                            continue
            return max_idx + 1
        except ClientError as e:
            print(f"S3 list_objects 오류: {e}")
            return 0

    
    async def upload_image(self, file_data: bytes, filename: str, content_type: str = 'image/jpeg') -> str:
        """
        이미지를 S3에 업로드하고 URL을 반환합니다.
        """
        self._initialize()
        
        print(f"S3 업로드 - 전달받은 filename: {filename}")
        try:
            # 이미지 최적화 (선택사항)
            optimized_image_data = await self._optimize_image(file_data)

            # 파일명 정규화 및 상위 폴더 결정
            norm = (filename or '').lstrip('/')
            # chat/, users/, news/, notice/, posts/ 로 시작하면 그대로 사용
            if norm.startswith(('chat/', 'users/', 'news/', 'notice/', 'posts/')):
                s3_key = norm
            else:
                # 기본 posts 폴더로 수용
                s3_key = f"posts/{norm}"
            print(f"S3 업로드 - 최종 Key: {s3_key}")

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=optimized_image_data,
                ContentType=content_type,
                CacheControl='max-age=31536000'  # 1년 캐시
            )

            final_url = f"https://{self.bucket_name}.s3.ap-northeast-2.amazonaws.com/{s3_key}"
            print(f"S3 업로드 - 최종 URL: {final_url}")

            return final_url
        except ClientError as e:
            print(f"S3 업로드 오류: {e}")
            raise Exception(f"이미지 업로드에 실패했습니다: {e}")
    
    async def upload_profile_image(self, file_data: bytes, user_id: int, original_filename: str) -> str:
        """
        사용자 프로필 이미지를 S3에 업로드하고 URL을 반환합니다.
        """
        self._initialize()
        
        try:
            # 기존 프로필 이미지 삭제 시도
            await self.delete_profile_image(user_id)
            
            # 이미지 최적화
            optimized_image_data = await self._optimize_image(file_data)
            
            # 파일 확장자 추출
            file_extension = original_filename.split('.')[-1].lower()
            if file_extension not in ['jpg', 'jpeg', 'png', 'gif']:
                file_extension = 'jpg'  # 기본값
            
            # S3 키 생성: users/user_id/image.jpg
            s3_key = f"users/{user_id}/image.{file_extension}"
            print(f"프로필 이미지 업로드 - S3 Key: {s3_key}")
            
            # Content-Type 설정
            content_type = f"image/{file_extension}" if file_extension != 'jpg' else 'image/jpeg'
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=optimized_image_data,
                ContentType=content_type,
                CacheControl='max-age=31536000'  # 1년 캐시
            )

            final_url = f"https://{self.bucket_name}.s3.ap-northeast-2.amazonaws.com/{s3_key}"
            print(f"프로필 이미지 업로드 완료 - URL: {final_url}")

            return final_url
        except ClientError as e:
            print(f"프로필 이미지 업로드 오류: {e}")
            raise Exception(f"프로필 이미지 업로드에 실패했습니다: {e}")
        except Exception as e:
            print(f"프로필 이미지 업로드 일반 오류: {e}")
            raise Exception(f"프로필 이미지 업로드에 실패했습니다: {e}")
    
    async def delete_profile_image(self, user_id: int) -> bool:
        """
        사용자 프로필 이미지를 S3에서 삭제합니다.
        """
        self._initialize()
        
        try:
            # 여러 확장자 시도
            extensions = ['jpg', 'jpeg', 'png', 'gif']
            for ext in extensions:
                s3_key = f"users/{user_id}/image.{ext}"
                try:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=s3_key
                    )
                    print(f"프로필 이미지 삭제 완료: {s3_key}")
                    return True
                except ClientError:
                    continue
            
            return False
        except Exception as e:
            print(f"프로필 이미지 삭제 오류: {e}")
            return False
    
    async def delete_image(self, image_url: str) -> bool:
        """
        S3에서 이미지를 삭제합니다.
        """
        self._initialize()
        
        try:
            # URL에서 키 추출
            key = image_url.split('/posts/')[-1]
            
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=f"posts/{key}"
            )
            return True
            
        except ClientError as e:
            print(f"S3 삭제 오류: {e}")
            return False
    
    async def _optimize_image(self, image_data: bytes) -> bytes:
        """
        이미지를 최적화합니다 (선택사항).
        """
        try:
            # PIL로 이미지 열기
            image = Image.open(io.BytesIO(image_data))
            
            # 이미지가 너무 크면 리사이즈 (업로드 바디 축소)
            max_size = (1280, 1280)
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # JPEG로 변환하여 용량 줄이기 (품질 80%)
            output = io.BytesIO()
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            image.save(output, format='JPEG', quality=80, optimize=True)
            output.seek(0)
            
            return output.getvalue()
            
        except Exception as e:
            print(f"이미지 최적화 오류: {e}")
            # 최적화 실패 시 원본 반환
            return image_data
    
    def generate_filename(self, original_filename: str) -> str:
        """
        고유한 파일명을 생성합니다.
        """
        file_extension = original_filename.split('.')[-1].lower()
        unique_id = str(uuid.uuid4())
        return f"{unique_id}.{file_extension}"

# 전역 S3 서비스 인스턴스
s3_service = S3Service() 