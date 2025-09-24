#!/bin/bash
# 그룹 채팅 기능 테스트 스크립트

BASE_URL="https://camsaw.kro.kr"
TOKEN="YOUR_JWT_TOKEN_HERE"  # 실제 JWT 토큰으로 교체 필요

echo "🚀 그룹 채팅 기능 테스트 시작"
echo "=================================="

# 1. 그룹 생성 요청
echo "1️⃣ 그룹 생성 요청"
curl -X POST "${BASE_URL}/chat/groups/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "name": "알고리즘 스터디",
    "description": "화/목 7시 정기 모임"
  }' | jq '.'

echo -e "\n"

# 2. 대기 중인 그룹 요청 목록 조회 (관리자)
echo "2️⃣ 대기 중인 그룹 요청 목록 조회 (관리자)"
curl -X GET "${BASE_URL}/chat/admin/groups/pending" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'

echo -e "\n"

# 3. 그룹 요청 승인 (관리자)
echo "3️⃣ 그룹 요청 승인 (관리자)"
curl -X POST "${BASE_URL}/chat/admin/groups/1/approve" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'

echo -e "\n"

# 4. 참여 가능한 그룹 목록 조회
echo "4️⃣ 참여 가능한 그룹 목록 조회"
curl -X GET "${BASE_URL}/chat/rooms/available?type=group" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'

echo -e "\n"

# 5. 그룹 참여
echo "5️⃣ 그룹 참여"
curl -X POST "${BASE_URL}/chat/rooms/1/join" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'

echo -e "\n"

# 6. 내 채팅방 목록 조회 (DM/그룹 분리)
echo "6️⃣ 내 채팅방 목록 조회 (DM/그룹 분리)"
curl -X GET "${BASE_URL}/chat/rooms" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'

echo -e "\n"
echo "✅ 테스트 완료!"
