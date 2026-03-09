#!/bin/bash

echo "🚀 빠른 웹사이트 재배포 시작..."

SERVER_USER="${SERVER_USER:-ec2-user}"
SERVER_HOST="${SERVER_HOST:-your-server-host}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/Downloads/your-key.pem}"

# 1. 코드 업로드
echo "📤 코드 업로드 중..."
rsync -avz -e "ssh -i $SSH_KEY_PATH" --exclude node_modules --exclude .git --exclude dist site/ "$SERVER_USER@$SERVER_HOST:/camsaw/web/"

# 2. 서버에서 재빌드 및 배포
echo "🔨 서버에서 재빌드 중..."
ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_HOST" << 'EOF'
cd /camsaw/web
npm run build
sudo rm -rf /var/www/hoseolife.kro.kr/*
sudo cp -r dist/* /var/www/hoseolife.kro.kr/
sudo chown -R nginx:nginx /var/www/hoseolife.kro.kr
echo "✅ 재배포 완료!"
EOF

echo "🎉 웹사이트 재배포 완료!"
echo "🌐 https://hoseolife.kro.kr/web/ 에서 확인하세요."
