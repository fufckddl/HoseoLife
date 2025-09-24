# MIGRATION_AUDIT.md

## React Native 앱 기능 감사 결과

### 1. 네비게이션 구조

#### 메인 탭 구조
- **Home** (`/tabs/home.tsx`): 지도 기반 게시글 표시, 위치 기반 마커 클러스터링
- **Post List** (`/tabs/post-list.tsx`): 게시판 목록, 인기 게시글, 카테고리별 게시판
- **Profile** (`/tabs/profile.tsx`): 사용자 프로필, 설정, 관리자 메뉴

#### 주요 페이지들
- **인증**: `/auth/login.tsx`, `/auth/register.tsx`
- **게시글**: `/pages/post-detail.tsx`, `/pages/create-post.tsx`, `/pages/edit-post.tsx`
- **게시판**: `/posts/location.tsx`, `/posts/free.tsx`, `/posts/secret.tsx` 등
- **관리자**: `/pages/admin/*` (contact-management, group-approval, report-management, board-approval, building-management)
- **기타**: `/pages/search.tsx`, `/pages/notifications.tsx`, `/pages/contact.tsx` 등

### 2. 핵심 기능 분석

#### 인증 시스템
- **JWT 토큰 기반 인증** (`userService.ts`)
- **AsyncStorage**를 통한 토큰 저장
- **자동 토큰 갱신** 및 만료 처리
- **프로필 이미지 업로드** (S3 연동)

#### 게시글 시스템
- **위치 기반 게시글** (건물명, 위도/경도)
- **카테고리별 분류** (위치, 자유, 비밀, 새내기, 정보, 동아리, 홍보, 행사)
- **이미지 업로드** (다중 이미지 지원)
- **댓글 시스템** (대댓글 지원, 계층 구조)
- **좋아요/스크랩** 기능
- **조회수 추적**

#### 실시간 기능 (웹에서 제외)
- **웹소켓 채팅** (`chatService.ts`, `websocketService.ts`)
- **그룹 채팅** (`groupChatService.ts`)
- **FCM 푸시 알림** (`notificationService.ts`, `alarmService.ts`)
- **실시간 알림**

#### 관리자 기능
- **문의 관리** (`contactService.ts`)
- **신고 관리** (`reportService.ts`)
- **게시판 승인** (`board_request.py`)
- **건물 관리** (`buildingService.ts`)

### 3. 데이터 저장소 사용

#### AsyncStorage 키들
- `access_token`: JWT 인증 토큰
- `refresh_token`: 토큰 갱신용
- `user_info`: 사용자 정보 캐시
- `notifications_enabled`: 알림 설정

#### 상태 관리
- **AuthContext**: 인증 상태, 사용자 정보
- **ErrorContext**: 에러 처리
- **Zustand**: 채팅 상태 (`chatStateStore.ts`), 그룹 상태 (`groupStore.ts`)

### 4. 권한 및 조건부 UI

#### 사용자 권한
- **일반 사용자**: 게시글 작성/수정/삭제, 댓글, 좋아요/스크랩
- **관리자**: 모든 기능 + 관리자 메뉴 접근

#### 조건부 렌더링
- **관리자 메뉴**: `isAdmin` 상태에 따른 조건부 표시
- **인증 상태**: 로그인/비로그인에 따른 UI 변경
- **알림 설정**: `notificationsEnabled` 상태

### 5. 외부 서비스 연동

#### AWS S3
- **이미지 업로드**: 게시글 이미지, 프로필 이미지
- **파일 관리**: `s3_service.py`

#### Google Maps
- **위치 서비스**: `expo-location`
- **지도 표시**: `react-native-maps`
- **마커 클러스터링**: 커스텀 클러스터링 알고리즘

#### FCM (Firebase Cloud Messaging)
- **푸시 알림**: 게시글, 댓글, 채팅 알림
- **토큰 관리**: 사용자별 FCM 토큰 저장/업데이트

### 6. 웹에서 제외할 기능들

#### 실시간 통신
- **웹소켓 채팅**: 1:1 채팅, 그룹 채팅
- **실시간 알림**: FCM 푸시 알림
- **실시간 댓글/좋아요**: 실시간 업데이트

#### 모바일 전용 기능
- **위치 서비스**: GPS 기반 위치 추적
- **카메라/갤러리**: `expo-image-picker`
- **진동/햅틱**: `expo-haptics`
- **앱 내 알림**: `expo-notifications`

#### 네이티브 기능
- **딥링킹**: `expo-linking`
- **앱 상태 관리**: `expo-device`
- **시스템 UI**: `expo-system-ui`

### 7. 웹에서 구현 가능한 기능들

#### 핵심 기능
- **인증 시스템**: 로그인/회원가입/프로필 관리
- **게시글 시스템**: CRUD, 댓글, 좋아요/스크랩
- **검색/필터링**: 게시글 검색, 카테고리별 필터
- **관리자 기능**: 문의/신고 관리, 게시판 승인

#### 대체 구현 방안
- **위치 기반**: 지도 없이 건물명 기반 필터링
- **이미지 업로드**: 웹 파일 업로드 API
- **알림**: 폴링 기반 알림 목록 (실시간 제외)
- **채팅**: 웹 기반 채팅 (웹소켓 또는 폴링)

### 8. API 엔드포인트 매핑

#### 인증 관련
- `POST /users/login` → 로그인
- `POST /users/register` → 회원가입
- `GET /users/profile` → 사용자 정보
- `PUT /users/profile` → 프로필 수정
- `POST /users/change-password` → 비밀번호 변경

#### 게시글 관련
- `GET /posts/` → 게시글 목록 (페이지네이션, 필터링)
- `GET /posts/{id}` → 게시글 상세
- `POST /posts/` → 게시글 생성
- `PUT /posts/{id}` → 게시글 수정
- `DELETE /posts/{id}` → 게시글 삭제

#### 댓글 관련
- `GET /posts/{id}/comments` → 댓글 목록
- `POST /posts/{id}/comments` → 댓글 작성
- `DELETE /posts/comments/{id}` → 댓글 삭제

#### 기타 기능
- `POST /posts/{id}/heart` → 좋아요 토글
- `POST /posts/{id}/scrap` → 스크랩 토글
- `GET /posts/my/posts` → 내 게시글
- `GET /posts/my/scraps` → 내 스크랩

### 9. 데이터 모델

#### 주요 엔티티
- **User**: 사용자 정보, 권한, 알림 설정
- **Post**: 게시글, 위치 정보, 이미지
- **Comment**: 댓글, 대댓글 (parent_id, depth)
- **Heart**: 좋아요
- **Scrap**: 스크랩
- **Building**: 건물 정보 (위치, 좌표)

#### 관계
- User → Post (1:N)
- Post → Comment (1:N)
- Comment → Comment (1:N, self-reference)
- User → Heart (1:N)
- User → Scrap (1:N)

### 10. 보안 고려사항

#### 인증/인가
- **JWT 토큰**: 30일 만료
- **관리자 권한**: `is_admin` 플래그
- **API 보호**: 대부분 엔드포인트 인증 필요

#### 데이터 검증
- **Pydantic 스키마**: 요청/응답 검증
- **SQLAlchemy ORM**: 데이터베이스 보안
- **파일 업로드**: S3 직접 업로드

### 11. 성능 최적화

#### 클라이언트
- **이미지 캐싱**: `expo-image`
- **상태 관리**: Context API + Zustand
- **지도 최적화**: 마커 클러스터링

#### 서버
- **페이지네이션**: skip/limit 기반
- **인덱싱**: 데이터베이스 인덱스
- **캐싱**: Redis (선택적)

### 12. 웹 구현 우선순위

#### Phase 1 (핵심 기능)
1. 인증 시스템
2. 게시글 CRUD
3. 댓글 시스템
4. 좋아요/스크랩

#### Phase 2 (확장 기능)
1. 검색/필터링
2. 프로필 관리
3. 이미지 업로드
4. 관리자 기능

#### Phase 3 (고급 기능)
1. 알림 시스템 (폴링)
2. 건물 관리
3. 신고/문의 시스템
4. 성능 최적화

### 13. 기술적 제약사항

#### 웹에서 제한되는 기능
- **실시간 통신**: 웹소켓/SSE 제외
- **위치 서비스**: GPS 대신 수동 입력
- **푸시 알림**: 웹 푸시 알림으로 대체
- **네이티브 기능**: 카메라, 진동 등

#### 대체 방안
- **폴링**: 주기적 데이터 갱신
- **웹 푸시**: Service Worker 기반
- **파일 업로드**: HTML5 File API
- **반응형 디자인**: 모바일/데스크톱 대응

