# 🛡️ HoseoLife 보안 설정 가이드

## 📋 현재 상황
- 해킹 시도들이 감지되고 있음 (Git 저장소, JasperServer, GeoServer 접근 시도)
- 강화된 보안 설정이 준비됨
- 서버에 적용이 필요함

## 🚀 보안 설정 적용 방법

### 1. 서버에 접속
```bash
ssh your_username@your-server-host
```

### 2. 보안 설정 파일 업로드
로컬에서 다음 명령어로 파일들을 서버에 업로드하세요:
```bash
scp nginx_hoseolife_secure.conf your_username@your-server-host:/home/your_username/
scp apply_security_config.sh your_username@your-server-host:/home/your_username/
scp monitor_security.sh your_username@your-server-host:/home/your_username/
```

### 3. 서버에서 보안 설정 적용
```bash
# 실행 권한 부여
chmod +x apply_security_config.sh
chmod +x monitor_security.sh

# 보안 설정 적용
sudo ./apply_security_config.sh
```

## 🛡️ 적용되는 보안 기능

### 차단되는 해킹 시도:
- ✅ `.git/config` 파일 접근 시도
- ✅ JasperServer 관리자 페이지 접근 시도  
- ✅ GeoServer 관리자 페이지 접근 시도
- ✅ WebDAV 취약점 스캔 시도
- ✅ 일반적인 관리자 페이지 접근 시도
- ✅ 의심스러운 봇/스캐너 접근 시도

### 차단되는 IP 주소:
- `185.244.104.2`
- `65.49.1.152` 
- `170.64.223.58`
- `45.156.129.179`
- `45.156.129.177`

### 추가 보안 헤더:
- Strict-Transport-Security (HSTS)
- X-Frame-Options (클릭재킹 방지)
- X-Content-Type-Options (MIME 타입 스니핑 방지)
- X-XSS-Protection (XSS 공격 방지)
- Content-Security-Policy (CSP)

## 🔍 보안 모니터링

### 실시간 모니터링:
```bash
./monitor_security.sh
```

### 수동 로그 확인:
```bash
# 차단된 요청 확인
sudo grep "444" /var/log/nginx/api_access.log

# 의심스러운 요청 확인  
sudo grep -E "(jasperserver|geoserver|\.git)" /var/log/nginx/api_access.log
```

## ⚠️ 주의사항

1. **백업**: 기존 설정이 자동으로 백업됩니다
2. **테스트**: nginx 설정 테스트를 통과해야만 적용됩니다
3. **롤백**: 문제 발생 시 백업에서 자동 복원됩니다

## 🎯 예상 효과

적용 후 다음과 같은 해킹 시도들이 차단됩니다:
```
GET /.git/config → 444 (연결 종료)
GET /jasperserver-pro/login.html → 444 (연결 종료)
GET /geoserver/web/ → 444 (연결 종료)
PROPFIND / → 405 (메서드 불허)
```

이제 서버가 훨씬 안전해집니다! 🛡️

