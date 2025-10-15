# 🚀 HoseoLife 프로젝트 빌드 요구사항

## 📋 **현재 환경 상태**

### 🔧 **시스템 요구사항**
- **Node.js**: v22.17.0 ✅
- **npm**: v10.9.2 ✅  
- **Python**: v3.9.6 ✅
- **pip**: v21.2.4 (업데이트 권장)
- **CocoaPods**: v1.16.2 ✅

---

## 📱 **프론트엔드 (React Native/Expo)**

### 📦 **설치된 주요 라이브러리**
```json
{
  "expo": "54.0.12",
  "react-native": "0.81.4",
  "react": "19.1.0",
  "@react-navigation/bottom-tabs": "^7.3.10",
  "@react-navigation/native": "^7.1.6",
  "react-native-maps": "1.20.1",
  "react-native-image-picker": "^8.2.1",
  "@react-native-async-storage/async-storage": "2.2.0",
  "axios": "^1.11.0",
  "zustand": "^5.0.8"
}
```

### 🛠️ **빌드 명령어**
```bash
# 개발 서버 시작
cd frontend && npm start

# iOS 빌드
cd frontend && npm run ios

# Android 빌드  
cd frontend && npm run android

# 웹 빌드
cd frontend && npm run web
```

### ✅ **프론트엔드 상태**: 모든 라이브러리 설치 완료

---

## 🐍 **백엔드 (Python/FastAPI)**

### 📦 **requirements.txt 내용**
```
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
cryptography==41.0.7
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
psycopg2-binary==2.9.9
requests==2.31.0
schedule==1.2.0
pytz==2023.3
redis[hiredis]==5.0.1
PyJWT==2.8.0
pandas==2.3.2
openpyxl==3.1.5
xlrd==2.0.2
```

### 🔍 **현재 설치 상태**
- ✅ fastapi: 0.115.5 (설치됨)
- ✅ uvicorn: 0.32.1 (설치됨)
- ❌ sqlalchemy: 2.0.23 (설치 필요)
- ✅ pydantic: 2.5.0 (설치됨)
- ❌ python-multipart: 0.0.6 (설치 필요)
- ❌ python-jose[cryptography]: 3.3.0 (설치 필요)
- ❌ cryptography: 41.0.7 (설치 필요)
- ❌ passlib[bcrypt]: 1.7.4 (설치 필요)
- ❌ python-dotenv: 1.0.0 (설치 필요)
- ✅ psycopg2-binary: 2.9.9 (설치됨)
- ❌ requests: 2.31.0 (설치 필요)
- ❌ schedule: 1.2.0 (설치 필요)
- ❌ pytz: 2023.3 (설치 필요)
- ✅ redis: 5.0.1 (설치됨)
- ❌ PyJWT: 2.8.0 (설치 필요)
- ❌ pandas: 2.3.2 (설치 필요)
- ❌ openpyxl: 3.1.5 (설치 필요)
- ❌ xlrd: 2.0.2 (설치 필요)

### 🛠️ **백엔드 설치 명령어**
```bash
# 모든 라이브러리 설치
cd backend && pip3 install -r requirements.txt

# 서버 실행
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

---

## 📱 **모바일 빌드**

### 🍎 **iOS 빌드**
```bash
# CocoaPods 설치 (이미 완료)
cd frontend/ios && pod install

# iOS 빌드
cd frontend && npx expo run:ios
```

### 🤖 **Android 빌드**
```bash
# Android 빌드
cd frontend && npx expo run:android
```

---

## 🔧 **설치 스크립트**

### 📄 **install_dependencies.sh**
```bash
#!/bin/bash
echo "🚀 HoseoLife 프로젝트 의존성 설치 시작..."

# 백엔드 라이브러리 설치
echo "📦 백엔드 라이브러리 설치 중..."
cd backend && pip3 install -r requirements.txt

# 프론트엔드 라이브러리 설치 (이미 설치됨)
echo "📱 프론트엔드 라이브러리 확인 중..."
cd ../frontend && npm install

# iOS CocoaPods 설치 (이미 완료)
echo "🍎 iOS CocoaPods 확인 중..."
cd ios && pod install

echo "✅ 모든 의존성 설치 완료!"
```

---

## 📊 **빌드 준비 상태 요약**

| 구성요소 | 상태 | 완료율 |
|---------|------|--------|
| **프론트엔드** | ✅ 완료 | 100% |
| **백엔드** | ⚠️ 부분완료 | 30% |
| **iOS 빌드** | ✅ 완료 | 100% |
| **Android 빌드** | ✅ 준비완료 | 100% |
| **전체 프로젝트** | ⚠️ 부분완료 | 70% |

---

## 🚨 **다음 단계**

1. **백엔드 라이브러리 설치**: `pip3 install -r requirements.txt`
2. **환경 변수 설정**: `.env` 파일 생성
3. **데이터베이스 연결 설정**
4. **테스트 실행**

---

## 📝 **주의사항**

- Python pip 버전 업데이트 권장: `pip install --upgrade pip`
- iOS 빌드는 macOS에서만 가능
- Android 빌드는 Android Studio 필요
- 백엔드 실행 시 포트 5000 사용

---

*최종 업데이트: 2024년 10월 9일*
