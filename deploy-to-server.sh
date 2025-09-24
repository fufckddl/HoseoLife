#!/bin/bash

# 서버 정보
SERVER_IP="your-server-host"
SERVER_USER="ec2-user"
PEM_FILE="$HOME/Downloads/camsaw.pem"

echo "🚀 CamSaw 서버 배포 시작..."

# PEM 파일 권한 확인
if [ ! -f "$PEM_FILE" ]; then
    echo "❌ PEM 파일을 찾을 수 없습니다: $PEM_FILE"
    exit 1
fi

chmod 600 "$PEM_FILE"

# 1. 백엔드 파일 업로드
echo "📤 백엔드 파일 업로드 중..."
scp -i "$PEM_FILE" -r backend/ "$SERVER_USER@$SERVER_IP:/tmp/camsaw-backend-new/"

# 2. 프론트엔드 파일 업로드  
echo "📤 프론트엔드 파일 업로드 중..."
scp -i "$PEM_FILE" -r frontend/ "$SERVER_USER@$SERVER_IP:/tmp/camsaw-frontend-new/"

# 3. 서버에서 배포 스크립트 실행
echo "🔧 서버에서 배포 실행 중..."
ssh -i "$PEM_FILE" "$SERVER_USER@$SERVER_IP" << 'EOF'
#!/bin/bash
set -e

echo "🔄 서버 배포 시작..."

# 백엔드 배포
if [ -d "/tmp/camsaw-backend-new" ]; then
    echo "📦 백엔드 업데이트 중..."
    sudo systemctl stop camsaw-backend || true
    
    # 백업
    sudo cp -r /camsaw/backend /camsaw/backend.backup.$(date +%Y%m%d_%H%M%S) || true
    
    # 새 파일 적용
    sudo rm -rf /camsaw/backend
    sudo mv /tmp/camsaw-backend-new /camsaw/backend
    sudo chown -R ec2-user:ec2-user /camsaw/backend
    
    # 의존성 설치
    cd /camsaw/backend
    pip3 install -r requirements.txt --user
    
    # 마이그레이션 실행
    echo "🔧 데이터베이스 마이그레이션 실행..."
    python3 migrate_split_lecture_time_room.py
    
    # 서비스 재시작
    sudo systemctl start camsaw-backend
    sudo systemctl enable camsaw-backend
    
    echo "✅ 백엔드 배포 완료"
fi

# 프론트엔드 배포
if [ -d "/tmp/camsaw-frontend-new" ]; then
    echo "📦 프론트엔드 업데이트 중..."
    
    # 백업
    sudo cp -r /camsaw/frontend /camsaw/frontend.backup.$(date +%Y%m%d_%H%M%S) || true
    
    # 새 파일 적용
    sudo rm -rf /camsaw/frontend
    sudo mv /tmp/camsaw-frontend-new /camsaw/frontend
    sudo chown -R ec2-user:ec2-user /camsaw/frontend
    
    echo "✅ 프론트엔드 배포 완료"
fi

# 서비스 상태 확인
echo "📊 서비스 상태 확인..."
sudo systemctl status camsaw-backend --no-pager -l || true
sudo systemctl status nginx --no-pager -l || true

echo "🎉 서버 배포 완료!"
echo "🌐 https://hoseolife.kro.kr 에서 확인하세요"
EOF

echo "✅ 배포 완료!"
