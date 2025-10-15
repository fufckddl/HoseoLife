#!/bin/bash

echo "🛡️  HoseoLife 보안 설정 적용 시작..."

# 백업 생성
echo "📁 기존 설정 백업 중..."
sudo cp /etc/nginx/sites-available/hoseolife /etc/nginx/sites-available/hoseolife.backup.$(date +%Y%m%d_%H%M%S)

# 새로운 보안 설정 적용
echo "🔒 보안 설정 적용 중..."
sudo cp /Users/dlckdfuf/Desktop/camsaw/nginx_hoseolife_secure.conf /etc/nginx/sites-available/hoseolife

# nginx 설정 테스트
echo "🧪 nginx 설정 테스트 중..."
if sudo nginx -t; then
    echo "✅ nginx 설정 테스트 성공!"
    
    # nginx 재시작
    echo "🔄 nginx 재시작 중..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ nginx 재시작 성공!"
        echo "🛡️  보안 설정이 성공적으로 적용되었습니다!"
        echo ""
        echo "📋 적용된 보안 기능:"
        echo "   • 의심스러운 IP 차단"
        echo "   • Git 저장소 접근 차단"
        echo "   • JasperServer 접근 차단"
        echo "   • GeoServer 접근 차단"
        echo "   • 관리자 페이지 접근 차단"
        echo "   • WebDAV 메서드 차단"
        echo "   • 악성 봇 차단"
        echo "   • 강화된 보안 헤더"
        echo ""
        echo "🔍 로그 모니터링:"
        echo "   • sudo tail -f /var/log/nginx/api_access.log"
        echo "   • sudo tail -f /var/log/nginx/api_error.log"
    else
        echo "❌ nginx 재시작 실패!"
        echo "🔄 백업 설정으로 복원 중..."
        sudo cp /etc/nginx/sites-available/hoseolife.backup.* /etc/nginx/sites-available/hoseolife
        sudo systemctl reload nginx
        exit 1
    fi
else
    echo "❌ nginx 설정 테스트 실패!"
    echo "🔄 백업 설정으로 복원 중..."
    sudo cp /etc/nginx/sites-available/hoseolife.backup.* /etc/nginx/sites-available/hoseolife
    exit 1
fi

echo ""
echo "🎉 보안 설정 완료! 이제 해킹 시도들이 차단됩니다."


