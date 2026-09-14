-- PACIN First-Party Analytics Schema
-- Run against existing Postgres on AWS

BEGIN;

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event VARCHAR(50) NOT NULL,
    path VARCHAR(500),
    referrer VARCHAR(1000),
    utm_source VARCHAR(200),
    utm_medium VARCHAR(200),
    utm_campaign VARCHAR(200),
    session_id VARCHAR(100),
    visitor_id VARCHAR(100),
    country_code VARCHAR(10),
    device_type VARCHAR(20),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_analytics_summary (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    unique_visitors INT DEFAULT 0,
    sessions INT DEFAULT 0,
    page_views INT DEFAULT 0,
    contact_submits INT DEFAULT 0,
    waitlist_joins INT DEFAULT 0,
    top_pages JSONB,
    top_referrers JSONB,
    top_utm_sources JSONB,
    device_breakdown JSONB,
    country_breakdown JSONB,
    UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_analytics_summary(date);

COMMIT;
