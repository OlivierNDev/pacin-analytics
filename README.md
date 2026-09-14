# PACIN Analytics — First-Party Visitor Tracking

Free, self-hosted, first-party analytics for `www.pacinnetwork.com`. No PostHog. No third-party bill.

## Architecture

```
[Browser on www.pacinnetwork.com]  →  POST events  →  [AWS API: api.pacinnetwork.com]
                                                              ↓
                                                        [Postgres DB]
                                                              ↓
[Super Admin on app.pacinnetwork.com]  ←  GET reports  ←  [AWS API]
```

## Repo Structure

```
db/migrations/001_analytics.sql   — Postgres schema
api/                              — FastAPI ingest + admin endpoints
tracker/                          — TypeScript tracker for Vercel (www)
admin-ui/                         — React component for Super Admin
deploy/                           — AWS ECS task definition
```

## Quick Start (local)

```bash
docker-compose up
# Run migration
docker exec -it pacin-analytics-db-1 psql -U pacin -d pacin_analytics -f /docker-entrypoint-initdb.d/001_analytics.sql
# Test collect
curl -X POST http://localhost:8001/api/v1/analytics/collect \
  -H 'Content-Type: application/json' \
  -d '{"event":"page_view","path":"/","session_id":"s1","visitor_id":"v1"}'
# Test admin
curl http://localhost:8001/api/v1/admin/analytics/overview \
  -H 'X-Admin-Token: dev-admin-token'
```

## Env Vars

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PACIN_ADMIN_TOKEN` | Secret token for Super Admin endpoints |

## Deploy to AWS

1. Push image to ECR: `docker build -t pacin-analytics . && docker tag ... && docker push ...`
2. Use `deploy/aws-task-definition.json` as your ECS task template
3. Set env vars in ECS task definition or AWS Secrets Manager
4. Expose port 8001 behind your existing ALB at `/api/v1/analytics/`

## Add Tracker to Vercel (www.pacinnetwork.com)

See `tracker/README.md` for drop-in instructions.

## Super Admin UI

Drop `admin-ui/SiteTrafficDashboard.tsx` and `admin-ui/analyticsApi.ts` into your admin React app.
Set `VITE_ANALYTICS_API_URL` and `VITE_ANALYTICS_ADMIN_TOKEN` env vars.
Route guard: only render if `user.role === 'pacin_super_admin'`.

## Privacy

- No PII collected (no names, emails, IPs stored)
- Anonymous visitor_id in localStorage
- Respects `navigator.doNotTrack`
- CORS locked to `www.pacinnetwork.com` only
- Update Privacy/Cookie pages: replace PostHog mention with 'analytics processed by PACIN'
