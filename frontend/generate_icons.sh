#!/bin/bash

# iOS 아이콘 생성 스크립트
echo "🎯 iOS 아이콘 생성 시작..."

cd /Users/dlckdfuf/Desktop/camsaw/frontend/ios/HoseoLife/Images.xcassets/AppIcon.appiconset

# 1024x1024 아이콘이 있는지 확인
if [ ! -f "App-Icon-1024x1024@1x.png" ]; then
    echo "❌ 1024x1024 아이콘이 없습니다!"
    exit 1
fi

echo "✅ 1024x1024 아이콘 확인됨"

# 모든 필요한 아이콘 크기 생성
echo "📱 iPhone 아이콘 생성 중..."
sips -z 20 20 App-Icon-1024x1024@1x.png --out App-Icon-20x20@1x.png
sips -z 40 40 App-Icon-1024x1024@1x.png --out App-Icon-20x20@2x.png
sips -z 60 60 App-Icon-1024x1024@1x.png --out App-Icon-20x20@3x.png

sips -z 29 29 App-Icon-1024x1024@1x.png --out App-Icon-29x29@1x.png
sips -z 58 58 App-Icon-1024x1024@1x.png --out App-Icon-29x29@2x.png
sips -z 87 87 App-Icon-1024x1024@1x.png --out App-Icon-29x29@3x.png

sips -z 40 40 App-Icon-1024x1024@1x.png --out App-Icon-40x40@1x.png
sips -z 80 80 App-Icon-1024x1024@1x.png --out App-Icon-40x40@2x.png
sips -z 120 120 App-Icon-1024x1024@1x.png --out App-Icon-40x40@3x.png

sips -z 120 120 App-Icon-1024x1024@1x.png --out App-Icon-60x60@2x.png
sips -z 180 180 App-Icon-1024x1024@1x.png --out App-Icon-60x60@3x.png

echo "📱 iPad 아이콘 생성 중..."
sips -z 76 76 App-Icon-1024x1024@1x.png --out App-Icon-76x76@1x.png
sips -z 152 152 App-Icon-1024x1024@1x.png --out App-Icon-76x76@2x.png
sips -z 167 167 App-Icon-1024x1024@1x.png --out App-Icon-83.5x83.5@2x.png

echo "✅ 모든 아이콘 생성 완료!"
echo "📊 생성된 아이콘 개수: $(ls -la *.png | wc -l)"
