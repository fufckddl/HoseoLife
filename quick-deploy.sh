#!/bin/bash

echo "🚀 빠른 웹사이트 재배포 시작..."

# 1. 코드 업로드
echo "📤 코드 업로드 중..."
rsync -avz -e "ssh -i ~/Downloads/camsaw.pem" --exclude node_modules --exclude .git --exclude dist site/ ec2-user@your-server-host:/camsaw/web/

# 2. 서버에서 재빌드 및 배포
echo "🔨 서버에서 재빌드 중..."
ssh -i ~/Downloads/camsaw.pem ec2-user@your-server-host << 'EOF'
cd /camsaw/web
npm run build
sudo rm -rf /var/www/hoseolife.kro.kr/*
sudo cp -r dist/* /var/www/hoseolife.kro.kr/
sudo chown -R nginx:nginx /var/www/hoseolife.kro.kr
echo "✅ 재배포 완료!"
EOF

echo "🎉 웹사이트 재배포 완료!"
echo "🌐 https://hoseolife.kro.kr/web/ 에서 확인하세요."
