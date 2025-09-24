import redis.asyncio as redis
import json
import asyncio
from typing import Dict, Any, Callable
import logging

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.redis_client = None
        self.pubsub = None
        self.subscribers: Dict[str, Callable] = {}
        
    async def initialize(self):
        """Redis 연결 초기화"""
        try:
            # Redis 연결 설정 (비동기)
            self.redis_client = redis.Redis(
                host='localhost',
                port=6379,
                db=0,
                decode_responses=True
            )
            
            # 연결 테스트 (비동기 방식)
            result = await self.redis_client.ping()
            logger.info("✅ Redis 연결 성공")
            
            # Pub/Sub 초기화
            self.pubsub = self.redis_client.pubsub()
            
        except Exception as e:
            logger.error(f"❌ Redis 연결 실패: {e}")
            raise
    
    async def publish_message(self, channel: str, message: Dict[str, Any]):
        """메시지를 Redis 채널에 발행"""
        try:
            message_json = json.dumps(message, ensure_ascii=False)
            await self.redis_client.publish(channel, message_json)
            logger.debug(f"📤 Redis 발행: {channel} - {message}")
        except Exception as e:
            logger.error(f"❌ Redis 발행 실패: {e}")
    
    async def subscribe_to_channel(self, channel: str, callback: Callable):
        """Redis 채널 구독"""
        try:
            self.subscribers[channel] = callback
            await self.pubsub.subscribe(channel)
            logger.info(f"📡 Redis 구독: {channel}")
        except Exception as e:
            logger.error(f"❌ Redis 구독 실패: {e}")
    
    async def unsubscribe_from_channel(self, channel: str):
        """Redis 채널 구독 해제"""
        try:
            if channel in self.subscribers:
                del self.subscribers[channel]
            await self.pubsub.unsubscribe(channel)
            logger.info(f"📡 Redis 구독 해제: {channel}")
        except Exception as e:
            logger.error(f"❌ Redis 구독 해제 실패: {e}")
    
    async def listen_for_messages(self):
        """메시지 수신 루프"""
        try:
            async for message in self.pubsub.listen():
                try:
                    if message and message['type'] == 'message':
                        channel = message['channel']
                        data = json.loads(message['data'])
                        
                        if channel in self.subscribers:
                            callback = self.subscribers[channel]
                            await callback(data)
                except Exception as e:
                    logger.error(f"❌ Redis 메시지 처리 실패: {e}")
                    # 오류 발생 시 잠시 대기 후 계속
                    await asyncio.sleep(1)
                        
        except Exception as e:
            logger.error(f"❌ Redis 메시지 수신 루프 실패: {e}")
    
    async def close(self):
        """Redis 연결 종료"""
        try:
            if self.pubsub:
                await self.pubsub.close()
            if self.redis_client:
                await self.redis_client.close()
            logger.info("✅ Redis 연결 종료")
        except Exception as e:
            logger.error(f"❌ Redis 연결 종료 실패: {e}")

# 전역 Redis 서비스 인스턴스
redis_service = RedisService()
