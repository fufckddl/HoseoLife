#!/bin/bash

# 기존 SSL 인증서를 새 도메인으로 복사하는 스크립트
# 임시 해결책으로 사용 (Let's Encrypt 속도 제한 우회)

echo "🔐 SSL 인증서 복사 시작..."
echo "=================================================="

# 1. 기존 인증서 디렉토리 확인
if [ ! -d "/etc/letsencrypt/live/camsaw.kro.kr" ]; then
    echo "❌ 오류: camsaw.kro.kr 인증서를 찾을 수 없습니다"
    exit 1
fi

# 2. 새 도메인 디렉토리 생성
echo "📁 새 도메인 디렉토리 생성 중..."
sudo mkdir -p /etc/letsencrypt/live/hoseolife.kro.kr
sudo mkdir -p /etc/letsencrypt/archive/hoseolife.kro.kr

# 3. 인증서 파일 복사
echo "📋 인증서 파일 복사 중..."
sudo cp /etc/letsencrypt/live/camsaw.kro.kr/fullchain.pem /etc/letsencrypt/live/hoseolife.kro.kr/
sudo cp /etc/letsencrypt/live/camsaw.kro.kr/privkey.pem /etc/letsencrypt/live/hoseolife.kro.kr/

# 4. archive 디렉토리 복사
sudo cp /etc/letsencrypt/archive/camsaw.kro.kr/* /etc/letsencrypt/archive/hoseolife.kro.kr/

# 5. 권한 설정
echo "🔒 파일 권한 설정 중..."
sudo chown -R root:root /etc/letsencrypt/live/hoseolife.kro.kr
sudo chown -R root:root /etc/letsencrypt/archive/hoseolife.kro.kr
sudo chmod 755 /etc/letsencrypt/live/hoseolife.kro.kr
sudo chmod 755 /etc/letsencrypt/archive/hoseolife.kro.kr
sudo chmod 644 /etc/letsencrypt/live/hoseolife.kro.kr/*.pem
sudo chmod 644 /etc/letsencrypt/archive/hoseolife.kro.kr/*.pem

# 6. Nginx 설정 적용
echo "⚙️ Nginx 설정 적용 중..."
sudo cp nginx_hoseolife_config.conf /etc/nginx/sites-available/hoseolife
sudo ln -sf /etc/nginx/sites-available/hoseolife /etc/nginx/sites-enabled/

# 7. Nginx 설정 테스트
echo "🧪 Nginx 설정 테스트 중..."
if ! sudo nginx -t; then
    echo "❌ 오류: Nginx 설정 파일에 문제가 있습니다"
    exit 1
fi

# 8. Nginx 재시작
echo "🔄 Nginx 재시작 중..."
sudo systemctl reload nginx

# 9. 테스트
echo "🌐 연결 테스트 중..."
sleep 3
if curl -I https://hoseolife.kro.kr > /dev/null 2>&1; then
    echo "✅ hoseolife.kro.kr 연결 성공!"
else
    echo "⚠️ 경고: 연결에 문제가 있을 수 있습니다"
fi

echo "=================================================="
echo "🎉 임시 SSL 인증서 설정 완료!"
echo ""
echo "⚠️ 주의사항:"
echo "- 이는 임시 해결책입니다"
echo "- 브라우저에서 인증서 경고가 나타날 수 있습니다"
echo "- 40분 후 Let's Encrypt에서 새 인증서를 발급받으세요"
echo ""
echo "📅 2025-08-27 10:14:21 UTC 이후에 다음 명령어로 새 인증서 발급:"
echo "sudo certbot certonly --nginx -d hoseolife.kro.kr --non-interactive --agree-tos --email dlckdfuf141@gmail.com"
