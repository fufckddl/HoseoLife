import asyncio
import schedule
import time
from datetime import datetime, timedelta
import pytz
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.alarm import Alarm
from app.services.fcm_service import send_fcm_to_user
import threading
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AlarmScheduler:
    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
        self.running_alarms = set()  # 현재 실행 중인 알람 추적
        self.executed_alarms = set()  # 이미 실행된 알람 추적 (일회성 알람용)
        
    def start(self):
        """알람 스케줄러를 시작합니다."""
        if not self.is_running:
            self.is_running = True
            self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
            self.scheduler_thread.start()
            logger.info("알람 스케줄러가 시작되었습니다.")
            
            # 시작 시 모든 활성 알람을 스케줄에 등록
            self._schedule_all_active_alarms()
    
    def stop(self):
        """알람 스케줄러를 중지합니다."""
        self.is_running = False
        schedule.clear()
        self.running_alarms.clear()
        logger.info("알람 스케줄러가 중지되었습니다.")
    
    def _run_scheduler(self):
        """스케줄러 메인 루프를 실행합니다."""
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(1)  # 1초마다 체크
            except Exception as e:
                logger.error(f"스케줄러 실행 중 오류 발생: {e}")
                time.sleep(5)  # 오류 발생 시 5초 대기
    
    def _schedule_all_active_alarms(self):
        """모든 활성 알람을 스케줄에 등록합니다."""
        try:
            # 기존 스케줄 모두 클리어
            schedule.clear()
            logger.info("기존 스케줄을 모두 클리어했습니다.")
            
            db = next(get_db())
            active_alarms = db.query(Alarm).filter(Alarm.is_active == True).all()
            
            for alarm in active_alarms:
                self._schedule_alarm(alarm)
                
            logger.info(f"{len(active_alarms)}개의 활성 알람이 스케줄에 등록되었습니다.")
        except Exception as e:
            logger.error(f"활성 알람 스케줄링 중 오류 발생: {e}")
    
    def _schedule_alarm(self, alarm: Alarm):
        """개별 알람을 스케줄에 등록합니다."""
        try:
            kst = pytz.timezone('Asia/Seoul')
            now = datetime.now(kst)
            
            if alarm.is_repeated:
                # 반복 알람 처리
                self._schedule_repeated_alarm(alarm)
            else:
                # 일회성 알람 처리
                if alarm.alarm_time > now:
                    # 미래의 알람만 스케줄링
                    schedule.every().day.at(alarm.alarm_time.strftime("%H:%M")).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}")
                    logger.info(f"일회성 알람 스케줄링: {alarm.title} - {alarm.alarm_time}")
                else:
                    logger.info(f"과거 알람은 스케줄링하지 않음: {alarm.title} - {alarm.alarm_time}")
                    
        except Exception as e:
            logger.error(f"알람 스케줄링 중 오류 발생: {e}")
    
    def _schedule_repeated_alarm(self, alarm: Alarm):
        """반복 알람을 스케줄에 등록합니다."""
        try:
            if not alarm.repeat_days:
                logger.warning(f"반복 알람이지만 요일이 설정되지 않음: {alarm.id}")
                return
            
            repeat_days = [int(day) for day in alarm.repeat_days.split(',')]
            alarm_time = alarm.alarm_time.strftime("%H:%M")
            
            for day in repeat_days:
                if day == 1:  # 월요일
                    schedule.every().monday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_monday")
                elif day == 2:  # 화요일
                    schedule.every().tuesday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_tuesday")
                elif day == 3:  # 수요일
                    schedule.every().wednesday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_wednesday")
                elif day == 4:  # 목요일
                    schedule.every().thursday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_thursday")
                elif day == 5:  # 금요일
                    schedule.every().friday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_friday")
                elif day == 6:  # 토요일
                    schedule.every().saturday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_saturday")
                elif day == 7:  # 일요일
                    schedule.every().sunday.at(alarm_time).do(
                        self._trigger_alarm, alarm.id
                    ).tag(f"alarm_{alarm.id}_sunday")
            
            logger.info(f"반복 알람 스케줄링: {alarm.title} - 요일: {alarm.repeat_days}, 시간: {alarm_time}")
            
        except Exception as e:
            logger.error(f"반복 알람 스케줄링 중 오류 발생: {e}")
    
    def _trigger_alarm(self, alarm_id: int):
        """알람을 실행하고 알림을 전송합니다."""
        # 중복 실행 방지
        if alarm_id in self.running_alarms:
            logger.warning(f"알람이 이미 실행 중입니다: {alarm_id}")
            return
        
        # 이미 실행된 알람 체크 (일회성 알람용)
        if alarm_id in self.executed_alarms:
            logger.warning(f"이미 실행된 알람입니다: {alarm_id}")
            return
        
        self.running_alarms.add(alarm_id)
        
        try:
            db = next(get_db())
            alarm = db.query(Alarm).filter(Alarm.id == alarm_id).first()
            
            if not alarm:
                logger.warning(f"알람을 찾을 수 없음: {alarm_id}")
                return
            
            if not alarm.is_active:
                logger.info(f"비활성화된 알람은 실행하지 않음: {alarm_id}")
                return
            
            # 알림 전송
            title = alarm.title
            body = alarm.message if alarm.message else "알람 시간입니다!"
            
            data = {
                "type": "alarm",
                "alarm_id": str(alarm.id),
                "title": alarm.title,
                "message": alarm.message,
                "sound": alarm.sound,
                "vibration": alarm.vibration
            }
            
            result = send_fcm_to_user(db, alarm.user_id, title, body, data)
            
            if result.get("success"):
                logger.info(f"알람 알림 전송 성공: {alarm.title} (사용자 ID: {alarm.user_id})")
                
                # 실행된 알람으로 표시
                self.executed_alarms.add(alarm_id)
                
                # 일회성 알람인 경우 즉시 비활성화하고 스케줄에서 제거
                if not alarm.is_repeated:
                    alarm.is_active = False
                    db.commit()
                    # 스케줄에서 즉시 제거
                    self.remove_alarm(alarm.id)
                    logger.info(f"일회성 알람 비활성화 및 스케줄 제거: {alarm.id}")
                else:
                    # 반복 알람의 경우에도 현재 실행된 스케줄은 제거 (다음 주에 다시 등록됨)
                    self.remove_alarm(alarm.id)
                    logger.info(f"반복 알람 실행 완료 및 스케줄 정리: {alarm.id}")
            else:
                logger.error(f"알람 알림 전송 실패: {alarm.title} - {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            logger.error(f"알람 실행 중 오류 발생: {e}")
            # 오류 발생 시에도 스케줄에서 제거
            try:
                self.remove_alarm(alarm_id)
                logger.info(f"오류로 인한 알람 스케줄 제거: {alarm_id}")
            except:
                pass
        finally:
            # 실행 완료 후 추적에서 제거
            self.running_alarms.discard(alarm_id)
    
    def add_alarm(self, alarm: Alarm):
        """새로운 알람을 스케줄에 추가합니다."""
        self._schedule_alarm(alarm)
    
    def remove_alarm(self, alarm_id: int):
        """알람을 스케줄에서 제거합니다."""
        try:
            # 기본 태그 제거
            schedule.clear(f"alarm_{alarm_id}")
            
            # 반복 알람의 요일별 태그들도 제거
            days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            for day in days:
                schedule.clear(f"alarm_{alarm_id}_{day}")
            
            logger.info(f"알람 스케줄에서 제거됨: {alarm_id}")
        except Exception as e:
            logger.error(f"알람 스케줄 제거 중 오류 발생: {e}")
    
    def update_alarm(self, alarm: Alarm):
        """알람을 스케줄에서 업데이트합니다."""
        try:
            # 기존 스케줄 제거
            self.remove_alarm(alarm.id)
            
            # 새로운 스케줄 추가
            if alarm.is_active:
                self.add_alarm(alarm)
                
        except Exception as e:
            logger.error(f"알람 스케줄 업데이트 중 오류 발생: {e}")

# 전역 알람 스케줄러 인스턴스
alarm_scheduler = AlarmScheduler()
