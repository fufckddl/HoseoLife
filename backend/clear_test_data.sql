-- 테스트 배포를 위한 테스트 데이터 정리 SQL 스크립트
-- 주의: 이 스크립트는 모든 테스트 데이터를 삭제합니다!

-- 1. 외래키 제약조건 비활성화 (순서대로 삭제하기 위해)
SET FOREIGN_KEY_CHECKS = 0;

-- 2. 테스트 데이터 삭제 (관리자 제외)
-- 사용자 데이터 (관리자 제외)
DELETE FROM users WHERE is_admin = FALSE;

-- 게시글 관련 데이터
DELETE FROM posts;
DELETE FROM comments;
DELETE FROM hearts;
DELETE FROM scraps;
DELETE FROM view_logs;

-- 채팅 관련 데이터
DELETE FROM chat_messages;
DELETE FROM memberships;
DELETE FROM rooms;
DELETE FROM group_creation_requests;
DELETE FROM user_room_leave_times;

-- 기타 데이터
DELETE FROM alarms;
DELETE FROM contacts;
DELETE FROM reports;
DELETE FROM board_requests;
DELETE FROM email_verifications;

-- 3. 외래키 제약조건 재활성화
SET FOREIGN_KEY_CHECKS = 1;

-- 4. AUTO_INCREMENT 초기화 (선택사항)
-- ALTER TABLE users AUTO_INCREMENT = 1;
-- ALTER TABLE posts AUTO_INCREMENT = 1;
-- ALTER TABLE comments AUTO_INCREMENT = 1;
-- ALTER TABLE chat_messages AUTO_INCREMENT = 1;
-- ALTER TABLE rooms AUTO_INCREMENT = 1;

-- 5. 관리자 계정 확인
SELECT id, email, nickname, is_admin, created_at 
FROM users 
WHERE is_admin = TRUE;

-- 6. 정리 후 데이터 확인
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'posts', COUNT(*) FROM posts
UNION ALL
SELECT 'comments', COUNT(*) FROM comments
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms;
