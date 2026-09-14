const VISITOR_KEY = "_pacin_vid";
const SESSION_KEY = "_pacin_sid";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let vid = localStorage.getItem(VISITOR_KEY);
  if (!vid) { vid = uuid(); localStorage.setItem(VISITOR_KEY, vid); }
  return vid;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) { sid = uuid(); sessionStorage.setItem(SESSION_KEY, sid); }
  return sid;
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source","utm_medium","utm_campaign"]) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

function shouldTrack(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return false;
  return true;
}

function sendPayload(url: string, data: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(data);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { }
}

export function trackEvent(collectorUrl: string, event: string, extra?: Record<string, unknown>): void {
  if (!shouldTrack()) return;
  const payload: Record<string, unknown> = {
    event,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    ts: new Date().toISOString(),
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    screen_width: typeof window !== "undefined" ? window.innerWidth : undefined,
    ...getUtmParams(),
    ...extra,
  };
  sendPayload(`${collectorUrl}/api/v1/analytics/collect`, payload);
}

export function usePacinTracker(collectorUrl: string): void {
  if (!shouldTrack()) return;
  trackEvent(collectorUrl, "page_view");
}
