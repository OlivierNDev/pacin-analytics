import os
import asyncio
import json
from datetime import date, datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, Response, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from api.database import get_pool, close_pool
from api.auth import verify_admin_token
from api.models import CollectEvent, OverviewResponse, PeriodStats, TopPagesResponse, PageStat, ReferrersResponse, ReferrerStat, UtmStat, FunnelResponse, FunnelStep, DailyResponse, DailyPoint, RebuildRequest, RebuildResponse
from api.utils import is_bot, detect_device_type
from api.summarizer import rebuild_daily_summary, rebuild_range

MAX_BODY_SIZE = 2048
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()

app = FastAPI(title="PACIN Analytics API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.pacinnetwork.com","https://pacinnetwork.com"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["POST","GET","OPTIONS"],
    allow_headers=["Content-Type","X-Admin-Token"],
    max_age=86400,
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/v1/analytics/collect")
@limiter.limit("30/minute")
async def collect(request: Request):
    body = await request.body()
    if len(body) > MAX_BODY_SIZE:
        return Response(status_code=200)
    try:
        payload = json.loads(body)
        event_data = CollectEvent(**payload)
    except Exception:
        return Response(status_code=200)
    ua_string = event_data.ua or request.headers.get("user-agent", "")
    if is_bot(ua_string):
        return Response(status_code=200)
    device = detect_device_type(ua_string, event_data.screen_width)
    ts = event_data.ts or datetime.now(timezone.utc)
    try:
        pool = await get_pool()
        await pool.execute(
            """INSERT INTO analytics_events (event,path,referrer,utm_source,utm_medium,utm_campaign,session_id,visitor_id,country_code,device_type,ts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
            event_data.event, event_data.path, event_data.referrer, event_data.utm_source, event_data.utm_medium, event_data.utm_campaign, event_data.session_id, event_data.visitor_id, "", device, ts,
        )
        asyncio.create_task(_fire_and_forget_summary(pool, ts))
    except Exception:
        pass
    return Response(status_code=200)

async def _fire_and_forget_summary(pool, ts: datetime):
    try:
        await rebuild_daily_summary(pool, ts.date())
    except Exception:
        pass

@app.get("/api/v1/admin/analytics/overview", response_model=OverviewResponse)
async def admin_overview(request: Request):
    verify_admin_token(request)
    pool = await get_pool()
    async def stats_for_period(days: int) -> PeriodStats:
        if days == 0:
            start = date.today().isoformat()
            end = (date.today() + timedelta(days=1)).isoformat()
        else:
            start = (date.today() - timedelta(days=days)).isoformat()
            end = (date.today() + timedelta(days=1)).isoformat()
        async with pool.acquire() as conn:
            visitors = await conn.fetchval("SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE ts >= $1 AND ts < $2", start, end)
            sessions = await conn.fetchval("SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE ts >= $1 AND ts < $2", start, end)
            pvs = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2", start, end)
            conversions = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event IN ('contact_submit','waitlist_join') AND ts >= $1 AND ts < $2", start, end)
        return PeriodStats(unique_visitors=visitors or 0, sessions=sessions or 0, page_views=pvs or 0, conversions=conversions or 0)
    today, week, month = await asyncio.gather(stats_for_period(0), stats_for_period(7), stats_for_period(30))
    return OverviewResponse(today=today, last_7_days=week, last_30_days=month)

@app.get("/api/v1/admin/analytics/top-pages", response_model=TopPagesResponse)
async def admin_top_pages(request: Request, days: int = Query(default=7, ge=1, le=365)):
    verify_admin_token(request)
    pool = await get_pool()
    start = (date.today() - timedelta(days=days)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2", start, end)
        rows = await conn.fetch("SELECT path, COUNT(*) as views FROM analytics_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2 AND path IS NOT NULL GROUP BY path ORDER BY views DESC LIMIT 10", start, end)
    total = total or 1
    pages = [PageStat(path=r["path"], views=r["views"], percent=round(r["views"]/total*100,1)) for r in rows]
    return TopPagesResponse(pages=pages, period_days=days)

@app.get("/api/v1/admin/analytics/referrers", response_model=ReferrersResponse)
async def admin_referrers(request: Request, days: int = Query(default=7, ge=1, le=365)):
    verify_admin_token(request)
    pool = await get_pool()
    start = (date.today() - timedelta(days=days)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    async with pool.acquire() as conn:
        ref_rows = await conn.fetch("SELECT referrer, COUNT(*) as visits FROM analytics_events WHERE ts >= $1 AND ts < $2 AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY visits DESC LIMIT 10", start, end)
        utm_rows = await conn.fetch("SELECT utm_source, COUNT(*) as visits FROM analytics_events WHERE ts >= $1 AND ts < $2 AND utm_source IS NOT NULL AND utm_source != '' GROUP BY utm_source ORDER BY visits DESC LIMIT 10", start, end)
    return ReferrersResponse(referrers=[ReferrerStat(referrer=r["referrer"], visits=r["visits"]) for r in ref_rows], utm_sources=[UtmStat(source=r["utm_source"], visits=r["visits"]) for r in utm_rows], period_days=days)

@app.get("/api/v1/admin/analytics/funnel", response_model=FunnelResponse)
async def admin_funnel(request: Request, days: int = Query(default=30, ge=1, le=365)):
    verify_admin_token(request)
    pool = await get_pool()
    start = (date.today() - timedelta(days=days)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    async with pool.acquire() as conn:
        pvs = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2", start, end) or 0
        contacts = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event = 'contact_submit' AND ts >= $1 AND ts < $2", start, end) or 0
        waitlist = await conn.fetchval("SELECT COUNT(*) FROM analytics_events WHERE event = 'waitlist_join' AND ts >= $1 AND ts < $2", start, end) or 0
    funnel = [FunnelStep(step="page_views",count=pvs,conversion_pct=100.0), FunnelStep(step="contact_submit",count=contacts,conversion_pct=round(contacts/pvs*100,2) if pvs else 0), FunnelStep(step="waitlist_join",count=waitlist,conversion_pct=round(waitlist/pvs*100,2) if pvs else 0)]
    return FunnelResponse(funnel=funnel, period_days=days)

@app.get("/api/v1/admin/analytics/daily", response_model=DailyResponse)
async def admin_daily(request: Request, days: int = Query(default=30, ge=1, le=365)):
    verify_admin_token(request)
    pool = await get_pool()
    start = (date.today() - timedelta(days=days)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT date, unique_visitors, sessions, page_views FROM daily_analytics_summary WHERE date >= $1 AND date <= $2 ORDER BY date ASC", start, end)
    data = [DailyPoint(date=r["date"].isoformat(), unique_visitors=r["unique_visitors"], sessions=r["sessions"], page_views=r["page_views"]) for r in rows]
    return DailyResponse(data=data, period_days=days)

@app.post("/api/v1/admin/analytics/rebuild-summary", response_model=RebuildResponse)
async def admin_rebuild(request: Request, body: RebuildRequest):
    verify_admin_token(request)
    pool = await get_pool()
    from_d = date.fromisoformat(body.from_date)
    to_d = date.fromisoformat(body.to_date)
    if to_d < from_d:
        raise HTTPException(status_code=400, detail="to_date must be >= from_date")
    if (to_d - from_d).days > 365:
        raise HTTPException(status_code=400, detail="Range cannot exceed 365 days")
    days = await rebuild_range(pool, from_d, to_d)
    return RebuildResponse(status="ok", days_rebuilt=days)
