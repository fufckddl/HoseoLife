# ENDPOINT_MAP.md

## 백엔드 API 엔드포인트 매핑

### 기본 정보
- **Base URL**: `https://hoseolife.kro.kr`
- **인증 방식**: JWT Bearer Token
- **Content-Type**: `application/json`

### 1. 인증 관련 (`/users`)

#### 회원가입
- **POST** `/users/register`
- **요청**: `UserCreate` (email, password, nickname, university)
- **응답**: `UserResponse` (id, email, nickname, university, is_premium, is_admin, created_at)
- **인증**: 불필요

#### 로그인
- **POST** `/users/login`
- **요청**: `UserLogin` (email, password)
- **응답**: `LoginResponse` (access_token, token_type)
- **인증**: 불필요

#### 사용자 정보 조회
- **GET** `/users/profile`
- **요청**: 없음
- **응답**: `UserResponse`
- **인증**: 필요

#### 프로필 수정
- **PUT** `/users/profile`
- **요청**: `UserUpdate` (nickname?, university?)
- **응답**: `UserResponse`
- **인증**: 필요

#### 비밀번호 변경
- **POST** `/users/change-password`
- **요청**: `PasswordChange` (current_password, new_password)
- **응답**: 성공 메시지
- **인증**: 필요

#### 회원 탈퇴
- **DELETE** `/users/withdraw`
- **요청**: 없음
- **응답**: 성공 메시지
- **인증**: 필요

#### 프로필 이미지 업로드
- **POST** `/users/upload-profile-image`
- **요청**: `multipart/form-data` (file)
- **응답**: `{profile_image_url: string}`
- **인증**: 필요

#### 알림 설정 조회
- **GET** `/users/notification-settings`
- **요청**: 없음
- **응답**: `NotificationSettingsResponse` (notifications_enabled)
- **인증**: 필요

#### 알림 설정 업데이트
- **PUT** `/users/notification-settings`
- **요청**: `NotificationSettingsUpdate` (notifications_enabled)
- **응답**: 성공 메시지
- **인증**: 필요

#### FCM 토큰 업데이트
- **POST** `/users/update-fcm-token`
- **요청**: `{fcm_token: string}`
- **응답**: 성공 메시지
- **인증**: 필요

#### 사용자 목록 조회
- **GET** `/users/list`
- **쿼리**: `skip`, `limit`, `search?`
- **응답**: `UserResponse[]`
- **인증**: 필요

### 2. 게시글 관련 (`/posts`)

#### 게시글 목록 조회
- **GET** `/posts/`
- **쿼리**: 
  - `skip` (기본값: 0)
  - `limit` (기본값: 20)
  - `category?` (카테고리 필터)
  - `building_name?` (건물명 필터)
  - `search?` (검색어)
  - `after_date?` (날짜 필터)
  - `include_news_notices?` (뉴스/공지 포함)
  - `board_id?` (게시판 ID)
- **응답**: `PostListResponse[]`
- **인증**: 필요

#### 게시글 상세 조회
- **GET** `/posts/{post_id}`
- **요청**: 없음
- **응답**: `PostResponse`
- **인증**: 필요
- **기능**: 조회수 자동 증가

#### 게시글 생성
- **POST** `/posts/`
- **요청**: `PostCreate` (title, content, category, building_name?, building_latitude?, building_longitude?, image_urls?, board_id?)
- **응답**: `PostResponse`
- **인증**: 필요
- **제약**: 뉴스/공지는 관리자만 작성 가능

#### 게시글 수정
- **PUT** `/posts/{post_id}`
- **요청**: `PostUpdate` (title?, content?, category?, building_name?, building_latitude?, building_longitude?, image_urls?)
- **응답**: `PostResponse`
- **인증**: 필요
- **제약**: 작성자만 수정 가능

#### 게시글 삭제
- **DELETE** `/posts/{post_id}`
- **요청**: 없음
- **응답**: 성공 메시지
- **인증**: 필요
- **제약**: 작성자만 삭제 가능

#### 내 게시글 목록
- **GET** `/posts/my/posts`
- **요청**: 없음
- **응답**: `PostListResponse[]`
- **인증**: 필요

#### 게시글 좋아요 토글
- **POST** `/posts/{post_id}/heart`
- **요청**: 없음
- **응답**: `HeartResponse` (message, is_hearted, heart_count)
- **인증**: 필요

#### 게시글 좋아요 상태 확인
- **GET** `/posts/{post_id}/heart`
- **요청**: 없음
- **응답**: `HeartStatus` (is_hearted, heart_count)
- **인증**: 필요

#### 게시글 스크랩 토글
- **POST** `/posts/{post_id}/scrap`
- **요청**: 없음
- **응답**: `ScrapResponse` (message, is_scrapped, scrap_count)
- **인증**: 필요

#### 게시글 스크랩 상태 확인
- **GET** `/posts/{post_id}/scrap`
- **요청**: 없음
- **응답**: `ScrapStatus` (is_scrapped, scrap_count)
- **인증**: 필요

#### 내 스크랩 목록
- **GET** `/posts/my/scraps`
- **쿼리**: `skip`, `limit`
- **응답**: `PostListResponse[]`
- **인증**: 필요

#### 게시글 공유 링크 생성
- **POST** `/posts/{post_id}/share-link`
- **요청**: 없음
- **응답**: `{share_code: string, share_url: string}`
- **인증**: 필요

#### 게시글 공유 링크 처리
- **GET** `/posts/{post_id}/share/{share_code}`
- **요청**: 없음
- **응답**: HTML 페이지 (웹 폴백)
- **인증**: 불필요

### 3. 댓글 관련 (`/posts/{post_id}/comments`)

#### 댓글 목록 조회
- **GET** `/posts/{post_id}/comments`
- **요청**: 없음
- **응답**: `CommentResponse[]` (계층 구조 포함)
- **인증**: 필요

#### 댓글 작성
- **POST** `/posts/{post_id}/comments`
- **요청**: `CommentCreate` (content, parent_id?)
- **응답**: `CommentResponse`
- **인증**: 필요
- **기능**: 대댓글 지원 (parent_id)

#### 댓글 삭제
- **DELETE** `/posts/comments/{comment_id}`
- **요청**: 없음
- **응답**: 성공 메시지
- **인증**: 필요
- **제약**: 작성자만 삭제 가능

#### 내 댓글 목록
- **GET** `/posts/comments/my`
- **요청**: 없음
- **응답**: 댓글 목록
- **인증**: 필요

#### 댓글 좋아요 토글
- **POST** `/posts/comments/{comment_id}/heart`
- **요청**: 없음
- **응답**: `{is_liked: boolean, like_count: number}`
- **인증**: 필요

### 4. 이메일 인증 관련 (`/email`)

#### 인증 코드 발송
- **POST** `/email/send-code`
- **요청**: `EmailRequest` (email)
- **응답**: 성공 메시지
- **인증**: 불필요

#### 인증 코드 확인
- **POST** `/email/verify-code`
- **요청**: `EmailVerifyRequest` (email, code)
- **응답**: 성공 메시지
- **인증**: 불필요

### 5. 문의 관련 (`/contact`)

#### 문의 생성
- **POST** `/contact/`
- **요청**: 문의 내용
- **응답**: 성공 메시지
- **인증**: 필요

#### 내 문의 목록
- **GET** `/contact/my`
- **요청**: 없음
- **응답**: 문의 목록
- **인증**: 필요

#### 문의 상세 조회
- **GET** `/contact/{contact_id}`
- **요청**: 없음
- **응답**: 문의 상세
- **인증**: 필요

#### 문의 답변 (관리자)
- **POST** `/contact/{contact_id}/reply`
- **요청**: 답변 내용
- **응답**: 성공 메시지
- **인증**: 필요 (관리자)

### 6. 신고 관련 (`/report`)

#### 신고 생성
- **POST** `/report/`
- **요청**: 신고 내용
- **응답**: 성공 메시지
- **인증**: 필요

#### 내 신고 목록
- **GET** `/report/my`
- **요청**: 없음
- **응답**: 신고 목록
- **인증**: 필요

#### 신고 처리 (관리자)
- **POST** `/report/{report_id}/process`
- **요청**: 처리 결과
- **응답**: 성공 메시지
- **인증**: 필요 (관리자)

### 7. 알림 관련 (`/alarm`)

#### 알림 목록 조회
- **GET** `/alarm/`
- **쿼리**: `skip`, `limit`
- **응답**: 알림 목록
- **인증**: 필요

#### 알림 읽음 처리
- **PUT** `/alarm/{alarm_id}/read`
- **요청**: 없음
- **응답**: 성공 메시지
- **인증**: 필요

#### 알림 생성 (관리자)
- **POST** `/alarm/`
- **요청**: 알림 내용
- **응답**: 성공 메시지
- **인증**: 필요 (관리자)

### 8. 게시판 요청 관련 (`/board-request`)

#### 게시판 생성 요청
- **POST** `/board-request/`
- **요청**: 게시판 정보
- **응답**: 성공 메시지
- **인증**: 필요

#### 게시판 요청 목록 (관리자)
- **GET** `/board-request/`
- **요청**: 없음
- **응답**: 요청 목록
- **인증**: 필요 (관리자)

#### 게시판 요청 승인/거부 (관리자)
- **POST** `/board-request/{request_id}/approve`
- **요청**: 승인/거부 여부
- **응답**: 성공 메시지
- **인증**: 필요 (관리자)

### 9. 건물 관리 관련 (`/buildings`)

#### 건물 목록 조회
- **GET** `/buildings/`
- **요청**: 없음
- **응답**: 건물 목록
- **인증**: 불필요

#### 캠퍼스별 건물 조회
- **GET** `/buildings/{campus}`
- **요청**: 없음
- **응답**: 해당 캠퍼스 건물 목록
- **인증**: 불필요

#### 건물 상세 조회
- **GET** `/buildings/{campus}/{building_id}`
- **요청**: 없음
- **응답**: 건물 상세 정보
- **인증**: 불필요

#### 건물 생성 (관리자)
- **POST** `/buildings/`
- **요청**: 건물 정보
- **응답**: 생성된 건물 정보
- **인증**: 필요 (관리자)

#### 건물 수정 (관리자)
- **PUT** `/buildings/{building_id}`
- **요청**: 수정할 건물 정보
- **응답**: 수정된 건물 정보
- **인증**: 필요 (관리자)

#### 건물 삭제 (관리자)
- **DELETE** `/buildings/{building_id}`
- **요청**: 없음
- **응답**: 성공 메시지
- **인증**: 필요 (관리자)

### 10. 채팅 관련 (웹에서 제외)

#### 1:1 채팅
- **WebSocket** `/chat/ws/{user_id}`
- **기능**: 실시간 1:1 채팅
- **인증**: 필요

#### 그룹 채팅
- **WebSocket** `/group-chat/ws/{room_id}`
- **기능**: 실시간 그룹 채팅
- **인증**: 필요

#### 채팅방 목록
- **GET** `/chat/rooms`
- **응답**: 채팅방 목록
- **인증**: 필요

#### 그룹 채팅방 목록
- **GET** `/group-chat/rooms`
- **응답**: 그룹 채팅방 목록
- **인증**: 필요

### 11. 에러 코드

#### 일반적인 HTTP 상태 코드
- **200**: 성공
- **201**: 생성 성공
- **400**: 잘못된 요청
- **401**: 인증 실패
- **403**: 권한 없음
- **404**: 리소스 없음
- **422**: 유효성 검사 실패
- **500**: 서버 오류

#### 커스텀 에러 메시지
- **"이메일 또는 비밀번호가 올바르지 않습니다."**: 로그인 실패
- **"이미 사용 중인 이메일입니다."**: 이메일 중복
- **"이미 사용 중인 닉네임입니다."**: 닉네임 중복
- **"뉴스나 공지사항은 관리자만 작성할 수 있습니다."**: 권한 부족
- **"인증이 만료되었습니다. 다시 로그인해주세요."**: 토큰 만료

### 12. 페이지네이션

#### 표준 페이지네이션 파라미터
- **skip**: 건너뛸 항목 수 (기본값: 0)
- **limit**: 가져올 항목 수 (기본값: 20, 최대: 100)

#### 응답 형식
```json
{
  "items": [...],
  "total": 100,
  "skip": 0,
  "limit": 20,
  "has_more": true
}
```

### 13. 파일 업로드

#### 이미지 업로드
- **Content-Type**: `multipart/form-data`
- **파일 형식**: JPG, PNG, GIF
- **최대 크기**: 10MB
- **저장소**: AWS S3

#### 업로드 응답
```json
{
  "image_url": "https://camsaw-assets.s3.ap-northeast-2.amazonaws.com/posts/123/image.jpg",
  "uploaded_at": "2024-01-01T00:00:00Z"
}
```

### 14. 웹 구현 시 주의사항

#### 제외할 엔드포인트
- **채팅 관련**: 모든 WebSocket 엔드포인트
- **FCM 관련**: 푸시 알림 토큰 관리
- **실시간 기능**: 실시간 알림, 실시간 업데이트

#### 대체 구현 방안
- **폴링**: 주기적 데이터 갱신으로 실시간 효과
- **웹 푸시**: Service Worker 기반 알림
- **파일 업로드**: HTML5 File API 사용
- **인증**: JWT 토큰을 localStorage에 저장

#### 성능 최적화
- **무한 스크롤**: cursor 기반 페이지네이션
- **이미지 최적화**: WebP 형식, 지연 로딩
- **캐싱**: React Query를 통한 데이터 캐싱
- **번들 최적화**: 코드 스플리팅, 트리 셰이킹

