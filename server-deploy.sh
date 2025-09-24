#!/bin/bash

# 서버에서 실행할 배포 스크립트
# /var/www/hoseolife-web/site/server-deploy.sh

echo "🚀 Hoseolife.kro.kr 웹사이트 배포 시작..."

# 1. 프로젝트 디렉토리로 이동
cd /camsaw/web

# 2. 최신 코드 가져오기 (Git 사용 시)
echo "📥 최신 코드 가져오기..."
# git pull origin main  # Git을 사용하지 않는 경우 주석 처리

# 3. 의존성 설치
echo "📦 의존성 설치..."
npm install

# 4. 프로덕션 빌드
echo "🔨 프로덕션 빌드 생성..."
VITE_API_BASE_URL=https://hoseolife.kro.kr/api npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패!"
    exit 1
fi

# 5. 기존 파일 백업
echo "💾 기존 파일 백업..."
sudo cp -r /var/www/hoseolife.kro.kr /var/www/hoseolife.kro.kr.backup.$(date +%Y%m%d_%H%M%S)

# 6. 새 파일 배포
echo "📤 새 파일 배포..."
sudo rm -rf /var/www/hoseolife.kro.kr/*
sudo cp -r dist/* /var/www/hoseolife.kro.kr/

# 7. 권한 설정 (EC2용)
echo "🔐 권한 설정..."
sudo chown -R nginx:nginx /var/www/hoseolife.kro.kr
sudo chmod -R 755 /var/www/hoseolife.kro.kr

# 8. Nginx 설정 확인 및 재시작 (EC2용)
echo "🔧 Nginx 설정 확인..."
sudo cp nginx_hoseolife_web_config.conf /etc/nginx/conf.d/hoseolife.conf
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 설정 확인 완료"
    sudo systemctl reload nginx
    echo "🔄 Nginx 재시작 완료"
else
    echo "❌ Nginx 설정 오류!"
    exit 1
fi

# 9. 배포 완료
echo "🎉 배포가 완료되었습니다!"
echo "🌐 https://hoseolife.kro.kr 에서 확인하세요."

# 10. 상태 확인
echo "📊 서비스 상태 확인..."
sudo systemctl status nginx --no-pager -l
sudo systemctl status your-backend-service --no-pager -l
