/**
 * 사용자 관련 유틸리티 함수들
 */

/**
 * 탈퇴한 사용자의 닉네임을 "(알수없음)"으로 표시
 * @param nickname 원본 닉네임
 * @returns 표시할 닉네임
 */
export function getDisplayNickname(nickname: string | null | undefined): string {
  if (!nickname) {
    return '(알수없음)';
  }
  
  // 탈퇴한 사용자인지 확인 (패턴: "(알수없음)123" 형태)
  if (nickname.startsWith('(알수없음)') && /^\(알수없음\)\d+$/.test(nickname)) {
    return '(알수없음)';
  }
  
  return nickname;
}

/**
 * 사용자가 탈퇴했는지 확인
 * @param nickname 닉네임
 * @returns 탈퇴 여부
 */
export function isDeactivatedUser(nickname: string | null | undefined): boolean {
  if (!nickname) {
    return true;
  }
  
  return nickname.startsWith('(알수없음)') && /^\(알수없음\)\d+$/.test(nickname);
}

/**
 * 작성자 정보 표시용 (프로필 이미지 포함)
 * @param authorNickname 작성자 닉네임
 * @param profileImageUrl 프로필 이미지 URL
 * @returns 표시 정보
 */
export function getAuthorDisplayInfo(
  authorNickname: string | null | undefined, 
  profileImageUrl: string | null | undefined
) {
  const displayNickname = getDisplayNickname(authorNickname);
  const isDeactivated = isDeactivatedUser(authorNickname);
  
  return {
    displayNickname,
    profileImageUrl: isDeactivated ? null : profileImageUrl, // 탈퇴한 사용자는 프로필 이미지 없음
    isDeactivated
  };
}
