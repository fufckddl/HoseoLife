#!/bin/bash

# 로컬에서 실행할 배포 스크립트

echo "🚀 Hoseolife.kro.kr 웹사이트 배포 시작..."

# 서버 정보 설정
SERVER_USER="your-username"  # 서버 사용자명
SERVER_HOST="your-server-ip"  # 서버 IP 또는 도메인
SERVER_WEB_PATH="/var/www/hoseolife.kro.kr"  # 웹 루트 경로
SERVER_PROJECT_PATH="/var/www/hoseolife-web"  # 프로젝트 경로

# 1. 로컬 빌드
echo "📦 로컬에서 프로덕션 빌드 생성..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패!"
    exit 1
fi

echo "✅ 빌드 완료!"

# 2. 서버에 프로젝트 파일 업로드 (첫 배포 시)
echo "📤 서버에 프로젝트 파일 업로드..."
rsync -avz --exclude node_modules --exclude .git --exclude dist . $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/site/

# 3. 서버에서 빌드 및 배포 실행
echo "🔨 서버에서 빌드 및 배포 실행..."
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PROJECT_PATH/site && chmod +x server-deploy.sh && ./server-deploy.sh"

if [ $? -eq 0 ]; then
    echo "🎉 배포가 완료되었습니다!"
    echo "🌐 https://hoseolife.kro.kr 에서 확인하세요."
else
    echo "❌ 배포 실패!"
    exit 1
fi
