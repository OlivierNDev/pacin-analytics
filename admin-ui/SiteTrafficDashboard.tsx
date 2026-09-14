import React, { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchOverview, fetchTopPages, fetchReferrers, fetchFunnel, fetchDaily, type OverviewData, type TopPagesData, type ReferrersData, type FunnelData, type DailyData, type PeriodStats } from "./analyticsApi";

type Period = "today" | "7d" | "30d";
const PERIOD_DAYS: Record<Period, number> = { today: 1, "7d": 7, "30d": 30 };

function PeriodTabs({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  const tabs: Period[] = ["today", "7d", "30d"];
  const labels: Record<Period, string> = { today: "Today", "7d": "7 Days", "30d": "30 Days" };
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            active === t ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          {labels[t]}
        </button>
      ))}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
function CardSkeleton() {
  return (<div className="bg-white rounded-xl border border-gray-200 p-6"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-16" /></div>);
}
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{Number(value).toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
function FunnelViz({ data }: { data: FunnelData }) {
  const max = data.funnel[0]?.count || 1;
  const labels: Record<string, string> = { page_views: "Page Views", contact_submit: "Contact Submits", waitlist_join: "Waitlist Joins" };
  const colors = ["bg-indigo-500", "bg-indigo-400", "bg-indigo-300"];
  return (
    <div className="space-y-3">
      {data.funnel.map((step, i) => (
        <div key={step.step}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium">{labels[step.step] || step.step}</span>
            <span className="text-gray-500">{step.count.toLocaleString()}{step.conversion_pct !== null && step.conversion_pct < 100 ? ` (${step.conversion_pct}%)` : ""}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-6">
            <div className={`h-6 rounded-full ${colors[i] || "bg-indigo-200"} transition-all duration-500`}
              style={{ width: `${Math.max((step.count / max) * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SiteTrafficDashboard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [topPages, setTopPages] = useState<TopPagesData | null>(null);
  const [referrers, setReferrers] = useState<ReferrersData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    const days = PERIOD_DAYS[period];
    try {
      const [ov, tp, ref, fn, dl] = await Promise.all([fetchOverview(), fetchTopPages(days), fetchReferrers(days), fetchFunnel(days), fetchDaily(days)]);
      setOverview(ov); setTopPages(tp); setReferrers(ref); setFunnel(fn); setDaily(dl);
    } catch (e: any) { setError(e.message || "Failed to load analytics"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats: PeriodStats | undefined = overview ? (period === "today" ? overview.today : period === "7d" ? overview.last_7_days : overview.last_30_days) : undefined;

  if (error) return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-700 font-medium mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Site Traffic</h1><p className="text-gray-500 text-sm mt-1">www.pacinnetwork.com analytics</p></div>
        <PeriodTabs active={period} onChange={setPeriod} />
      </div>
      {loading || !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <CardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Unique Visitors" value={stats.unique_visitors} />
          <StatCard label="Sessions" value={stats.sessions} />
          <StatCard label="Page Views" value={stats.page_views} />
          <StatCard label="Conversions" value={stats.conversions} sub="contact + waitlist" />
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Visitors</h2>
        {loading || !daily ? <Skeleton className="h-64 w-full" /> : daily.data.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={daily.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={(d: string) => { const dt=new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; }} fontSize={12} stroke="#9ca3af" />
              <YAxis fontSize={12} stroke="#9ca3af" />
              <Tooltip contentStyle={{borderRadius:8,border:'1px solid #e5e7eb'}} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
              <Line type="monotone" dataKey="unique_visitors" stroke="#6366f1" strokeWidth={2} dot={false} name="Visitors" />
              <Line type="monotone" dataKey="page_views" stroke="#a5b4fc" strokeWidth={2} dot={false} name="Page Views" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
          {loading || !topPages ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-6 w-full" />)}</div>
          : topPages.pages.length === 0 ? <p className="text-gray-400 text-center py-8">No page data yet</p>
          : (
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Path</th><th className="pb-2 font-medium text-right">Views</th><th className="pb-2 font-medium text-right">%</th></tr></thead>
              <tbody>{topPages.pages.map((p) => (<tr key={p.path} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-2 text-gray-800 font-mono text-xs">{p.path}</td><td className="py-2 text-right text-gray-600">{p.views.toLocaleString()}</td><td className="py-2 text-right text-gray-400">{p.percent}%</td></tr>))}</tbody>
            </table>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Referrers</h2>
          {loading || !referrers ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-6 w-full" />)}</div>
          : referrers.referrers.length === 0 && referrers.utm_sources.length === 0 ? <p className="text-gray-400 text-center py-8">No referrer data yet</p>
          : (
            <>
              {referrers.referrers.length > 0 && (<table className="w-full text-sm mb-4"><thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium text-right">Visits</th></tr></thead><tbody>{referrers.referrers.map((r) => (<tr key={r.referrer} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-2 text-gray-800 text-xs truncate max-w-[200px]">{r.referrer}</td><td className="py-2 text-right text-gray-600">{r.visits}</td></tr>))}</tbody></table>)}
              {referrers.utm_sources.length > 0 && (<><h3 className="text-sm font-semibold text-gray-700 mb-2">UTM Sources</h3><table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="pb-2 font-medium">Source</th><th className="pb-2 font-medium text-right">Visits</th></tr></thead><tbody>{referrers.utm_sources.map((u) => (<tr key={u.source} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-2 text-gray-800">{u.source}</td><td className="py-2 text-right text-gray-600">{u.visits}</td></tr>))}</tbody></table></>)}
            </>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
        {loading || !funnel ? <div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-8 w-full" />)}</div> : <FunnelViz data={funnel} />}
      </div>
    </div>
  );
}
