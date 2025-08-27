from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AlarmCreate(BaseModel):
    title: str
    message: Optional[str] = None
    alarm_time: datetime
    is_repeated: bool = False
    repeat_days: Optional[str] = None  # "1,2,3,4,5,6,7" 형태
    sound: str = "default"
    vibration: bool = True

class AlarmUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    alarm_time: Optional[datetime] = None
    is_active: Optional[bool] = None
    is_repeated: Optional[bool] = None
    repeat_days: Optional[str] = None
    sound: Optional[str] = None
    vibration: Optional[bool] = None

class AlarmResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: Optional[str]
    alarm_time: datetime
    is_active: bool
    is_repeated: bool
    repeat_days: Optional[str]
    sound: str
    vibration: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class AlarmListResponse(BaseModel):
    alarms: List[AlarmResponse]
    total: int
