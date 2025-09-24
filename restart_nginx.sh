#!/bin/bash

# nginx 설정 적용 및 재시작 스크립트
echo "🚀 nginx 설정 적용 및 재시작 시작..."

# 1. 기존 설정 백업
echo "📦 기존 설정 백업 중..."
sudo cp /etc/nginx/sites-available/hoseolife /etc/nginx/sites-available/hoseolife.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "기존 hoseolife 설정 파일이 없습니다."

# 2. 새 설정 파일 적용
echo "📝 새 설정 파일 적용 중..."
sudo cp nginx_hoseolife_web_config.conf /etc/nginx/sites-available/hoseolife

# 3. 심볼릭 링크 생성 (sites-enabled)
echo "🔗 심볼릭 링크 생성 중..."
sudo ln -sf /etc/nginx/sites-available/hoseolife /etc/nginx/sites-enabled/

# 4. nginx 설정 테스트
echo "🧪 nginx 설정 테스트 중..."
if sudo nginx -t; then
    echo "✅ nginx 설정이 올바릅니다."
    
    # 5. nginx 재시작
    echo "🔄 nginx 재시작 중..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ nginx가 성공적으로 재시작되었습니다."
        echo "🌐 WebSocket 설정이 적용되었습니다:"
        echo "   - hoseolife.kro.kr/chat/ws/"
        echo "   - hoseolife.kro.kr/api/"
        echo "   - hoseolife.kro.kr/web/"
        
        # 6. nginx 상태 확인
        echo "📊 nginx 상태 확인:"
        sudo systemctl status nginx --no-pager -l
    else
        echo "❌ nginx 재시작에 실패했습니다."
        exit 1
    fi
else
    echo "❌ nginx 설정에 오류가 있습니다."
    echo "설정을 확인하고 다시 시도해주세요."
    exit 1
fi

echo "🎉 nginx 설정 적용 및 재시작 완료!"
