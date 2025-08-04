/**
 * 한국 시간 기준 날짜 유틸리티 함수들
 */

/**
 * 오늘 06:00 (한국시간)을 반환합니다.
 * 매일 아침 06:00에 마커가 초기화되는 기준 시간입니다.
 */
export function getTodaySixAM(): Date {
  // 현재 UTC 시간
  const now = new Date();
  
  // 한국 시간대 기준으로 오늘 06:00 계산
  // UTC+9이므로 UTC 기준으로는 전날 21:00 (21 = 6 - 9)
  const todaySixAM = new Date(now);
  todaySixAM.setUTCHours(21, 0, 0, 0); // UTC 21:00 = 한국 06:00
  
  // 만약 현재 시간이 오늘 06:00보다 이전이면 어제 06:00으로 설정
  if (now.getTime() < todaySixAM.getTime()) {
    todaySixAM.setUTCDate(todaySixAM.getUTCDate() - 1);
  }
  
  return todaySixAM;
}

/**
 * 주어진 날짜가 오늘 06:00 이후인지 확인합니다.
 */
export function isAfterTodaySixAM(dateString: string): boolean {
  const date = new Date(dateString);
  const todaySixAM = getTodaySixAM();
  
  return date > todaySixAM;
}

/**
 * 현재 한국 시간을 반환합니다.
 */
export function getCurrentKoreaTime(): Date {
  const now = new Date();
  // 한국 시간대(UTC+9)로 변환
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime;
}

/**
 * 현재 한국 시간을 문자열로 반환합니다.
 */
export function getCurrentKoreaTimeString(): string {
  const now = new Date();
  return now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 날짜를 한국 시간 형식으로 포맷합니다.
 */
export function formatKoreaTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 디버그용: 현재 시간과 오늘 06:00 시간을 출력합니다.
 */
export function debugTimeInfo(): void {
  const now = new Date();
  const todaySixAM = getTodaySixAM();
  const currentKorea = getCurrentKoreaTime();
  
  console.log('=== 시간 디버그 정보 ===');
  console.log('현재 UTC 시간:', now.toISOString());
  console.log('현재 한국 시간 (계산):', formatKoreaTime(currentKorea));
  console.log('현재 한국 시간 (시스템):', getCurrentKoreaTimeString());
  console.log('오늘 06:00 (한국시간):', formatKoreaTime(todaySixAM));
  console.log('오늘 06:00 (UTC):', todaySixAM.toISOString());
  console.log('========================');
} 