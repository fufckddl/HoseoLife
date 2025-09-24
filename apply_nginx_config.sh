#!/bin/bash

# Nginx WebSocket 설정 적용 스크립트
# 서버에서 실행해야 합니다.

echo "=== Nginx WebSocket 설정 적용 시작 ==="

# 1. 기존 설정 백업
echo "1. 기존 설정 백업 중..."
sudo cp /etc/nginx/sites-available/camsaw /etc/nginx/sites-available/camsaw.backup.$(date +%Y%m%d_%H%M%S)

# 2. 새 설정 파일 적용
echo "2. 새 설정 파일 적용 중..."
sudo cp nginx_websocket_config.conf /etc/nginx/sites-available/camsaw

# 3. Nginx 설정 문법 검사
echo "3. Nginx 설정 문법 검사 중..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 설정 문법 검사 통과"
    
    # 4. Nginx 재시작
    echo "4. Nginx 재시작 중..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx 재시작 성공"
        echo "=== WebSocket 설정 적용 완료 ==="
        
        # 5. WebSocket 연결 테스트
        echo "5. WebSocket 연결 테스트 중..."
        curl -I https://camsaw.kro.kr/ws/1
        
        echo ""
        echo "🎉 WebSocket 설정이 성공적으로 적용되었습니다!"
        echo "이제 wss://camsaw.kro.kr/ws/ 엔드포인트를 사용할 수 있습니다."
        
    else
        echo "❌ Nginx 재시작 실패"
        echo "로그를 확인해주세요: sudo journalctl -u nginx -f"
        exit 1
    fi
else
    echo "❌ Nginx 설정 문법 오류"
    echo "설정 파일을 확인해주세요."
    exit 1
fi
