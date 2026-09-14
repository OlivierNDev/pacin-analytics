from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime

class AnalyticsEvent(BaseModel):
    event: str = Field(..., max_length=50)
    path: Optional[str] = Field(None, max_length=500)
    referrer: Optional[str] = Field(None, max_length=1000)
    utm_source: Optional[str] = Field(None, max_length=200)
    utm_medium: Optional[str] = Field(None, max_length=200)
    utm_campaign: Optional[str] = Field(None, max_length=200)
    session_id: Optional[str] = Field(None, max_length=100)
    visitor_id: Optional[str] = Field(None, max_length=100)
    ts: Optional[datetime] = None
    ua: Optional[str] = Field(None, max_length=500)
    screen_width: Optional[int] = None

    @validator('event')
    def event_must_be_valid(cls, v):
        allowed = {'page_view', 'contact_submit', 'waitlist_join', 'button_click', 'form_start'}
        if v not in allowed:
            raise ValueError(f'event must be one of {allowed}')
        return v

class RebuildRequest(BaseModel):
    from_date: str
    to_date: str
