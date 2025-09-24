#!/bin/bash

# Hoseolife.kro.kr 배포 스크립트

echo "🚀 Hoseolife.kro.kr 배포 시작..."

# 1. 빌드
echo "📦 프로덕션 빌드 생성 중..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패!"
    exit 1
fi

echo "✅ 빌드 완료!"

# 2. 배포 방법 선택
echo "배포 방법을 선택하세요:"
echo "1) Nginx 서버 (권장)"
echo "2) Vercel"
echo "3) Netlify"
echo "4) GitHub Pages"

read -p "선택 (1-4): " choice

case $choice in
    1)
        echo "🌐 Nginx 서버 배포..."
        read -p "서버 주소를 입력하세요 (예: user@your-server.com): " server
        read -p "서버 경로를 입력하세요 (예: /var/www/hoseolife.kro.kr): " path
        
        echo "📤 파일 업로드 중..."
        rsync -avz --delete dist/ $server:$path/
        
        echo "🔧 Nginx 설정 적용 중..."
        ssh $server "sudo cp nginx_hoseolife_web_config.conf /etc/nginx/sites-available/hoseolife && sudo ln -sf /etc/nginx/sites-available/hoseolife /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx"
        
        echo "✅ Nginx 배포 완료!"
        ;;
    2)
        echo "▲ Vercel 배포..."
        vercel --prod
        echo "✅ Vercel 배포 완료!"
        ;;
    3)
        echo "🌍 Netlify 배포..."
        netlify deploy --prod --dir=dist
        echo "✅ Netlify 배포 완료!"
        ;;
    4)
        echo "📚 GitHub Pages 배포..."
        git add .
        git commit -m "Deploy to GitHub Pages"
        git push origin main
        echo "✅ GitHub Pages 배포 완료!"
        ;;
    *)
        echo "❌ 잘못된 선택입니다."
        exit 1
        ;;
esac

echo "🎉 배포가 완료되었습니다!"
echo "🌐 https://hoseolife.kro.kr 에서 확인하세요."
