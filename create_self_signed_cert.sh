#!/bin/bash

# Self-signed SSL 인증서 생성 스크립트
# 임시 해결책으로 사용

echo "🔐 Self-signed SSL 인증서 생성 시작..."
echo "=================================================="

# 1. 디렉토리 생성
echo "📁 디렉토리 생성 중..."
sudo mkdir -p /etc/letsencrypt/live/hoseolife.kro.kr
sudo mkdir -p /etc/ssl/private

# 2. Self-signed 인증서 생성
echo "📋 Self-signed 인증서 생성 중..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/hoseolife.kro.kr/privkey.pem \
    -out /etc/letsencrypt/live/hoseolife.kro.kr/fullchain.pem \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=Hoseolife/OU=IT/CN=hoseolife.kro.kr"

# 3. 권한 설정
echo "🔒 파일 권한 설정 중..."
sudo chown -R root:root /etc/letsencrypt/live/hoseolife.kro.kr
sudo chmod 755 /etc/letsencrypt/live/hoseolife.kro.kr
sudo chmod 644 /etc/letsencrypt/live/hoseolife.kro.kr/*.pem

# 4. Nginx 설정 적용
echo "⚙️ Nginx 설정 적용 중..."
sudo cp nginx_hoseolife_config.conf /etc/nginx/sites-available/hoseolife
sudo ln -sf /etc/nginx/sites-available/hoseolife /etc/nginx/sites-enabled/

# 5. Nginx 설정 테스트
echo "🧪 Nginx 설정 테스트 중..."
if ! sudo nginx -t; then
    echo "❌ 오류: Nginx 설정 파일에 문제가 있습니다"
    exit 1
fi

# 6. Nginx 재시작
echo "🔄 Nginx 재시작 중..."
sudo systemctl reload nginx

echo "=================================================="
echo "🎉 Self-signed 인증서 설정 완료!"
echo ""
echo "⚠️ 주의사항:"
echo "- 브라우저에서 보안 경고가 나타납니다"
echo "- '고급' → '안전하지 않은 사이트로 이동' 클릭 필요"
echo "- 40분 후 Let's Encrypt에서 정식 인증서를 발급받으세요"
