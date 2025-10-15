#!/bin/bash

echo "🔍 HoseoLife 보안 모니터링 도구"
echo "================================"
echo ""

# 실시간 로그 모니터링 함수
monitor_logs() {
    echo "📊 실시간 로그 모니터링 (Ctrl+C로 종료)"
    echo "----------------------------------------"
    sudo tail -f /var/log/nginx/api_access.log /var/log/nginx/api_error.log | grep -E "(444|403|405|404)" --color=always
}

# 차단된 요청 통계
show_blocked_stats() {
    echo "🚫 최근 24시간 차단된 요청 통계"
    echo "--------------------------------"
    
    echo "📈 444 (연결 종료) 요청:"
    sudo grep "444" /var/log/nginx/api_access.log | tail -10
    
    echo ""
    echo "📈 403 (접근 거부) 요청:"
    sudo grep "403" /var/log/nginx/api_access.log | tail -10
    
    echo ""
    echo "📈 405 (메서드 불허) 요청:"
    sudo grep "405" /var/log/nginx/api_access.log | tail -10
}

# 의심스러운 IP 목록
show_suspicious_ips() {
    echo "🔍 의심스러운 IP 주소 목록"
    echo "--------------------------"
    sudo awk '{print $1}' /var/log/nginx/api_access.log | grep -E "(185\.244\.104\.2|65\.49\.1\.152|170\.64\.223\.58|45\.156\.129\.179|45\.156\.129\.177)" | sort | uniq -c | sort -nr
}

# 메뉴 표시
show_menu() {
    echo "1. 실시간 로그 모니터링"
    echo "2. 차단된 요청 통계 보기"
    echo "3. 의심스러운 IP 목록 보기"
    echo "4. 종료"
    echo ""
    read -p "선택하세요 (1-4): " choice
}

# 메인 루프
while true; do
    show_menu
    
    case $choice in
        1)
            monitor_logs
            ;;
        2)
            show_blocked_stats
            ;;
        3)
            show_suspicious_ips
            ;;
        4)
            echo "👋 모니터링을 종료합니다."
            exit 0
            ;;
        *)
            echo "❌ 잘못된 선택입니다. 1-4 중에서 선택해주세요."
            ;;
    esac
    
    echo ""
    read -p "계속하려면 Enter를 누르세요..."
    echo ""
done


