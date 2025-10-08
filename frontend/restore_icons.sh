#!/bin/bash

# HoseoLife iOS 아이콘 복구 스크립트
# 이 스크립트는 npx expo prebuild --clean 후에 실행하여 작동하는 아이콘들을 복구합니다.

echo "🔄 HoseoLife iOS 아이콘 복구 시작..."

# 백업된 아이콘들을 AppIcon.appiconset으로 복구
echo "📁 아이콘 파일들 복구 중..."
cp backup_icons/AppIcon.appiconset/* ios/HoseoLife/Images.xcassets/AppIcon.appiconset/

echo "✅ 아이콘 복구 완료!"
echo "📱 이제 TestFlight 빌드를 진행하세요:"
echo "   npx eas build --platform ios --profile preview"
