# PACIN Tracker — Drop-in for www.pacinnetwork.com

## Install

1. Copy `pacin-tracker.ts` and `PacinTrackerProvider.tsx` into your Next.js project (e.g. `lib/analytics/`).

2. Wrap your app in `_app.tsx` or `layout.tsx`:

```tsx
import { PacinTrackerProvider } from '@/lib/analytics/PacinTrackerProvider';

export default function RootLayout({ children }) {
  return (
    <PacinTrackerProvider collectorUrl={process.env.NEXT_PUBLIC_PACIN_COLLECTOR_URL!}>
      {children}
    </PacinTrackerProvider>
  );
}
```

3. Set env var in Vercel:
```
NEXT_PUBLIC_PACIN_COLLECTOR_URL=https://api.pacinnetwork.com
```

4. Track form conversions:
```tsx
const trackEvent = useTrackEvent();
// on form submit:
trackEvent('contact_submit');
trackEvent('waitlist_join');
```

## What it tracks
- Page view on every route change (SPA-aware)
- Referrer + UTM params automatically
- Anonymous visitor_id (localStorage) + session_id (sessionStorage)
- Respects DoNotTrack header
- Zero PII unless you pass it in `extra`
