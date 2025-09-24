#!/bin/bash

# 도메인 변경 스크립트: camsaw.kro.kr -> hoseolife.kro.kr
# 실행 전 반드시 hoseolife.kro.kr DNS가 서버 IP로 설정되어 있어야 합니다.

echo "🚀 도메인 변경 시작: camsaw.kro.kr -> hoseolife.kro.kr"
echo "=================================================="

# 1. DNS 확인
echo "📡 DNS 설정 확인 중..."
if ! nslookup hoseolife.kro.kr > /dev/null 2>&1; then
    echo "❌ 오류: hoseolife.kro.kr DNS 설정이 필요합니다!"
    echo "   DNS A 레코드를 서버 IP로 설정해주세요."
    exit 1
fi
echo "✅ DNS 설정 확인 완료"

# 2. 새 도메인용 SSL 인증서 발급
echo "🔐 SSL 인증서 발급 중..."
if ! sudo certbot certonly --nginx -d hoseolife.kro.kr --non-interactive --agree-tos --email dlckdfuf141@gmail.com; then
    echo "❌ 오류: SSL 인증서 발급 실패"
    echo "   - DNS 설정을 다시 확인해주세요"
    echo "   - 이메일 주소를 올바르게 설정해주세요"
    exit 1
fi
echo "✅ SSL 인증서 발급 완료"

# 3. Nginx 설정 파일 복사
echo "⚙️ Nginx 설정 파일 설정 중..."
sudo cp nginx_hoseolife_config.conf /etc/nginx/sites-available/hoseolife
sudo ln -sf /etc/nginx/sites-available/hoseolife /etc/nginx/sites-enabled/

# 4. 기존 도메인 설정 비활성화 (선택사항)
echo "🔄 기존 도메인 설정 비활성화 중..."
if [ -L /etc/nginx/sites-enabled/camsaw ]; then
    sudo rm /etc/nginx/sites-enabled/camsaw
    echo "✅ 기존 camsaw.kro.kr 설정 비활성화 완료"
fi

# 5. Nginx 설정 테스트
echo "🧪 Nginx 설정 테스트 중..."
if ! sudo nginx -t; then
    echo "❌ 오류: Nginx 설정 파일에 문제가 있습니다"
    exit 1
fi
echo "✅ Nginx 설정 테스트 통과"

# 6. Nginx 재시작
echo "🔄 Nginx 재시작 중..."
sudo systemctl reload nginx
echo "✅ Nginx 재시작 완료"

# 7. 새 도메인 테스트
echo "🌐 새 도메인 테스트 중..."
sleep 5
if curl -I https://hoseolife.kro.kr > /dev/null 2>&1; then
    echo "✅ hoseolife.kro.kr 연결 성공!"
else
    echo "⚠️ 경고: hoseolife.kro.kr 연결에 문제가 있을 수 있습니다"
fi

echo "=================================================="
echo "🎉 도메인 변경 완료!"
echo ""
echo "📋 다음 단계:"
echo "1. 프론트엔드 코드의 API_BASE_URL을 https://hoseolife.kro.kr로 변경"
echo "2. WebSocket URL을 wss://hoseolife.kro.kr로 변경"
echo "3. 앱을 다시 빌드하고 배포"
echo ""
echo "🔗 새 도메인: https://hoseolife.kro.kr"
echo "🔗 WebSocket: wss://hoseolife.kro.kr/ws/"
