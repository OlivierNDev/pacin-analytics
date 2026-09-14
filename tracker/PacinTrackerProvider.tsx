"use client";
import React, { createContext, useContext, useEffect, useCallback, type ReactNode } from "react";
import { trackEvent } from "./pacin-tracker";

interface TrackerContextValue { trackEvent: (event: string, extra?: Record<string, unknown>) => void; }
const TrackerContext = createContext<TrackerContextValue>({ trackEvent: () => {} });

export function PacinTrackerProvider({ collectorUrl, children }: { collectorUrl: string; children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    trackEvent(collectorUrl, "page_view");
    const handleRouteChange = () => trackEvent(collectorUrl, "page_view");
    window.addEventListener("popstate", handleRouteChange);
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args) { origPush(...args); handleRouteChange(); };
    history.replaceState = function (...args) { origReplace(...args); handleRouteChange(); };
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, [collectorUrl]);
  const track = useCallback((event: string, extra?: Record<string, unknown>) => trackEvent(collectorUrl, event, extra), [collectorUrl]);
  return <TrackerContext.Provider value={{ trackEvent: track }}>{children}</TrackerContext.Provider>;
}

export function useTrackEvent() { return useContext(TrackerContext).trackEvent; }
