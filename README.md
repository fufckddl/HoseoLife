# CamSaw - 실시간 채팅 앱

React Native Expo와 FastAPI를 사용한 실시간 1:1 채팅 및 그룹 채팅 애플리케이션입니다.

## 주요 기능

- ✅ **실시간 1:1 채팅**
- ✅ **실시간 그룹 채팅**
- ✅ **WebSocket 기반 실시간 통신**
- ✅ **Expo Push 알림**
- ✅ **알림 클릭 시 채팅방으로 즉시 이동**
- ✅ **낙관적 UI 업데이트**
- ✅ **자동 재연결 및 메시지 큐**
- ✅ **타이핑 표시**
- ✅ **읽음 확인**

## 기술 스택

### 백엔드
- **FastAPI** - Python 웹 프레임워크
- **SQLAlchemy** - ORM
- **MySQL** - 데이터베이스
- **WebSocket** - 실시간 통신
- **Expo Push Notifications** - 푸시 알림

### 프론트엔드
- **React Native Expo** - 모바일 앱 프레임워크
- **TypeScript** - 타입 안전성
- **Expo Router** - 네비게이션
- **WebSocket** - 실시간 통신
- **AsyncStorage** - 로컬 저장소

## 설치 및 실행

### 1. 백엔드 설정

```bash
# 백엔드 디렉토리로 이동
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 데이터베이스 정보 입력

# 데이터베이스 마이그레이션
python -m alembic upgrade head

# 서버 실행
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload --limit-request-line 0 --limit-request-field_size 0 --limit-request-fields 0
```

### 2. 프론트엔드 설정

```bash
# 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 API URL 설정

# 개발 서버 실행
npx expo start
```

## 환경 변수

### 백엔드 (.env)
```env
# Database Configuration
DATABASE_URL=mysql+pymysql://username:password@localhost/camsaw_db?charset=utf8mb4&collation=utf8mb4_unicode_ci

# Security
SECRET_KEY=your-secret-key-here

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id

# Expo Push Notifications
EXPO_PUSH_ENDPOINT=https://exp.host/--/api/v2/push/send
EXPO_ACCESS_TOKEN=your-expo-access-token

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=your-s3-bucket-name

# Server Configuration
HOST=0.0.0.0
PORT=5000
DEBUG=True
```

### 프론트엔드 (.env)
```env
# API Configuration
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
EXPO_PUBLIC_WS_URL=ws://localhost:5000

# Production URLs (uncomment for production)
# EXPO_PUBLIC_API_BASE_URL=https://your-domain.com
# EXPO_PUBLIC_WS_URL=wss://your-domain.com
```

## API 엔드포인트

### 인증
- `POST /auth/login` - 로그인
- `POST /auth/register` - 회원가입

### 채팅
- `GET /chat/rooms` - 채팅방 목록 조회
- `POST /chat/rooms` - 채팅방 생성
- `GET /chat/rooms/{room_id}/messages` - 메시지 조회
- `POST /chat/rooms/{room_id}/messages` - 메시지 전송
- `POST /chat/push/register` - 푸시 토큰 등록
- `WS /chat/ws/{user_id}` - WebSocket 연결

## WebSocket 프로토콜

### 메시지 타입
- `join` - 채팅방 참여
- `leave` - 채팅방 나가기
- `message` - 메시지 전송
- `typing` - 타이핑 상태
- `read_receipt` - 읽음 확인
- `pong` - 연결 유지

### 예시
```json
{
  "type": "message",
  "room_id": 1,
  "user_id": 123,
  "content": "안녕하세요!",
  "client_msg_id": "msg_1234567890_0.123",
  "sent_at": "2024-01-01T12:00:00Z"
}
```

## 프로덕션 배포

### 백엔드 (EC2)
```bash
# Nginx 설정
sudo apt update
sudo apt install nginx

# SSL 인증서 설정
sudo certbot --nginx -d your-domain.com

# 서비스 등록
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 프론트엔드 (EAS Build)
```bash
# EAS CLI 설치
npm install -g @expo/eas-cli

# 로그인
eas login

# 빌드 설정
eas build:configure

# iOS 빌드
eas build --platform ios

# Android 빌드
eas build --platform android
```

## 주요 파일 구조

```
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   ├── chat.py          # 채팅 모델
│   │   │   └── user.py          # 사용자 모델
│   │   ├── routers/
│   │   │   └── chat.py          # 채팅 API
│   │   ├── services/
│   │   │   └── fcm_service.py   # 푸시 알림
│   │   └── websocket_manager.py # WebSocket 관리
│   └── main.py
├── frontend/
│   ├── app/
│   │   ├── services/
│   │   │   ├── chatService.ts   # 채팅 API 서비스
│   │   │   ├── websocketService.ts # WebSocket 서비스
│   │   │   └── notificationService.ts # 알림 서비스
│   │   └── pages/
│   │       ├── chat-list.tsx    # 채팅방 목록
│   │       └── chat-room.tsx    # 채팅방
│   └── package.json
└── README.md
```

## 보안 주의사항

### 민감한 정보 보호
- **절대 `camsawAccountKey.json` 파일을 Git에 커밋하지 마세요!**
- Firebase 서비스 계정 키는 환경 변수로 관리하세요
- `.env` 파일은 `.gitignore`에 포함되어 있습니다
- 프로덕션 환경에서는 환경 변수를 안전하게 설정하세요

### 환경 변수 설정
1. `backend/.env.example`을 `backend/.env`로 복사
2. `frontend/.env.example`을 `frontend/.env`로 복사
3. 각 파일의 값을 실제 값으로 변경

## 문제 해결

### WebSocket 연결 실패
- 서버가 실행 중인지 확인
- 방화벽 설정 확인
- SSL 인증서 설정 확인

### 푸시 알림이 오지 않음
- Expo Push 토큰이 올바르게 등록되었는지 확인
- 앱 권한 설정 확인
- 서버 로그 확인

### 메시지가 실시간으로 오지 않음
- WebSocket 연결 상태 확인
- 네트워크 연결 확인
- 서버 로그 확인

## 라이선스

MIT License
