import asyncpg
from datetime import date, timedelta
import json


async def rebuild_daily_summary(pool: asyncpg.Pool, target_date: date) -> None:
    async with pool.acquire() as conn:
        day_start = target_date.isoformat()
        day_end = (target_date + timedelta(days=1)).isoformat()

        unique_visitors = await conn.fetchval(
            "SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE ts >= $1 AND ts < $2",
            day_start, day_end,
        )
        sessions = await conn.fetchval(
            "SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE ts >= $1 AND ts < $2",
            day_start, day_end,
        )
        page_views = await conn.fetchval(
            "SELECT COUNT(*) FROM analytics_events WHERE event = 'page_view' AND ts >= $1 AND ts < $2",
            day_start, day_end,
        )
        contact_submits = await conn.fetchval(
            "SELECT COUNT(*) FROM analytics_events WHERE event = 'contact_submit' AND ts >= $1 AND ts < $2",
            day_start, day_end,
        )
        waitlist_joins = await conn.fetchval(
            "SELECT COUNT(*) FROM analytics_events WHERE event = 'waitlist_join' AND ts >= $1 AND ts < $2",
            day_start, day_end,
        )

        top_pages_rows = await conn.fetch(
            """SELECT path, COUNT(*) as views FROM analytics_events
               WHERE event = 'page_view' AND ts >= $1 AND ts < $2 AND path IS NOT NULL
               GROUP BY path ORDER BY views DESC LIMIT 20""",
            day_start, day_end,
        )
        top_pages = [{"path": r["path"], "views": r["views"]} for r in top_pages_rows]

        top_referrers_rows = await conn.fetch(
            """SELECT referrer, COUNT(*) as visits FROM analytics_events
               WHERE ts >= $1 AND ts < $2 AND referrer IS NOT NULL AND referrer != ''
               GROUP BY referrer ORDER BY visits DESC LIMIT 20""",
            day_start, day_end,
        )
        top_referrers = [{"referrer": r["referrer"], "visits": r["visits"]} for r in top_referrers_rows]

        top_utm_rows = await conn.fetch(
            """SELECT utm_source, COUNT(*) as visits FROM analytics_events
               WHERE ts >= $1 AND ts < $2 AND utm_source IS NOT NULL AND utm_source != ''
               GROUP BY utm_source ORDER BY visits DESC LIMIT 20""",
            day_start, day_end,
        )
        top_utm_sources = [{"source": r["utm_source"], "visits": r["visits"]} for r in top_utm_rows]

        device_rows = await conn.fetch(
            """SELECT device_type, COUNT(*) as cnt FROM analytics_events
               WHERE ts >= $1 AND ts < $2 AND device_type IS NOT NULL
               GROUP BY device_type""",
            day_start, day_end,
        )
        device_breakdown = {r["device_type"]: r["cnt"] for r in device_rows}

        country_rows = await conn.fetch(
            """SELECT country_code, COUNT(*) as cnt FROM analytics_events
               WHERE ts >= $1 AND ts < $2 AND country_code IS NOT NULL AND country_code != ''
               GROUP BY country_code ORDER BY cnt DESC LIMIT 30""",
            day_start, day_end,
        )
        country_breakdown = {r["country_code"]: r["cnt"] for r in country_rows}

        await conn.execute(
            """INSERT INTO daily_analytics_summary
               (date, unique_visitors, sessions, page_views, contact_submits, waitlist_joins,
                top_pages, top_referrers, top_utm_sources, device_breakdown, country_breakdown)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (date) DO UPDATE SET
                 unique_visitors = EXCLUDED.unique_visitors,
                 sessions = EXCLUDED.sessions,
                 page_views = EXCLUDED.page_views,
                 contact_submits = EXCLUDED.contact_submits,
                 waitlist_joins = EXCLUDED.waitlist_joins,
                 top_pages = EXCLUDED.top_pages,
                 top_referrers = EXCLUDED.top_referrers,
                 top_utm_sources = EXCLUDED.top_utm_sources,
                 device_breakdown = EXCLUDED.device_breakdown,
                 country_breakdown = EXCLUDED.country_breakdown""",
            target_date, unique_visitors or 0, sessions or 0, page_views or 0,
            contact_submits or 0, waitlist_joins or 0,
            json.dumps(top_pages), json.dumps(top_referrers), json.dumps(top_utm_sources),
            json.dumps(device_breakdown), json.dumps(country_breakdown),
        )

async def rebuild_range(pool: asyncpg.Pool, from_date: date, to_date: date) -> int:
    days = 0
    current = from_date
    while current <= to_date:
        await rebuild_daily_summary(pool, current)
        current += timedelta(days=1)
        days += 1
    return days
