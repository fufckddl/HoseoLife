#!/bin/bash

# Universal Links 및 App Links 설정 적용 스크립트

echo "🚀 Universal Links 및 App Links 설정을 적용합니다..."

# 1. AASA 파일들을 서버에 업로드
echo "📱 AASA 파일들을 서버에 업로드합니다..."

# public 폴더가 없으면 생성
mkdir -p /var/www/hoseolife.kro.kr/public/.well-known

# AASA 파일 복사
cp public/apple-app-site-association /var/www/hoseolife.kro.kr/
cp public/.well-known/apple-app-site-association /var/www/hoseolife.kro.kr/.well-known/
cp public/.well-known/assetlinks.json /var/www/hoseolife.kro.kr/.well-known/

# 파일 권한 설정
chmod 644 /var/www/hoseolife.kro.kr/apple-app-site-association
chmod 644 /var/www/hoseolife.kro.kr/.well-known/apple-app-site-association
chmod 644 /var/www/hoseolife.kro.kr/.well-known/assetlinks.json

# 2. nginx 설정 적용
echo "🌐 nginx 설정을 적용합니다..."

# nginx 설정 파일 복사
cp backend/hoseolife.conf /etc/nginx/conf.d/

# nginx 설정 테스트
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ nginx 설정이 유효합니다."
    # nginx 재시작
    systemctl reload nginx
    echo "🔄 nginx가 재시작되었습니다."
else
    echo "❌ nginx 설정에 오류가 있습니다."
    exit 1
fi

# 3. 백엔드 서버 재시작
echo "🔄 백엔드 서버를 재시작합니다..."
systemctl restart camsaw-backend
echo "✅ 백엔드 서버가 재시작되었습니다."

# 4. 설정 검증
echo "🔍 설정을 검증합니다..."

# AASA 파일 응답 확인
echo "📱 AASA 파일 응답 확인:"
curl -i https://hoseolife.kro.kr/apple-app-site-association
echo ""

echo "📱 .well-known AASA 파일 응답 확인:"
curl -i https://hoseolife.kro.kr/.well-known/apple-app-site-association
echo ""

echo "🤖 Android assetlinks 파일 응답 확인:"
curl -i https://hoseolife.kro.kr/.well-known/assetlinks.json
echo ""

echo "🎉 Universal Links 및 App Links 설정이 완료되었습니다!"
echo ""
echo "📋 다음 단계:"
echo "1. iOS 앱에 associated domains 설정 추가"
echo "2. Android 앱에 intent-filter 설정 추가"
echo "3. 실제 앱에서 테스트 진행"
echo ""
echo "🔧 설정할 값들:"
echo "- IOS_TEAM_ID: Apple Developer Team ID"
echo "- IOS_BUNDLE_ID: com.dlckdfuf.camsaw"
echo "- ANDROID_PACKAGE: com.dlckdfuf.camsaw"
echo "- ANDROID_SHA256_FINGERPRINT: 앱 서명 인증서의 SHA256 지문"
