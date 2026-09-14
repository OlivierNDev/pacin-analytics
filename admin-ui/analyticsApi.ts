const BASE_URL = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ANALYTICS_API_URL) || process.env.REACT_APP_ANALYTICS_API_URL || "";
const ADMIN_TOKEN = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ANALYTICS_ADMIN_TOKEN) || process.env.REACT_APP_ANALYTICS_ADMIN_TOKEN || "";

export interface PeriodStats { unique_visitors: number; sessions: number; page_views: number; conversions: number; }
export interface OverviewData { today: PeriodStats; last_7_days: PeriodStats; last_30_days: PeriodStats; }
export interface PageStat { path: string; views: number; percent: number; }
export interface TopPagesData { pages: PageStat[]; period_days: number; }
export interface ReferrerStat { referrer: string; visits: number; }
export interface UtmStat { source: string; visits: number; }
export interface ReferrersData { referrers: ReferrerStat[]; utm_sources: UtmStat[]; period_days: number; }
export interface FunnelStep { step: string; count: number; conversion_pct: number | null; }
export interface FunnelData { funnel: FunnelStep[]; period_days: number; }
export interface DailyPoint { date: string; unique_visitors: number; sessions: number; page_views: number; }
export interface DailyData { data: DailyPoint[]; period_days: number; }

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { "X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Analytics API error: ${res.status}`);
  return res.json();
}

export const fetchOverview = (): Promise<OverviewData> => adminFetch("/api/v1/admin/analytics/overview");
export const fetchTopPages = (days: number): Promise<TopPagesData> => adminFetch(`/api/v1/admin/analytics/top-pages?days=${days}`);
export const fetchReferrers = (days: number): Promise<ReferrersData> => adminFetch(`/api/v1/admin/analytics/referrers?days=${days}`);
export const fetchFunnel = (days: number): Promise<FunnelData> => adminFetch(`/api/v1/admin/analytics/funnel?days=${days}`);
export const fetchDaily = (days: number): Promise<DailyData> => adminFetch(`/api/v1/admin/analytics/daily?days=${days}`);
