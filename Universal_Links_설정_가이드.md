# Universal Links 및 App Links 설정 가이드

## 📋 개요
iOS Universal Links와 Android App Links를 구현하여 공유페이지에서 앱으로 직접 이동할 수 있도록 설정합니다.

## 🎯 목표
- **설치됨**: 공유페이지의 "앱에서 열기" 클릭 시 앱이 즉시 열림
- **미설치**: 웹 보기로 폴백
- **카카오 인앱 브라우저**: 외부 브라우저 안내

## 📁 생성된 파일들

### 1. AASA 파일 (Apple App Site Association)
- `public/apple-app-site-association`
- `public/.well-known/apple-app-site-association`

### 2. Android Asset Links
- `public/.well-known/assetlinks.json`

### 3. Nginx 설정
- `backend/hoseolife.conf` (업데이트됨)

### 4. iOS 설정
- `ios/Runner/Runner.entitlements`

### 5. Android 설정
- `android/app/src/main/AndroidManifest.xml`

### 6. 백엔드 라우트
- `backend/app/routers/post.py` (Universal Links 대상 경로 추가)

## 🔧 설정해야 할 값들

### iOS 설정
```xml
<!-- ios/Runner/Runner.entitlements -->
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:hoseolife.kro.kr</string>
</array>
```

**필요한 값:**
- `IOS_TEAM_ID`: Apple Developer Team ID (예: ABC123DEF4)
- `IOS_BUNDLE_ID`: com.dlckdfuf.camsaw

### Android 설정
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="hoseolife.kro.kr"
          android:pathPrefix="/posts/" />
</intent-filter>
```

**필요한 값:**
- `ANDROID_PACKAGE`: com.dlckdfuf.camsaw
- `ANDROID_SHA256_FINGERPRINT`: 앱 서명 인증서의 SHA256 지문

## 🚀 적용 방법

### 1. 서버에 설정 적용
```bash
# 스크립트 실행 권한 부여
chmod +x apply_universal_links.sh

# 설정 적용
./apply_universal_links.sh
```

### 2. AASA 파일 값 업데이트
```bash
# AASA 파일에서 IOS_TEAM_ID와 IOS_BUNDLE_ID 교체
sed -i 's/IOS_TEAM_ID/실제_TEAM_ID/g' public/apple-app-site-association
sed -i 's/IOS_BUNDLE_ID/com.dlckdfuf.camsaw/g' public/apple-app-site-association

# .well-known 폴더의 파일도 동일하게 업데이트
sed -i 's/IOS_TEAM_ID/실제_TEAM_ID/g' public/.well-known/apple-app-site-association
sed -i 's/IOS_BUNDLE_ID/com.dlckdfuf.camsaw/g' public/.well-known/apple-app-site-association
```

### 3. Android assetlinks.json 값 업데이트
```bash
# Android 패키지명과 SHA256 지문 교체
sed -i 's/ANDROID_PACKAGE/com.dlckdfuf.camsaw/g' public/.well-known/assetlinks.json
sed -i 's/ANDROID_SHA256_FINGERPRINT/실제_SHA256_지문/g' public/.well-known/assetlinks.json
```

## 🔍 검증 방법

### 1. AASA 파일 응답 확인
```bash
curl -i https://hoseolife.kro.kr/apple-app-site-association
curl -i https://hoseolife.kro.kr/.well-known/apple-app-site-association
```

**예상 응답:**
- Status: 200 OK
- Content-Type: application/json
- 리다이렉트 없음

### 2. Android assetlinks 응답 확인
```bash
curl -i https://hoseolife.kro.kr/.well-known/assetlinks.json
```

### 3. Universal Links 테스트
```bash
# iOS Safari에서 테스트
open https://hoseolife.kro.kr/posts/123

# Android에서 테스트
adb shell am start -a android.intent.action.VIEW -d "https://hoseolife.kro.kr/posts/123"
```

## 📱 앱 설정

### iOS (Xcode)
1. 프로젝트 설정 → Signing & Capabilities
2. "+ Capability" → "Associated Domains" 추가
3. `applinks:hoseolife.kro.kr` 추가

### Android (Android Studio)
1. `android/app/src/main/AndroidManifest.xml` 확인
2. `android:autoVerify="true"` 설정 확인
3. 올바른 패키지명과 SHA256 지문 확인

## 🐛 문제 해결

### AASA 파일이 404 오류
- nginx 설정에서 정적 파일 경로 확인
- 파일 권한 확인 (644)
- nginx 재시작

### Universal Links가 작동하지 않음
- iOS 설정에서 Associated Domains 확인
- AASA 파일 형식 확인 (JSON 유효성)
- 앱 재설치 후 테스트

### App Links가 작동하지 않음
- Android Manifest의 intent-filter 확인
- SHA256 지문이 올바른지 확인
- 앱 서명 확인

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. nginx 로그: `/var/log/nginx/error.log`
2. 백엔드 로그: `journalctl -u camsaw-backend -f`
3. 브라우저 개발자 도구 콘솔
4. 앱 로그 (Xcode/Android Studio)

## ✅ 체크리스트

- [ ] AASA 파일이 올바른 JSON 형식으로 서빙됨
- [ ] Android assetlinks.json이 올바른 형식으로 서빙됨
- [ ] nginx 설정이 적용되고 재시작됨
- [ ] 백엔드 서버가 재시작됨
- [ ] iOS 앱에 Associated Domains 설정됨
- [ ] Android 앱에 intent-filter 설정됨
- [ ] 실제 디바이스에서 테스트 완료
