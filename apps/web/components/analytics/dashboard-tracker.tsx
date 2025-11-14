"use client";

import { useEffect, useRef } from "react";
import { initMixpanel, trackMixpanelEvent } from "@/lib/mixpanel";

export function DashboardTracker() {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      initMixpanel();
      trackMixpanelEvent("V2-Dashboard", {
        path: window.location.pathname,
        timestamp: new Date().toISOString(),
        source: "web-app",
      });
      hasTracked.current = true;
    }
  }, []);

  return null;
}