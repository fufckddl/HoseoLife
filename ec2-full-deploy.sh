#!/bin/bash

# EC2 서버 전체 배포 스크립트
# /home/ec2-user/ec2-full-deploy.sh

echo "🚀 Hoseolife.kro.kr 전체 배포 시작..."

# 1. 웹 디렉토리 생성
echo "📁 웹 디렉토리 생성..."
sudo mkdir -p /var/www/hoseolife.kro.kr
sudo mkdir -p /camsaw/web

# 2. 권한 설정
echo "🔐 권한 설정..."
sudo chown -R nginx:nginx /var/www/hoseolife.kro.kr
sudo chown -R ec2-user:ec2-user /camsaw/web

# 3. Node.js 설치 확인 및 설치
echo "📦 Node.js 설치 확인..."
if ! command -v node &> /dev/null; then
    echo "Node.js 설치 중..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
else
    echo "Node.js 이미 설치됨: $(node --version)"
fi

# 4. 웹사이트 빌드 및 배포
echo "🔨 웹사이트 빌드 및 배포..."
cd /camsaw/web

# 의존성 설치
echo "📦 의존성 설치..."
npm install

# 프로덕션 빌드
echo "🔨 프로덕션 빌드 생성..."
VITE_API_BASE_URL=https://hoseolife.kro.kr/api npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패!"
    exit 1
fi

# 기존 파일 백업
echo "💾 기존 파일 백업..."
sudo cp -r /var/www/hoseolife.kro.kr /var/www/hoseolife.kro.kr.backup.$(date +%Y%m%d_%H%M%S)

# 새 파일 배포
echo "📤 새 파일 배포..."
sudo rm -rf /var/www/hoseolife.kro.kr/*
sudo cp -r dist/* /var/www/hoseolife.kro.kr/

# 권한 설정
echo "🔐 권한 설정..."
sudo chown -R nginx:nginx /var/www/hoseolife.kro.kr
sudo chmod -R 755 /var/www/hoseolife.kro.kr

# 5. Nginx 설정 업데이트
echo "🔧 Nginx 설정 업데이트..."
sudo cp /camsaw/web/nginx_hoseolife_web_config.conf /etc/nginx/conf.d/hoseolife.conf

# Nginx 설정 테스트
echo "🔍 Nginx 설정 테스트..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 설정 확인 완료"
    sudo systemctl reload nginx
    echo "🔄 Nginx 재시작 완료"
else
    echo "❌ Nginx 설정 오류!"
    exit 1
fi

# 6. 백엔드 서비스 시작 (가상환경에서)
echo "🐍 백엔드 서비스 시작..."
cd /camsaw
source venv/bin/activate
cd app

# 백엔드가 이미 실행 중인지 확인
if pgrep -f "python.*main.py" > /dev/null; then
    echo "✅ 백엔드 서비스가 이미 실행 중입니다"
else
    echo "🚀 백엔드 서비스 시작..."
    nohup python main.py > /var/log/hoseolife-backend.log 2>&1 &
    echo "✅ 백엔드 서비스 시작 완료"
fi

# 7. 서비스 상태 확인
echo "📊 서비스 상태 확인..."
echo "Nginx 상태:"
sudo systemctl status nginx --no-pager -l

echo "백엔드 프로세스:"
ps aux | grep "python.*main.py" | grep -v grep

echo "포트 확인:"
sudo netstat -tlnp | grep -E ":(80|443|5000)"

# 8. 배포 완료
echo "🎉 배포가 완료되었습니다!"
echo "🌐 https://hoseolife.kro.kr/web/ 에서 확인하세요."
echo "🔗 API: https://hoseolife.kro.kr/api/"
echo "📝 로그: /var/log/hoseolife-backend.log"
