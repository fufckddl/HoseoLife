from datetime import datetime, timezone, timedelta

def get_korea_timezone():
    """한국 시간대를 반환합니다."""
    return timezone(timedelta(hours=9))

def get_current_korea_time():
    """현재 한국 시간을 반환합니다."""
    return datetime.now(get_korea_timezone())

def get_today_six_am_korea():
    """오늘 06:00 (한국시간)을 반환합니다."""
    now = get_current_korea_time()
    today_six_am = now.replace(hour=6, minute=0, second=0, microsecond=0)
    return today_six_am

def is_same_day_korea(date1: datetime, date2: datetime):
    """두 날짜가 같은 날인지 확인합니다 (한국시간 기준)."""
    # 한국 시간대로 변환
    korea_tz = get_korea_timezone()
    
    if date1.tzinfo is None:
        date1 = date1.replace(tzinfo=timezone.utc)
    if date2.tzinfo is None:
        date2 = date2.replace(tzinfo=timezone.utc)
    
    date1_korea = date1.astimezone(korea_tz)
    date2_korea = date2.astimezone(korea_tz)
    
    return date1_korea.date() == date2_korea.date()

def should_increment_view_count(last_view_date: datetime):
    """조회수를 증가시켜야 하는지 확인합니다."""
    if not last_view_date:
        return True
    
    current_time = get_current_korea_time()
    today_six_am = get_today_six_am_korea()
    
    # last_view_date에 timezone 정보가 없으면 UTC로 가정하고 한국 시간으로 변환
    if last_view_date.tzinfo is None:
        last_view_date = last_view_date.replace(tzinfo=timezone.utc)
    
    last_view_date_korea = last_view_date.astimezone(get_korea_timezone())
    
    # 마지막 조회가 오늘 06:00 이전이면 조회수 증가
    if last_view_date_korea < today_six_am:
        return True
    
    # 마지막 조회가 오늘 06:00 이후이면 같은 날이므로 조회수 증가 안함
    return False

def convert_to_kst(utc_datetime):
    """UTC 시간을 한국 시간으로 변환합니다."""
    if utc_datetime is None:
        return None
    
    # timezone 정보가 없으면 UTC로 가정
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=timezone.utc)
    
    # 한국 시간으로 변환
    korea_tz = get_korea_timezone()
    return utc_datetime.astimezone(korea_tz) 